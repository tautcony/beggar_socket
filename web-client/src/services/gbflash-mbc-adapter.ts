/**
 * GBFlash DMG/GBC (MBC1/2/3/5) cartridge adapter.
 * Derived from FlashGBX (GPL-3.0) LK_Device.py.
 */
import {
  FLASH_COMMAND_SET,
  FLASH_METHOD,
  FLASH_WE_PIN,
  type GbflashCommandClient,
  throwIfAborted,
} from '@/protocol';
import { CommandOptions, type MbcType } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { formatBytes, formatHex, formatTimeDuration } from '@/utils/formatter-utils';
import { type CFIInfo, parseCFI, type SectorBlock } from '@/utils/parsers/cfi-parser';
import { calcSectorUsage, getExtraErasedBytes } from '@/utils/sector-utils';

import { planBankChunk } from './bank-chunk-planner';
import type { LogCallback, ProgressCallback, TranslateFunction } from './cartridge-adapter';
import {
  configureProfileWriteCommand,
  executeProfileSteps,
  resetProfileFlash,
  unlockProfileFlash,
  waitForProfileFlash,
} from './flashcart-profile-runner';
import { GbflashBaseAdapter } from './gbflash-base-adapter';

const DMG_ROM_BANK_SIZE = 0x4000;
const DMG_RAM_BANK_SIZE = 0x2000;
const MBC2_RAM_SIZE = 0x200;

export class GbflashMbcAdapter extends GbflashBaseAdapter {
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
    clientOverride?: GbflashCommandClient,
  ) {
    super(device, logCallback, progressCallback, translateFunc, clientOverride);
  }

  private resolveVoltage(enable5V?: boolean): '5V' | '3.3V' {
    return enable5V === false ? '3.3V' : '5V';
  }

  private async resetFlashToRead(client: GbflashCommandClient): Promise<void> {
    await client.cartWrite('DMG', 0x0000, 0xF0, { flashcart: true });
  }

  private async selectRomBank(client: GbflashCommandClient, mbcType: MbcType, bank: number): Promise<void> {
    if (bank === 0) {
      return;
    }
    switch (mbcType) {
      case 'MBC1': {
        const low = (bank & 0x1F) || 1;
        const high = (bank >> 5) & 0x03;
        await client.cartWrite('DMG', 0x6000, 0x00);
        await client.cartWrite('DMG', 0x2000, low);
        await client.cartWrite('DMG', 0x4000, high);
        break;
      }
      case 'MBC2': {
        const low = (bank & 0x0F) || 1;
        await client.cartWrite('DMG', 0x2100, low);
        break;
      }
      case 'MBC3': {
        const low = (bank & 0x7F) || 1;
        await client.cartWrite('DMG', 0x2000, low);
        break;
      }
      case 'MBC5':
      default: {
        await client.cartWrite('DMG', 0x2000, bank & 0xFF);
        await client.cartWrite('DMG', 0x3000, (bank >> 8) & 0x01);
        break;
      }
    }
  }

  private async enableAndSelectRamBank(
    client: GbflashCommandClient,
    mbcType: MbcType,
    bank: number,
  ): Promise<void> {
    await client.cartWrite('DMG', mbcType === 'MBC2' ? 0x0000 : 0x0000, 0x0A, { sram: false });
    if (mbcType === 'MBC1') {
      await client.cartWrite('DMG', 0x6000, 0x01);
      await client.cartWrite('DMG', 0x4000, bank & 0x03);
    } else if (mbcType === 'MBC3') {
      await client.cartWrite('DMG', 0x4000, bank & 0x03);
    } else if (mbcType === 'MBC5') {
      await client.cartWrite('DMG', 0x4000, bank & 0x0F);
    }
  }

  private async disableRam(client: GbflashCommandClient): Promise<void> {
    await client.cartWrite('DMG', 0x0000, 0x00);
  }

  override async getCartInfo(
    enable5V = true,
    options?: Partial<CommandOptions>,
  ): Promise<CFIInfo | false> {
    this.clearCartInfoError();
    this.activeFlashcartProfile = null;
    try {
      const voltage = this.resolveVoltage(enable5V);
      if (voltage === '5V' && !this.client.fwInfo.cartPowerCtrl) {
        this.log('Device does not support cartridge power cycling; ensure cartridge is seated before 5V DMG access.', 'warn');
      }

      return await this.withModeTransaction(
        'DMG',
        {
          voltage,
          onCleanupReset: client => resetProfileFlash(client, 'DMG', this.activeFlashcartProfile),
        },
        async (client) => {
          const manualProfileId = this.flashcartProfileIdFor(options);
          if (manualProfileId) {
            return this.resolveManualProfileCartInfo(client, 'DMG', 'MBC5', manualProfileId);
          }

          await client.setVariable('DMG_READ_CS_PULSE', 0);
          await client.setVariable('DMG_WRITE_CS_PULSE', 0);
          await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR);
          await client.cartWriteFlash('DMG', [[0x0000, 0xF0]], true);
          const romBaseline = await client.readRom('DMG', 0x0000, 0x20, { maxLength: 0x20 });
          await client.cartWriteFlash('DMG', [[0x555, 0xAA], [0x2AA, 0x55], [0x555, 0x90]], true);
          let idBytes = await client.readRom('DMG', 0x0000, 0x20, { maxLength: 0x20 });
          await this.resetFlashToRead(client);

          await client.cartWriteFlash('DMG', [[0x55, 0x98]], true);
          let cfiRaw = await client.readRom('DMG', 0x0000, 0x100, { maxLength: 0x100 });
          await this.resetFlashToRead(client);

          let parsed = parseCFI(cfiRaw);
          if (!parsed || parsed.deviceSize <= 0) {
            await client.cartWriteFlash('DMG', [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x90]], true);
            idBytes = await client.readRom('DMG', 0x0000, 0x20, { maxLength: 0x20 });
            await this.resetFlashToRead(client);

            for (const cfiAddr of [0xAA, 0xAAA]) {
              await client.cartWriteFlash('DMG', [[cfiAddr, 0x98]], true);
              cfiRaw = await client.readRom('DMG', 0x0000, 0x100, { maxLength: 0x100 });
              await this.resetFlashToRead(client);
              parsed = parseCFI(cfiRaw);
              if (parsed && parsed.deviceSize > 0) {
                break;
              }
            }
          }

          if (parsed && parsed.deviceSize > 0) {
            parsed.flashId = idBytes.slice(0, 4);
            await this.logMatchedProfileForCfi('MBC5', romBaseline, idBytes, parsed.deviceSize);
            return parsed;
          }

          const toHex = (bytes: Uint8Array) =>
            Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
          this.log(`DMG CFI not detected (ROM[0..31]: ${toHex(romBaseline)}, ID[0..31]: ${toHex(idBytes)})`, 'warn');

          return this.runAutoProfileFallback(client, 'DMG', 'MBC5');
        },
      );
    } catch (error) {
      this.lastCartInfoError = error instanceof Error ? error.message : String(error);
      this.log(`DMG getCartInfo failed: ${this.lastCartInfoError}`, 'error');
      return false;
    }
  }

  private async pollDmgEraseStatus(
    client: GbflashCommandClient,
    address: number,
    timeoutMs = 15000,
    signal?: AbortSignal,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      throwIfAborted(signal);
      const val = await client.cartRead('DMG', address);
      if (val === 0xFF) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`DMG flash erase timeout at ${formatHex(address, 6)}`);
  }

  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      const { profile, errorResult } = await this.resolveProfileForOperation('MBC5', options);
      if (errorResult) {
        return errorResult;
      }

      const mbcType: MbcType = options.mbcType ?? 'MBC5';
      return await this.withModeTransaction(
        'DMG',
        {
          voltage: this.resolveVoltage(options.enable5V),
          signal,
          onCleanupReset: client => resetProfileFlash(client, 'DMG', profile),
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
            await unlockProfileFlash(client, 'DMG', profile);
          }

          const fullChip = totalBytes >= options.cfiInfo.deviceSize && options.cfiInfo.deviceSize > 0;
          if (fullChip && (!profile || profile.commands.chip_erase?.length)) {
            throwIfAborted(signal);
            if (profile?.commands.chip_erase?.length) {
              await executeProfileSteps(client, 'DMG', profile.commands.chip_erase, { sa: 0x0000 });
              await waitForProfileFlash(
                client,
                'DMG',
                0x0000,
                profile.commands.chip_erase_wait_for,
                (profile.chip_erase_timeout ?? 60) * 1000,
              );
              await resetProfileFlash(client, 'DMG', profile);
            } else {
              await client.cartWriteFlash('DMG', [
                [0x555, 0xAA],
                [0x2AA, 0x55],
                [0x555, 0x80],
                [0x555, 0xAA],
                [0x2AA, 0x55],
                [0x555, 0x10],
              ], true);
              await this.pollDmgEraseStatus(client, 0x0000, 180000, signal);
              await this.resetFlashToRead(client);
            }
            progress.advance(totalBytes);
          } else {
            for (const block of sectorInfo) {
              for (let i = 0; i < block.sectorCount; i++) {
                throwIfAborted(signal);
                const linearAddr = baseAddress + block.startAddress + i * block.sectorSize;
                this.log(this.t('messages.operation.eraseSector', {
                  from: formatHex(linearAddr, 4),
                  to: formatHex(linearAddr + block.sectorSize - 1, 4),
                }), 'info');
                const { bank, cartAddress } = planBankChunk(linearAddr, block.sectorSize, DMG_ROM_BANK_SIZE, {
                  platform: 'mbc',
                  memory: 'rom',
                  mbcType,
                });
                const windowAddress = bank === 0 ? linearAddr % DMG_ROM_BANK_SIZE : cartAddress;
                await this.selectRomBank(client, mbcType, bank);
                const isBlank = block.sectorSize <= DMG_ROM_BANK_SIZE
                  && await this.isRegionBlankCrc32(client, 'DMG', windowAddress, block.sectorSize, signal);
                if (!isBlank) {
                  if (profile?.commands.sector_erase?.length) {
                    await executeProfileSteps(client, 'DMG', profile.commands.sector_erase, { sa: windowAddress });
                    await waitForProfileFlash(
                      client,
                      'DMG',
                      windowAddress,
                      profile.commands.sector_erase_wait_for,
                      15000,
                    );
                    await resetProfileFlash(client, 'DMG', profile);
                  } else {
                    await client.cartWriteFlash('DMG', [
                      [0x555, 0xAA],
                      [0x2AA, 0x55],
                      [0x555, 0x80],
                      [0x555, 0xAA],
                      [0x2AA, 0x55],
                      [windowAddress, 0x30],
                    ], true);
                    await this.pollDmgEraseStatus(client, windowAddress, 15000, signal);
                    await this.resetFlashToRead(client);
                  }
                }
                progress.advance(block.sectorSize);
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
      const mbcType: MbcType = options.mbcType ?? 'MBC5';
      return await this.withModeTransaction(
        'DMG',
        { voltage: this.resolveVoltage(options.enable5V), signal },
        async (client) => {
          const baseAddress = options.baseAddress ?? 0;
          const maxLength = this.getReadChunkLimit();
          const out = new Uint8Array(size);
          if (showProgress) {
            this.log(this.t('messages.operation.startReadROM', { size, baseAddress: formatHex(baseAddress, 4) }), 'info');
          }
          const progress = showProgress ? this.createOperationProgress('read', size, Boolean(signal)) : null;

          let offset = 0;
          let lastBank = -1;
          while (offset < size) {
            throwIfAborted(signal);
            const linearAddr = baseAddress + offset;
            const { bank, cartAddress, chunkSize } = planBankChunk(
              linearAddr,
              size - offset,
              DMG_ROM_BANK_SIZE,
              { platform: 'mbc', memory: 'rom', mbcType },
            );
            const windowAddress = bank === 0 ? linearAddr % DMG_ROM_BANK_SIZE : cartAddress;
            if (bank !== lastBank) {
              await this.selectRomBank(client, mbcType, bank);
              lastBank = bank;
            }
            const chunk = await client.readRom('DMG', windowAddress, chunkSize, {
              maxLength,
              signal,
              onChunk: (part) => {
                progress?.advance(part.length);
                progress?.maybeLogMilestone('messages.rom.readingAt', baseAddress + offset);
              },
            });
            out.set(chunk, offset);
            offset += chunk.length;
          }

          if (progress) {
            const stats = progress.getStats();
            this.log(this.t('messages.rom.readSuccess', { size: out.length }), 'success');
            this.log(this.t('messages.rom.readSummary', {
              totalTime: stats.totalTime,
              avgSpeed: stats.avgSpeed,
              maxSpeed: stats.maxSpeed,
              totalSize: formatBytes(size),
              requestCount: stats.requestCount,
            }), 'info');
            progress.finish(this.t('messages.rom.readSuccess', { size: out.length }));
          }
          return {
            success: true,
            data: out,
            message: `Read ${formatBytes(out.length)}`,
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
      const { profile, errorResult } = await this.resolveProfileForOperation('MBC5', options);
      if (errorResult) {
        return errorResult;
      }

      const mbcType: MbcType = options.mbcType ?? 'MBC5';
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
        'DMG',
        {
          voltage: this.resolveVoltage(options.enable5V),
          signal,
          onCleanupReset: client => resetProfileFlash(client, 'DMG', profile),
        },
        async (client) => {
          const maxLength = this.getWriteChunkLimit();
          let flashBufferSize = options.cfiInfo.bufferWrite && options.cfiInfo.bufferSize
            ? options.cfiInfo.bufferSize
            : 0;
          this.log(this.t('messages.operation.startWriteROM', {
            fileSize: data.length,
            baseAddress: formatHex(baseAddress, 4),
            pageSize: maxLength,
            bufferSize: flashBufferSize,
          }), 'info');

          if (profile) {
            await unlockProfileFlash(client, 'DMG', profile);
            flashBufferSize = await configureProfileWriteCommand(client, 'DMG', profile);
          } else if (flashBufferSize > 0) {
            await client.setFlashCmd('DMG', FLASH_COMMAND_SET.AMD, FLASH_METHOD.BUFFERED, FLASH_WE_PIN.WR, [
              [0xAAA, 0xAA],
              [0x555, 0x55],
              [0, 0x25],
              [0, 0],
              [0, 0],
              [0, 0x29],
            ]);
          } else {
            await client.setFlashCmd('DMG', FLASH_COMMAND_SET.AMD, FLASH_METHOD.UNBUFFERED, FLASH_WE_PIN.WR, [
              [0xAAA, 0xAA],
              [0x555, 0x55],
              [0xAAA, 0xA0],
            ]);
          }

          const progress = this.createOperationProgress(
            'write',
            data.length,
            Boolean(signal),
            sectorInfo,
            baseAddress,
          );
          let offset = 0;
          let lastBank = -1;
          while (offset < data.length) {
            throwIfAborted(signal);
            const linearAddr = baseAddress + offset;
            const { bank, cartAddress, chunkSize } = planBankChunk(
              linearAddr,
              data.length - offset,
              DMG_ROM_BANK_SIZE,
              { platform: 'mbc', memory: 'rom', mbcType },
            );
            const windowAddress = bank === 0 ? linearAddr % DMG_ROM_BANK_SIZE : cartAddress;
            if (bank !== lastBank) {
              await this.selectRomBank(client, mbcType, bank);
              lastBank = bank;
            }
            const slice = data.subarray(offset, offset + chunkSize);
            await client.writeFlashRom('DMG', windowAddress, slice, flashBufferSize, {
              maxLength,
              signal,
              onChunk: (written) => {
                progress.advance(written);
                progress.maybeLogMilestone('messages.rom.writingAt', baseAddress + offset);
              },
            });
            offset += chunkSize;
          }

          await resetProfileFlash(client, 'DMG', profile);
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
      const mbcType: MbcType = options.mbcType ?? 'MBC5';
      return await this.withModeTransaction(
        'DMG',
        { voltage: this.resolveVoltage(options.enable5V), signal },
        async (client) => {
          const baseAddress = options.baseAddress ?? 0;
          this.log(this.t('messages.operation.startVerifyROM', { fileSize: data.length, baseAddress: formatHex(baseAddress, 4) }), 'info');
          const progress = this.createOperationProgress('verify', data.length, true);

          let offset = 0;
          let verifyPos = 0;
          let lastBank = -1;
          while (offset < data.length) {
            throwIfAborted(signal);
            const linearAddr = baseAddress + offset;
            const { bank, cartAddress, chunkSize } = planBankChunk(
              linearAddr,
              data.length - offset,
              DMG_ROM_BANK_SIZE,
              { platform: 'mbc', memory: 'rom', mbcType },
            );
            const windowAddress = bank === 0 ? linearAddr % DMG_ROM_BANK_SIZE : cartAddress;
            if (bank !== lastBank) {
              await this.selectRomBank(client, mbcType, bank);
              lastBank = bank;
            }
            const slice = data.subarray(offset, offset + chunkSize);
            const res = await client.verifyRomCrc32('DMG', windowAddress, slice, {
              signal,
              onChunk: (len) => {
                verifyPos += len;
                progress.advance(len);
                progress.maybeLogMilestone('messages.rom.verifyingAt', baseAddress + verifyPos);
              },
            });
            if (!res.matched) {
              const mismatchMsg = this.formatRomVerifyMismatch('DMG', offset + (res.mismatchOffset ?? 0), res);
              progress.error(mismatchMsg);
              this.log(mismatchMsg, 'error');
              return {
                success: false,
                message: mismatchMsg,
              };
            }
            offset += chunkSize;
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

  override async readRAM(
    size: number,
    options?: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    try {
      const mbcType: MbcType = options?.mbcType ?? 'MBC5';
      const effectiveSize = mbcType === 'MBC2' ? Math.min(size, MBC2_RAM_SIZE) : size;
      return await this.withModeTransaction(
        'DMG',
        { voltage: this.resolveVoltage(options?.enable5V), signal },
        async (client) => {
          const maxLength = this.getReadChunkLimit();
          const out = new Uint8Array(effectiveSize);
          this.log(this.t('messages.operation.startReadRAM', { size: effectiveSize, baseAddress: formatHex(0, 4) }), 'info');
          const progress = this.createOperationProgress('read', effectiveSize, Boolean(signal));

          let offset = 0;
          let bank = 0;
          try {
            while (offset < effectiveSize) {
              throwIfAborted(signal);
              const chunkLength = Math.min(effectiveSize - offset, DMG_RAM_BANK_SIZE);
              await this.enableAndSelectRamBank(client, mbcType, bank);
              const chunk = await client.readRam('DMG', 0, chunkLength, {
                maxLength,
                signal,
                onChunk: part => { progress.advance(part.length); },
              });
              if (mbcType === 'MBC2') {
                for (let i = 0; i < chunk.length; i++) {
                  chunk[i] &= 0x0F;
                }
              }
              out.set(chunk, offset);
              offset += chunk.length;
              bank++;
            }
          } finally {
            await this.disableRam(client).catch(() => undefined);
          }

          const stats = progress.getStats();
          this.log(this.t('messages.ram.readSuccess', { size: out.length }), 'success');
          this.log(this.t('messages.ram.readSummary', {
            totalTime: stats.totalTime,
            avgSpeed: stats.avgSpeed,
            maxSpeed: stats.maxSpeed,
            totalSize: formatBytes(out.length),
          }), 'info');
          progress.finish(this.t('messages.ram.readSuccess', { size: out.length }));
          return {
            success: true,
            data: out,
            message: `Read ${formatBytes(out.length)}`,
          };
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
      const mbcType: MbcType = options?.mbcType ?? 'MBC5';
      const effectiveData = mbcType === 'MBC2' ? data.subarray(0, Math.min(data.length, MBC2_RAM_SIZE)) : data;
      return await this.withModeTransaction(
        'DMG',
        { voltage: this.resolveVoltage(options?.enable5V), signal },
        async (client) => {
          const maxLength = this.getRamWriteChunkLimit();
          this.log(this.t('messages.operation.startWriteRAM', { fileSize: effectiveData.length, baseAddress: formatHex(0, 4) }), 'info');
          const progress = this.createOperationProgress('write', effectiveData.length, Boolean(signal));

          let offset = 0;
          let bank = 0;
          try {
            while (offset < effectiveData.length) {
              throwIfAborted(signal);
              const chunkLength = Math.min(effectiveData.length - offset, DMG_RAM_BANK_SIZE);
              await this.enableAndSelectRamBank(client, mbcType, bank);
              const slice = effectiveData.subarray(offset, offset + chunkLength);
              await client.writeRam('DMG', 0, slice, {
                maxLength,
                signal,
                onChunk: written => { progress.advance(written); },
              });
              offset += chunkLength;
              bank++;
            }
          } finally {
            await this.disableRam(client).catch(() => undefined);
          }

          const stats = progress.getStats();
          this.log(this.t('messages.ram.writeComplete'), 'success');
          this.log(this.t('messages.ram.writeSummary', {
            totalTime: stats.totalTime,
            avgSpeed: stats.avgSpeed,
            maxSpeed: stats.maxSpeed,
            totalSize: formatBytes(effectiveData.length),
          }), 'info');
          progress.finish(this.t('messages.ram.writeComplete'));
          return {
            success: true,
            message: `Wrote ${formatBytes(effectiveData.length)}`,
          };
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
    const mbcType: MbcType = options?.mbcType ?? 'MBC5';
    this.log(this.t('messages.operation.startVerifyRAM', { fileSize: data.length, baseAddress: formatHex(0, 4) }), 'info');
    const readRes = await this.readRAM(data.length, options, signal);
    if (!readRes.success || !readRes.data) {
      return readRes;
    }
    const expected = mbcType === 'MBC2'
      ? data.subarray(0, readRes.data.length).map(b => b & 0x0F)
      : data;
    const cmp = this.verifyDataEqual(expected, readRes.data);
    if (!cmp.matched) {
      const msg = `DMG RAM verify mismatch at ${formatHex(cmp.mismatchOffset ?? 0, 6)}`;
      this.log(msg, 'error');
      return {
        success: false,
        message: msg,
      };
    }
    this.log(this.t('messages.ram.verifySuccess'), 'success');
    return {
      success: true,
      message: `Verified ${formatBytes(readRes.data.length)}`,
    };
  }
}
