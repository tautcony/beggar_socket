/**
 * FlashGBX GBA (AGB) cartridge adapter.
 * Derived from FlashGBX (GPL-3.0) LK_Device.py.
 */
import {
  FLASH_COMMAND_SET,
  FLASH_METHOD,
  FLASH_WE_PIN,
  FLASHGBX_CMD,
  type FlashgbxCommandClient,
  throwIfAborted,
} from '@/protocol';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import type { FlashcartProfile } from '@/types/flashcart-profile';
import { formatBytes, formatHex, formatTimeDuration } from '@/utils/formatter-utils';
import { type CFIInfo, parseCFI, type SectorBlock } from '@/utils/parsers/cfi-parser';
import { calcSectorUsage, getExtraErasedBytes } from '@/utils/sector-utils';

import type { LogCallback, ProgressCallback, TranslateFunction } from './cartridge-adapter';
import {
  configureProfileWriteCommand,
  executeProfileSteps,
  resetProfileFlash,
  unlockProfileFlash,
  waitForProfileFlash,
} from './flashcart-profile-runner';
import { FlashgbxBaseAdapter } from './flashgbx-base-adapter';

export type GbaSaveType = 'SRAM' | 'FRAM' | 'FLASH_512K' | 'FLASH_1M' | 'EEPROM_4K' | 'EEPROM_64K';

const GBA_ROM_BANK_SIZE = 1 << 25; // 32 MiB GBA ROM bus window (0x02000000)

export interface GbaRtcState {
  hasRtc: boolean;
  raw?: Uint8Array;
}

export class FlashgbxGbaAdapter extends FlashgbxBaseAdapter {
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
    clientOverride?: FlashgbxCommandClient,
  ) {
    super(device, logCallback, progressCallback, translateFunc, clientOverride);
  }

  private async resetFlashToRead(client: FlashgbxCommandClient): Promise<void> {
    await client.cartWrite('AGB', 0x00, 0xF0, { flashcart: true });
  }

  private async switchROMBank(client: FlashgbxCommandClient, bank: number): Promise<void> {
    await client.writeRam('AGB', 0x02, new Uint8Array([(bank & 0x0F) << 4]));
    await client.writeRam('AGB', 0x03, new Uint8Array([0x40]));
    if (bank !== 0) {
      this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
    }
  }

  private needsMultiBank(baseAddress: number, length: number, cfiInfo?: CFIInfo): boolean {
    return (
      baseAddress >= GBA_ROM_BANK_SIZE
      || baseAddress + length > GBA_ROM_BANK_SIZE
      || (cfiInfo?.deviceSize ?? 0) > GBA_ROM_BANK_SIZE
    );
  }

  private async forEachGbaBankChunk(
    client: FlashgbxCommandClient,
    baseAddress: number,
    totalLength: number,
    cfiInfo: CFIInfo | undefined,
    signal: AbortSignal | undefined,
    fn: (bankOffset: number, chunkLength: number, linearOffset: number) => Promise<void>,
  ): Promise<void> {
    if (!this.needsMultiBank(baseAddress, totalLength, cfiInfo)) {
      await fn(baseAddress, totalLength, 0);
      return;
    }

    let linearOffset = 0;
    let currentBank = -1;
    let switchedToNonZero = false;
    try {
      while (linearOffset < totalLength) {
        throwIfAborted(signal);
        const linearAddr = baseAddress + linearOffset;
        const bank = Math.floor(linearAddr / GBA_ROM_BANK_SIZE);
        const bankOffset = linearAddr & (GBA_ROM_BANK_SIZE - 1);
        const chunkLength = Math.min(totalLength - linearOffset, GBA_ROM_BANK_SIZE - bankOffset);

        if (bank !== currentBank) {
          await this.switchROMBank(client, bank);
          currentBank = bank;
          if (bank !== 0) {
            switchedToNonZero = true;
          }
        }
        await fn(bankOffset, chunkLength, linearOffset);
        linearOffset += chunkLength;
      }
    } finally {
      if (switchedToNonZero) {
        await this.switchROMBank(client, 0).catch(() => undefined);
      }
    }
  }

  override async getCartInfo(
    _enable5V = false,
    options?: Partial<CommandOptions>,
  ): Promise<CFIInfo | false> {
    this.clearCartInfoError();
    this.activeFlashcartProfile = null;
    try {
      return await this.withModeTransaction(
        'AGB',
        {
          voltage: '3.3V',
          onCleanupReset: client => resetProfileFlash(client, 'AGB', this.activeFlashcartProfile),
        },
        async (client) => {
          if (options?.flashcartProfileId) {
            return this.resolveManualProfileCartInfo(client, 'AGB', 'GBA', options.flashcartProfileId);
          }

          await client.cartWriteFlash('AGB', [[0x00, 0xF0]], true);
          await client.cartWriteFlash('AGB', [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x90]], true);
          const idBytes = await client.readRom('AGB', 0x00, 8, { maxLength: 8 });
          await this.resetFlashToRead(client);

          await client.cartWriteFlash('AGB', [[0xAA, 0x98]], true);
          const cfiRaw = await client.readRom('AGB', 0x00, 0x100, { maxLength: 0x100 });
          await this.resetFlashToRead(client);

          const parsed = parseCFI(cfiRaw);
          if (parsed && parsed.deviceSize > 0) {
            parsed.flashId = idBytes.slice(0, 4);
            return parsed;
          }

          return this.runAutoProfileFallback(client, 'AGB', 'GBA');
        },
      );
    } catch (error) {
      this.lastCartInfoError = error instanceof Error ? error.message : String(error);
      this.log(`GBA getCartInfo failed: ${this.lastCartInfoError}`, 'error');
      return false;
    }
  }

  async readGpioRtc(): Promise<GbaRtcState> {
    return this.withModeTransaction('AGB', { voltage: '3.3V' }, async (client) => {
      const raw = await client.agbReadGpioRtc();
      if (!raw || raw.length < 8) {
        return { hasRtc: false };
      }
      return {
        hasRtc: raw[0] === 1,
        raw: raw.slice(1, 8),
      };
    });
  }

  private async eraseSingleGbaSector(
    client: FlashgbxCommandClient,
    sectorAddr: number,
    profile: FlashcartProfile | null,
    signal?: AbortSignal,
  ): Promise<void> {
    if (profile?.commands.sector_erase?.length) {
      await executeProfileSteps(client, 'AGB', profile.commands.sector_erase, { sa: sectorAddr });
      await waitForProfileFlash(
        client,
        'AGB',
        sectorAddr,
        profile.commands.sector_erase_wait_for,
        15000,
      );
      await resetProfileFlash(client, 'AGB', profile);
    } else {
      await client.cartWriteFlash('AGB', [
        [0xAAA, 0xAA],
        [0x555, 0x55],
        [0xAAA, 0x80],
        [0xAAA, 0xAA],
        [0x555, 0x55],
        [sectorAddr, 0x30],
      ], true);
      await this.pollToggleOrStatus(client, sectorAddr, 15000, signal);
      await this.resetFlashToRead(client);
    }
  }

  private async configureGbaWriteCommand(
    client: FlashgbxCommandClient,
    options: CommandOptions,
    profile: FlashcartProfile | null,
  ): Promise<number> {
    const cfiBufferSize = options.cfiInfo.bufferWrite && options.cfiInfo.bufferSize
      ? options.cfiInfo.bufferSize
      : 0;
    if (profile) {
      await unlockProfileFlash(client, 'AGB', profile);
      return configureProfileWriteCommand(client, 'AGB', profile);
    }
    if (cfiBufferSize > 0) {
      await client.setFlashCmd('AGB', FLASH_COMMAND_SET.AMD, FLASH_METHOD.BUFFERED, FLASH_WE_PIN.UNSET, [
        [0xAAA, 0xAA],
        [0x555, 0x55],
        [0, 0x25],
        [0, 0],
        [0, 0],
        [0, 0x29],
      ]);
      return cfiBufferSize;
    }
    await client.setFlashCmd('AGB', FLASH_COMMAND_SET.AMD, FLASH_METHOD.UNBUFFERED, FLASH_WE_PIN.UNSET, [
      [0xAAA, 0xAA],
      [0x555, 0x55],
      [0xAAA, 0xA0],
    ]);
    return 0;
  }

  private async pollToggleOrStatus(
    client: FlashgbxCommandClient,
    address: number,
    timeoutMs = 15000,
    signal?: AbortSignal,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let prev = await client.cartRead('AGB', address);
    while (Date.now() < deadline) {
      throwIfAborted(signal);
      const curr = await client.cartRead('AGB', address);
      if (curr === prev && curr === 0xFFFF) {
        return;
      }
      prev = curr;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`GBA flash erase timeout at ${formatHex(address, 6)}`);
  }

  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      const { profile, errorResult } = await this.resolveProfileForOperation('GBA', options);
      if (errorResult) {
        return errorResult;
      }

      return await this.withModeTransaction(
        'AGB',
        {
          voltage: '3.3V',
          signal,
          onCleanupReset: client => resetProfileFlash(client, 'AGB', profile),
        },
        async (client) => {
          const baseAddress = options.baseAddress ?? 0;
          const totalBytes = sectorInfo.reduce((sum, b) => sum + b.totalSize, 0);
          const totalSectors = sectorInfo.reduce((sum, b) => sum + b.sectorCount, 0);
          const minStart = sectorInfo.length > 0 ? Math.min(...sectorInfo.map(b => b.startAddress)) : baseAddress;
          const maxEnd = sectorInfo.length > 0 ? Math.max(...sectorInfo.map(b => b.endAddress)) : baseAddress;
          this.log(this.t('messages.operation.startEraseSectors', {
            startAddress: formatHex(minStart, 4),
            endAddress: formatHex(Math.max(minStart, maxEnd - 1), 4),
            sectorSize: formatBytes(sectorInfo[0]?.sectorSize ?? 0),
          }), 'info');
          const progress = this.createOperationProgress('erase', totalBytes, Boolean(signal), sectorInfo, baseAddress);

          if (profile) {
            await unlockProfileFlash(client, 'AGB', profile);
          }

          const fullChip = totalBytes >= options.cfiInfo.deviceSize && options.cfiInfo.deviceSize > 0;
          if (fullChip && (!profile || profile.commands.chip_erase?.length)) {
            throwIfAborted(signal);
            if (profile?.commands.chip_erase?.length) {
              await executeProfileSteps(client, 'AGB', profile.commands.chip_erase, { sa: baseAddress });
              await waitForProfileFlash(
                client,
                'AGB',
                baseAddress,
                profile.commands.chip_erase_wait_for,
                (profile.chip_erase_timeout ?? 60) * 1000,
              );
              await resetProfileFlash(client, 'AGB', profile);
            } else {
              await client.cartWriteFlash('AGB', [
                [0xAAA, 0xAA],
                [0x555, 0x55],
                [0xAAA, 0x80],
                [0xAAA, 0xAA],
                [0x555, 0x55],
                [0xAAA, 0x10],
              ], true);
              await this.pollToggleOrStatus(client, baseAddress, 180000, signal);
              await this.resetFlashToRead(client);
            }
            progress.advance(totalBytes);
          } else {
            const multiBank = this.needsMultiBank(baseAddress, totalBytes, options.cfiInfo);
            let currentBank = -1;
            let switchedToNonZero = false;
            try {
              for (const block of sectorInfo) {
                for (let i = 0; i < block.sectorCount; i++) {
                  throwIfAborted(signal);
                  const linearAddr = baseAddress + block.startAddress + i * block.sectorSize;
                  this.log(this.t('messages.operation.eraseSector', {
                    from: formatHex(linearAddr, 4),
                    to: formatHex(linearAddr + block.sectorSize - 1, 4),
                  }), 'info');
                  const bank = multiBank ? Math.floor(linearAddr / GBA_ROM_BANK_SIZE) : 0;
                  const sectorAddr = multiBank ? (linearAddr & (GBA_ROM_BANK_SIZE - 1)) : linearAddr;
                  if (multiBank && bank !== currentBank) {
                    await this.switchROMBank(client, bank);
                    currentBank = bank;
                    if (bank !== 0) {
                      switchedToNonZero = true;
                    }
                  }
                  const isBlank = await this.isRegionBlankCrc32(client, 'AGB', sectorAddr, block.sectorSize, signal);
                  if (!isBlank) {
                    await this.eraseSingleGbaSector(client, sectorAddr, profile, signal);
                  }
                  progress.advance(block.sectorSize);
                }
              }
            } finally {
              if (switchedToNonZero) {
                await this.switchROMBank(client, 0).catch(() => undefined);
              }
            }
          }

          const stats = progress.getStats();
          this.log(this.t('messages.operation.eraseSuccess'), 'success');
          this.log(this.t('messages.operation.eraseSummary', {
            totalTime: stats.totalTime,
            avgSpeed: stats.avgSpeed,
            maxSpeed: stats.maxSpeed,
            totalSectors,
          }), 'info');
          progress.finish(this.t('messages.operation.eraseSuccess'));
          return {
            success: true,
            message: `Erased ${formatBytes(totalBytes)}`,
          };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.operation.eraseSectorFailed'));
    }
  }

  override async readROM(
    size: number,
    options: CommandOptions,
    signal?: AbortSignal,
    showProgress = true,
  ): Promise<CommandResult> {
    try {
      return await this.withModeTransaction(
        'AGB',
        { voltage: '3.3V', signal },
        async (client) => {
          const baseAddress = options.baseAddress ?? 0;
          const maxLength = this.getReadChunkLimit();
          if (showProgress) {
            this.log(this.t('messages.operation.startReadROM', { size, baseAddress: formatHex(baseAddress, 4) }), 'info');
          }
          const progress = showProgress ? this.createOperationProgress('read', size, Boolean(signal)) : null;

          const data = new Uint8Array(size);
          let readPos = 0;
          await this.forEachGbaBankChunk(client, baseAddress, size, options.cfiInfo, signal, async (bankOffset, chunkLen, linearOffset) => {
            const chunk = await client.readRom('AGB', bankOffset, chunkLen, {
              maxLength,
              signal,
              onChunk: (part) => {
                readPos += part.length;
                progress?.advance(part.length);
                progress?.maybeLogMilestone('messages.rom.readingAt', baseAddress + readPos);
              },
            });
            data.set(chunk, linearOffset);
          });

          if (progress) {
            const stats = progress.getStats();
            this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
            this.log(this.t('messages.rom.readSummary', {
              totalTime: stats.totalTime,
              avgSpeed: stats.avgSpeed,
              maxSpeed: stats.maxSpeed,
              totalSize: formatBytes(size),
              requestCount: stats.requestCount,
            }), 'info');
            progress.finish(this.t('messages.rom.readSuccess', { size: data.length }));
          }
          return {
            success: true,
            data,
            message: `Read ${formatBytes(data.length)}`,
          };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.rom.readFailed'));
    }
  }

  override async writeROM(
    data: Uint8Array,
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      const { profile, errorResult } = await this.resolveProfileForOperation('GBA', options);
      if (errorResult) {
        return errorResult;
      }

      const baseAddress = options.baseAddress ?? 0;
      const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, data.length, baseAddress);
      const extraErase = getExtraErasedBytes(sectorInfo, baseAddress, data.length);
      if (extraErase) {
        this.log(
          `Partial sector coverage: erasing [${formatHex(extraErase.eraseStart, 4)}, ${formatHex(extraErase.eraseEnd, 4)}) `
          + `(headExtra=${extraErase.headExtra}B, tailExtra=${extraErase.tailExtra}B)`,
          'warn',
        );
      }
      const eraseStartTime = Date.now();
      const eraseResult = await this.eraseSectors(sectorInfo, { ...options, baseAddress: 0 }, signal);
      const eraseDuration = Date.now() - eraseStartTime;
      if (!eraseResult.success) {
        return eraseResult;
      }

      return await this.withModeTransaction(
        'AGB',
        {
          voltage: '3.3V',
          signal,
          onCleanupReset: client => resetProfileFlash(client, 'AGB', profile),
        },
        async (client) => {
          const maxLength = this.getWriteChunkLimit();
          const flashBufferSize = await this.configureGbaWriteCommand(client, options, profile);
          this.log(this.t('messages.operation.startWriteROM', {
            fileSize: data.length,
            baseAddress: formatHex(baseAddress, 4),
            pageSize: maxLength,
            bufferSize: flashBufferSize,
          }), 'info');

          const progress = this.createOperationProgress(
            'write',
            data.length,
            Boolean(signal),
            sectorInfo,
            baseAddress,
          );
          let isFirstBank = true;
          let writePos = 0;
          await this.forEachGbaBankChunk(client, baseAddress, data.length, options.cfiInfo, signal, async (bankOffset, chunkLen, linearOffset) => {
            if (!isFirstBank && profile) {
              await unlockProfileFlash(client, 'AGB', profile);
            }
            isFirstBank = false;
            const slice = data.subarray(linearOffset, linearOffset + chunkLen);
            await client.writeFlashRom('AGB', bankOffset, slice, flashBufferSize, {
              maxLength,
              signal,
              onChunk: (written) => {
                writePos += written;
                progress.advance(written);
                progress.maybeLogMilestone('messages.rom.writingAt', baseAddress + writePos);
              },
            });
          });
          await resetProfileFlash(client, 'AGB', profile);
          const stats = progress.getStats();
          this.log(this.t('messages.rom.writeComplete'), 'success');
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: stats.totalTime,
            transferTime: stats.totalTime,
            eraseTime: formatTimeDuration(eraseDuration / 1000),
            avgSpeed: stats.avgSpeed,
            maxSpeed: stats.maxSpeed,
            totalSize: formatBytes(data.length),
            programRequests: stats.requestCount,
            retryCount: 0,
            skippedBytes: formatBytes(0),
          }), 'info');
          progress.finish(this.t('messages.rom.writeComplete'));

          return {
            success: true,
            message: `Wrote ${formatBytes(data.length)}`,
          };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.rom.writeFailed'));
    }
  }

  override async verifyROM(
    data: Uint8Array,
    options: CommandOptions,
    signal: AbortSignal,
  ): Promise<CommandResult> {
    try {
      return await this.withModeTransaction(
        'AGB',
        { voltage: '3.3V', signal },
        async (client) => {
          const baseAddress = options.baseAddress ?? 0;
          this.log(this.t('messages.operation.startVerifyROM', { fileSize: data.length, baseAddress: formatHex(baseAddress, 4) }), 'info');
          const progress = this.createOperationProgress('verify', data.length, true);
          let mismatchMsg: string | null = null;
          let verifyPos = 0;
          await this.forEachGbaBankChunk(client, baseAddress, data.length, options.cfiInfo, signal, async (bankOffset, chunkLen, linearOffset) => {
            if (mismatchMsg !== null) {
              return;
            }
            const slice = data.subarray(linearOffset, linearOffset + chunkLen);
            const result = await client.verifyRomCrc32('AGB', bankOffset, slice, {
              signal,
              onChunk: (len) => {
                verifyPos += len;
                progress.advance(len);
                progress.maybeLogMilestone('messages.rom.verifyingAt', baseAddress + verifyPos);
              },
            });
            if (!result.matched) {
              mismatchMsg = this.formatRomVerifyMismatch('GBA', linearOffset + (result.mismatchOffset ?? 0), result);
            }
          });

          if (mismatchMsg !== null) {
            progress.error(mismatchMsg);
            this.log(mismatchMsg, 'error');
            return {
              success: false,
              message: mismatchMsg,
            };
          }
          const stats = progress.getStats();
          this.log(this.t('messages.rom.verifySuccess'), 'success');
          this.log(this.t('messages.rom.verifySummary', {
            totalTime: stats.totalTime,
            avgSpeed: stats.avgSpeed,
            maxSpeed: stats.maxSpeed,
            totalSize: formatBytes(data.length),
            requestCount: stats.requestCount,
          }), 'info');
          progress.finish(this.t('messages.rom.verifySuccess'));
          return {
            success: true,
            message: `Verified ${formatBytes(data.length)}`,
          };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.rom.verifyFailed'));
    }
  }

  private resolveSaveType(size: number, options?: CommandOptions): GbaSaveType {
    if (options?.ramType === 'FLASH') {
      return size > 0x10000 ? 'FLASH_1M' : 'FLASH_512K';
    }
    if (options?.ramType === 'FRAM') {
      return 'FRAM';
    }
    if (size === 0x200) {
      return 'EEPROM_4K';
    }
    if (size === 0x2000) {
      return 'EEPROM_64K';
    }
    return 'SRAM';
  }

  private async switchAgbFlashBank(client: FlashgbxCommandClient, bank: number): Promise<void> {
    await client.cartWriteFlash('AGB', [
      [0x5555, 0xAA],
      [0x2AAA, 0x55],
      [0x5555, 0xB0],
      [0x0000, bank & 0x01],
    ], false);
  }

  override async readRAM(
    size: number,
    options?: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      return await this.withModeTransaction(
        'AGB',
        { voltage: '3.3V', signal },
        async (client) => {
          const saveType = this.resolveSaveType(size, options);
          const maxLength = this.getReadChunkLimit();
          this.log(this.t('messages.operation.startReadRAM', { size, baseAddress: formatHex(0, 4) }), 'info');
          const progress = this.createOperationProgress('read', size, Boolean(signal));

          const logRamReadSuccess = (readLen: number) => {
            const stats = progress.getStats();
            this.log(this.t('messages.ram.readSuccess', { size: readLen }), 'success');
            this.log(this.t('messages.ram.readSummary', {
              totalTime: stats.totalTime,
              avgSpeed: stats.avgSpeed,
              maxSpeed: stats.maxSpeed,
              totalSize: formatBytes(readLen),
            }), 'info');
            progress.finish(this.t('messages.ram.readSuccess', { size: readLen }));
          };

          if (saveType === 'EEPROM_4K' || saveType === 'EEPROM_64K') {
            const eepromMode = saveType === 'EEPROM_4K' ? 1 : 2;
            const data = await client.readRam('AGB', 0, size, {
              command: [FLASHGBX_CMD.AGB_CART_READ_EEPROM, eepromMode],
              maxLength: Math.min(maxLength, 0x200),
              signal,
              onChunk: chunk => { progress.advance(chunk.length); },
            });
            logRamReadSuccess(data.length);
            return { success: true, data, message: `Read ${formatBytes(data.length)}` };
          }

          if (saveType === 'FLASH_1M') {
            const out = new Uint8Array(size);
            const bank0Len = Math.min(size, 0x10000);
            await this.switchAgbFlashBank(client, 0);
            const bank0 = await client.readRam('AGB', 0, bank0Len, {
              command: FLASHGBX_CMD.AGB_CART_READ_SRAM,
              maxLength,
              signal,
              onChunk: chunk => { progress.advance(chunk.length); },
            });
            out.set(bank0, 0);
            if (size > 0x10000) {
              await this.switchAgbFlashBank(client, 1);
              const bank1 = await client.readRam('AGB', 0, size - 0x10000, {
                command: FLASHGBX_CMD.AGB_CART_READ_SRAM,
                maxLength,
                signal,
                onChunk: chunk => { progress.advance(chunk.length); },
              });
              out.set(bank1, 0x10000);
            }
            logRamReadSuccess(out.length);
            return { success: true, data: out, message: `Read ${formatBytes(out.length)}` };
          }

          const data = await client.readRam('AGB', 0, size, {
            command: FLASHGBX_CMD.AGB_CART_READ_SRAM,
            maxLength,
            signal,
            onChunk: chunk => { progress.advance(chunk.length); },
          });
          logRamReadSuccess(data.length);
          return { success: true, data, message: `Read ${formatBytes(data.length)}` };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.ram.readFailed'));
    }
  }

  override async writeRAM(
    data: Uint8Array,
    options?: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      return await this.withModeTransaction(
        'AGB',
        { voltage: '3.3V', signal },
        async (client) => {
          const saveType = this.resolveSaveType(data.length, options);
          const maxLength = this.getRamWriteChunkLimit();
          this.log(this.t('messages.operation.startWriteRAM', { fileSize: data.length, baseAddress: formatHex(0, 4) }), 'info');
          const progress = this.createOperationProgress('write', data.length, Boolean(signal));

          const logRamWriteSuccess = () => {
            const stats = progress.getStats();
            this.log(this.t('messages.ram.writeComplete'), 'success');
            this.log(this.t('messages.ram.writeSummary', {
              totalTime: stats.totalTime,
              avgSpeed: stats.avgSpeed,
              maxSpeed: stats.maxSpeed,
              totalSize: formatBytes(data.length),
            }), 'info');
            progress.finish(this.t('messages.ram.writeComplete'));
          };

          if (saveType === 'EEPROM_4K' || saveType === 'EEPROM_64K') {
            const eepromMode = saveType === 'EEPROM_4K' ? 1 : 2;
            await client.writeRam('AGB', 0, data, {
              command: [FLASHGBX_CMD.AGB_CART_WRITE_EEPROM, eepromMode],
              maxLength: Math.min(maxLength, 0x40),
              signal,
              onChunk: written => { progress.advance(written); },
            });
            logRamWriteSuccess();
            return { success: true, message: `Wrote ${formatBytes(data.length)}` };
          }

          if (saveType === 'FLASH_512K' || saveType === 'FLASH_1M') {
            // Read Flash save ID (LK_Device.py:3646-3675) to detect Atmel AT29LV512 (0x1F3D)
            await client.cartWriteFlash('AGB', [
              [0x5555, 0xAA],
              [0x2AAA, 0x55],
              [0x5555, 0x90],
            ], false);
            const mfr = await client.cartRead('AGB', 0x0000, true);
            const dev = await client.cartRead('AGB', 0x0001, true);
            await client.cartWriteFlash('AGB', [[0x5555, 0xF0]], false);
            const chipId = (mfr << 8) | dev;
            const isAtmel = chipId === 0x1F3D;

            if (!isAtmel) {
              await client.cartWriteFlash('AGB', [
                [0x5555, 0xAA],
                [0x2AAA, 0x55],
                [0x5555, 0x80],
                [0x5555, 0xAA],
                [0x2AAA, 0x55],
                [0x5555, 0x10],
              ], false);
              const eraseDeadline = Date.now() + 15000;
              while (Date.now() < eraseDeadline) {
                throwIfAborted(signal);
                const status = await client.cartRead('AGB', 0x0000, true);
                if (status === 0xFF) {
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }

            const writeMode = isAtmel ? 2 : 1;
            const banks = saveType === 'FLASH_1M' && data.length > 0x10000 ? 2 : 1;
            try {
              for (let bank = 0; bank < banks; bank++) {
                throwIfAborted(signal);
                if (banks > 1) {
                  await this.switchAgbFlashBank(client, bank);
                }
                const slice = data.subarray(bank * 0x10000, Math.min((bank + 1) * 0x10000, data.length));
                await client.writeRam('AGB', 0, slice, {
                  command: [FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA, writeMode],
                  maxLength,
                  signal,
                  onChunk: written => { progress.advance(written); },
                });
              }
            } finally {
              if (banks > 1) {
                await this.switchAgbFlashBank(client, 0).catch(() => undefined);
              }
            }
            logRamWriteSuccess();
            return { success: true, message: `Wrote ${formatBytes(data.length)}` };
          }

          await client.writeRam('AGB', 0, data, {
            command: FLASHGBX_CMD.AGB_CART_WRITE_SRAM,
            maxLength,
            signal,
            onChunk: written => { progress.advance(written); },
          });
          logRamWriteSuccess();
          return { success: true, message: `Wrote ${formatBytes(data.length)}` };
        },
      );
    } catch (error) {
      return this.mapOperationError(error, this.t('messages.ram.writeFailed'));
    }
  }

  override async verifyRAM(
    data: Uint8Array,
    options?: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    this.log(this.t('messages.operation.startVerifyRAM', { fileSize: data.length, baseAddress: formatHex(0, 4) }), 'info');
    const readRes = await this.readRAM(data.length, options, signal);
    if (!readRes.success || !readRes.data) {
      return readRes;
    }
    const cmp = this.verifyDataEqual(data, readRes.data);
    if (!cmp.matched) {
      const msg = `GBA RAM verify mismatch at ${formatHex(cmp.mismatchOffset ?? 0, 6)}`;
      this.log(msg, 'error');
      return {
        success: false,
        message: msg,
      };
    }
    this.log(this.t('messages.ram.verifySuccess'), 'success');
    return {
      success: true,
      message: `Verified ${formatBytes(data.length)}`,
    };
  }
}
