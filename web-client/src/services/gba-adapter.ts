import {
  GBA_ROM_FLASH_CMD_SET,
  getFlashName,
  ram_erase_flash,
  ram_program_flash,
  ram_read,
  ram_read_fram,
  ram_write,
  ram_write_fram,
  rom_erase_chip,
  rom_erase_sector,
  rom_get_id,
  rom_program,
  rom_read,
  rom_write,
  toLittleEndian,
} from '@/protocol';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import type { PlatformOps } from '@/services/platform-ops';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { firmwareUnsupportedResult, isRamTypeSupportedByFirmware } from '@/types/firmware-profile';
import type { SectorProgressInfo } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { errorToBurnerLog } from '@/utils/burner-log';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { PerformanceTracker } from '@/utils/monitoring/sentry-tracker';
import { CFIInfo, parseCFI, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';
import { calcSectorUsage } from '@/utils/sector-utils';

/**
 * GBA Adapter - 灏佽GBA鍗″甫鐨勫崗璁搷浣?
 */
export class GBAAdapter extends CartridgeAdapter {
  private static readonly ROM_BANK_SIZE = 1 << 25;
  private static readonly RAM_BANK_SWITCH_SETTLE_MS = 100;
  private static readonly CHIP_ERASE_TIMEOUT_MS = 120_000;

  /**
   * 鏋勯€犲嚱鏁?
   * @param device - 璁惧瀵硅薄
   * @param logCallback - 鏃ュ織鍥炶皟鍑芥暟
   * @param progressCallback - 杩涘害鍥炶皟鍑芥暟
   * @param translateFunc - 鍥介檯鍖栫炕璇戝嚱鏁?
   */
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
  ) {
    super(device, logCallback, progressCallback, translateFunc);
  }

  protected override createPlatformOps(): PlatformOps {
    return {
      platformId: 'gba',
      flashCmdSet: {
        ...GBA_ROM_FLASH_CMD_SET,
        read: (...args: Parameters<typeof rom_read>) => rom_read(...args),
        write: (...args: Parameters<typeof rom_write>) => rom_write(...args),
      },
      cfiEntryAddress: 0x55,
      romProgram: (device, data, addr, buf) => rom_program(device, data, addr, buf),
      romEraseSector: (device, addr) => rom_erase_sector(device, addr),
      cfiGetId: (device) => rom_get_id(device),
      toRomBank: (address) => {
        const bank = address >> 25;
        return { bank, cartAddress: address };
      },
      switchRomBank: async (_device, bank) => {
        await this.switchROMBank(bank);
      },
      needsRomBankSwitch: (cfiInfo) => cfiInfo.deviceSize > (1 << 25),
    };
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private buildRomSampleOffsets(logicalAddress: number, regionSize: number, sampleSize: number): number[] {
    if (regionSize <= 0 || sampleSize <= 0) {
      return [];
    }

    const maxOffset = Math.max(0, regionSize - sampleSize);
    const sampleSlots = maxOffset + 1;
    const sampleCount = Math.min(GBAAdapter.ROM_WRITE_SAMPLE_COUNT, sampleSlots);
    const offsets = new Set<number>([0, maxOffset]);

    while (offsets.size < sampleCount) {
      offsets.add(Math.floor(Math.random() * sampleSlots));
    }

    return [...offsets].sort((a, b) => a - b);
  }

  private async sampleRomRegionBlank(
    logicalAddress: number,
    regionSize: number,
    isMultiBank: boolean,
  ): Promise<boolean> {
    const sampleSize = Math.min(GBAAdapter.ROM_WRITE_SAMPLE_BYTES, regionSize);
    const sampleOffsets = this.buildRomSampleOffsets(logicalAddress, regionSize, sampleSize);

    for (const offset of sampleOffsets) {
      const sampleAddress = logicalAddress + offset;
      const { bank, cartAddress } = this.romBankRelevantAddress(sampleAddress);
      const bankWindowRemaining = isMultiBank
        ? GBAAdapter.ROM_BANK_SIZE - (sampleAddress & (GBAAdapter.ROM_BANK_SIZE - 1))
        : sampleSize;
      const readSize = Math.min(sampleSize, regionSize - offset, bankWindowRemaining);
      const sample = await this.readROMChunkWithRetry(
        readSize,
        sampleAddress,
        cartAddress,
        offset + 1,
        bank,
        isMultiBank ? async () => { await this.switchROMBank(bank); } : undefined,
      );
      if (!sample.every(byte => byte === 0xff)) {
        return false;
      }
    }

    return true;
  }

  private async eraseRomSectorWithRetry(
    sector: SectorProgressInfo,
    isMultiBank: boolean,
    reason: 'prepare' | 'recover',
    signal?: AbortSignal,
  ): Promise<void> {
    const retries = AdvancedSettings.romEraseRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.romEraseRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (signal?.aborted) {
        throw new Error(this.t('messages.operation.cancelled'));
      }

      try {
        const { bank } = this.romBankRelevantAddress(sector.address);
        if (isMultiBank) {
          await this.switchROMBank(bank);
        }
        await rom_erase_sector(this.transport, sector.address);
        return;
      } catch (error) {
        lastError = error;
        this.log(
          errorToBurnerLog(
            `ROM sector erase retry ${attempt}/${attempts} @ ${formatHex(sector.address, 4)} (${reason})`,
            error,
          ),
          'warn',
        );

        if (attempt < attempts) {
          await this.stabilizeCommandChannel(GBAAdapter.ROM_ERASE_RETRY_RESET_MS);
          if (retryDelayMs > 0) {
            await timeout(retryDelayMs * attempt);
          }
        }
      }
    }

    throw new Error(
      `ROM sector erase retry exhausted at ${formatHex(sector.address, 4)} `
      + `(${reason}): ${this.describeError(lastError)}`,
    );
  }

  /**
   * 鍏ㄧ墖鎿﹂櫎
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鍖呭惈鎴愬姛鐘舵€佸拰娑堟伅鐨勫璞?
   */
  override async eraseChip(options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'), 'info');

        try {
          // 妫€鏌ユ槸鍚﹀凡琚彇娑?
          if (signal?.aborted) {
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          await rom_erase_chip(this.transport);

          const startTime = Date.now();
          let elapsedSeconds = 0;

          // 楠岃瘉鎿﹂櫎鏄惁瀹屾垚
          const eraseDeadline = startTime + GBAAdapter.CHIP_ERASE_TIMEOUT_MS;
          while (Date.now() < eraseDeadline) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              this.log(this.t('messages.operation.cancelled'), 'warn');
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const eraseComplete = await this.isBlank(0x00, 0x100);
            elapsedSeconds = Date.now() - startTime;
            if (eraseComplete) {
              this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedSeconds / 1000).toFixed(1)}s)`, 'success');
              break;
            } else {
              this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedSeconds / 1000).toFixed(1)}s)`, 'info');
              await timeout(1000);
            }
          }
          if (Date.now() >= eraseDeadline) {
            throw new Error(`Chip erase timeout after ${GBAAdapter.CHIP_ERASE_TIMEOUT_MS / 1000}s`);
          }

          return {
            success: true,
            message: this.t('messages.operation.eraseComplete'),
          };
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'warn');
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          this.log(errorToBurnerLog(this.t('messages.operation.eraseFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.operation.eraseFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'erase_chip',
      },
    );
  }

  /**
   * 鎿﹂櫎ROM鎵囧尯
   * @param sectorInfo - 鎵囧尯淇℃伅鏁扮粍
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鎿嶄綔缁撴灉
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
    allowSampleSkip = false,
  ): Promise<CommandResult> {
    const profile = this.firmwareProfile;
    if (!profile.capabilities.gbaSectorErase && !allowSampleSkip) {
      return firmwareUnsupportedResult('GBA ROM sector erase', profile);
    }

    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseSectors',
      async () => {
        // 璁＄畻鎿﹂櫎鑼冨洿淇℃伅
        const minStartAddress = Math.min(...sectorInfo.map(info => info.startAddress));
        const maxEndAddress = Math.max(...sectorInfo.map(info => info.endAddress));
        const totalSectors = sectorInfo.reduce((sum, info) => sum + info.sectorCount, 0);
        const sectorSizes = [...new Set(sectorInfo.map(info => info.sectorSize))];
        const sectorSizeStr = sectorSizes.length === 1
          ? `${sectorSizes[0]}`
          : sectorSizes.join('/');

        this.log(this.t('messages.operation.startEraseSectors', {
          startAddress: formatHex(minStartAddress, 4),
          endAddress: formatHex(maxEndAddress - 1, 4),
          sectorSize: sectorSizeStr,
        }), 'info');
        const isMultiBank = options.cfiInfo.deviceSize > GBAAdapter.ROM_BANK_SIZE;

        try {
          let currentBank = -1;
          let eraseCount = 0;

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          // 鍒涘缓鎵囧尯杩涘害淇℃伅
          const sectors = this.initializeSectorProgress(sectorInfo);

          // 璁＄畻鎬诲瓧鑺傛暟
          const totalBytes = sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0);

          // 鍒涘缓杩涘害鎶ュ憡鍣?
          const progressReporter = new ProgressReporter(
            'erase',
            totalBytes,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(this.currentSectorProgress);

          // 鎶ュ憡寮€濮嬬姸鎬?
          progressReporter.reportStart(this.t('messages.operation.startEraseSectors'));

          // 鎸夌収鍒涘缓鐨勬墖鍖洪『搴忚繘琛屾摝闄わ紙浠庨珮鍦板潃鍒颁綆鍦板潃锛?
          for (const sector of sectors) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            // 鏇存柊褰撳墠鎵囧尯鐘舵€佷负"姝ｅ湪澶勭悊"
            const currentSpeedBeforeErase = speedCalculator.getCurrentSpeed();
            progressReporter.markSectorState(sector.address, 'erasing');
            progressReporter.emitProgress(
              eraseCount * sector.size,
              currentSpeedBeforeErase,
              this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeedBeforeErase) }),
              sector.address,
            );

            const { bank } = this.romBankRelevantAddress(sector.address);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            let skippedBySample = false;
            if (allowSampleSkip) {
              const sampleBlank = await this.sampleRomRegionBlank(sector.address, sector.size, isMultiBank);
              skippedBySample = sampleBlank;
            }

            if (skippedBySample) {
              this.log({
                message: this.t('messages.operation.eraseSector', {
                  from: formatHex(sector.address, 4),
                  to: formatHex(sector.address + sector.size - 1, 4),
                }),
                details: this.t('messages.operation.eraseSectorSkipped', {
                  samples: `${GBAAdapter.ROM_WRITE_SAMPLE_COUNT}x${GBAAdapter.ROM_WRITE_SAMPLE_BYTES}B`,
                }),
              }, 'info');
            } else {
              if (!profile.capabilities.gbaSectorErase) {
                const unsupported = firmwareUnsupportedResult('GBA ROM sector erase', profile);
                progressReporter.reportError(unsupported.message);
                this.log(unsupported.message, 'error');
                return unsupported;
              }
              this.log(this.t('messages.operation.eraseSector', {
                from: formatHex(sector.address, 4),
                to: formatHex(sector.address + sector.size - 1, 4),
              }), 'info');
              await this.eraseRomSectorWithRetry(sector, isMultiBank, 'prepare', signal);
            }
            const sectorEndTime = Date.now();

            // 鏇存柊褰撳墠鎵囧尯鐘舵€佷负"宸插畬鎴?鎴?宸茶烦杩囨摝闄?
            progressReporter.markSectorState(sector.address, skippedBySample ? 'skipped_erase' : 'erased');

            eraseCount++;
            const erasedBytes = eraseCount * sector.size;

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(sector.size, sectorEndTime);

            // 璁＄畻褰撳墠閫熷害
            const currentSpeed = speedCalculator.getCurrentSpeed();

            // 鎶ュ憡杩涘害
            progressReporter.emitProgress(
              erasedBytes,
              currentSpeed,
              this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
              sector.address,
            );
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.operation.eraseSuccess'), 'success');
          this.log(this.t('messages.operation.eraseSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSectors: totalSectors,
          }), 'info');

          // 鎶ュ憡瀹屾垚鐘舵€?
          progressReporter.reportCompleted(this.t('messages.operation.eraseSuccess'), avgSpeed);

          return {
            success: true,
            message: this.t('messages.operation.eraseSuccess'),
          };
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'warn');
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          // Reset sector progress so stale UI state doesn't persist into the next operation.
          this.resetSectorsState();

          const progressReporter = new ProgressReporter(
            'erase',
            sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0),
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          const errorLog = errorToBurnerLog(this.t('messages.operation.eraseSectorFailed'), e);
          const errorMessage = this.summarizeLogMessage(errorLog);
          progressReporter.reportError(errorMessage);
          this.log(errorLog, 'error');
          return {
            success: false,
            message: errorMessage,
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'erase_sectors',
      },
    );
  }

  /**
   * 鍐欏叆ROM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 鍐欏叆閫夐」
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鎿嶄綔缁撴灉
   */
  override async writeROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const bufferSize = options.cfiInfo.bufferSize ?? 0;
    const isMultiBank = options.cfiInfo.deviceSize > GBAAdapter.ROM_BANK_SIZE;

    this.log(this.t('messages.operation.startWriteROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
      pageSize,
      bufferSize,
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.writeROM',
      async () => {
        try {
          const total = options.size ?? fileData.byteLength;
          const wallClockStartTime = Date.now();
          let written = 0;
          this.log(this.t('messages.rom.writing', { size: total }), 'info');

          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          const eraseStartTime = Date.now();
          const eraseResult = await this.eraseSectors(sectorInfo, options, signal, true);
          const eraseDuration = Date.now() - eraseStartTime;
          if (!eraseResult.success) {
            return eraseResult;
          }

          this.currentSectorProgress = this.currentSectorProgress.map((sector) => ({
            ...sector,
            state: 'pending' as const,
          }));
          const sectors = this.currentSectorProgress;
          const speedCalculator = new SpeedCalculator();
          const progressReporter = new ProgressReporter(
            'write',
            total,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(this.currentSectorProgress);
          progressReporter.reportStart(this.t('messages.rom.writing', { size: total }));

          let lastLoggedProgress = -1;
          let chunkCount = 0;
          let currentBank = -1;
          const sectorWriteRetryCounts = new Map<number, number>();
          const writeEndAddressExclusive = baseAddress + total;

          const recoverSectorWrite = async (sectorIndex: number, reason: unknown): Promise<void> => {
            const sector = sectors[sectorIndex];
            const retriesUsed = sectorWriteRetryCounts.get(sector.address) ?? 0;
            const maxRetries = AdvancedSettings.romWriteRetryCount;
            const retryLog = errorToBurnerLog(
              `ROM write retry ${retriesUsed + 1}/${maxRetries + 1} @ ${formatHex(sector.address, 4)}`,
              reason,
            );
            const writeFailureMessage = this.summarizeLogMessage(
              errorToBurnerLog(this.t('messages.rom.writeFailed'), reason),
            );

            if (retriesUsed >= maxRetries) {
              throw new Error(`ROM write retries exhausted @ ${formatHex(sector.address, 4)}: ${this.describeError(reason)}`);
            }

            const nextRetry = retriesUsed + 1;
            sectorWriteRetryCounts.set(sector.address, nextRetry);
            this.log(retryLog, 'warn');

            progressReporter.emitProgress(
              written,
              speedCalculator.getCurrentSpeed(),
              writeFailureMessage,
              sector.address,
            );

            await this.stabilizeCommandChannel(GBAAdapter.ROM_WRITE_RETRY_RESET_MS);
            if (AdvancedSettings.romWriteRetryDelayMs > 0) {
              await timeout(AdvancedSettings.romWriteRetryDelayMs * nextRetry);
            }
            progressReporter.markSectorState(sector.address, 'erasing');
            progressReporter.emitProgress(
              written,
              speedCalculator.getCurrentSpeed(),
              this.t('messages.operation.eraseSector', {
                from: formatHex(sector.address, 4),
                to: formatHex(sector.address + sector.size - 1, 4),
              }),
              sector.address,
            );
            await this.eraseRomSectorWithRetry(sector, isMultiBank, 'recover', signal);
            progressReporter.markSectorState(sector.address, 'pending');
            written = sector.address - baseAddress;
            chunkCount = 0;
            currentBank = -1;
          };

          while (written < total) {
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const currentAddress = baseAddress + written;
            const currentSectorIndex = progressReporter.getCurrentSectorIndexByAddress(currentAddress);
            if (currentSectorIndex < 0) {
              throw new Error(`No sector metadata for write address ${formatHex(currentAddress, 4)}`);
            }
            const currentSector = sectors[currentSectorIndex];
            const sectorWriteEnd = Math.min(writeEndAddressExclusive, currentSector.address + currentSector.size);

            const bankWindowRemaining = isMultiBank
              ? GBAAdapter.ROM_BANK_SIZE - (currentAddress & (GBAAdapter.ROM_BANK_SIZE - 1))
              : total - written;
            const chunkSize = Math.min(
              pageSize,
              total - written,
              sectorWriteEnd - currentAddress,
              bankWindowRemaining,
            );
            const chunk = fileData.subarray(written, written + chunkSize);
            if (chunk.byteLength === 0) {
              this.log(this.t('messages.rom.writeNoData'), 'warn');
              break;
            }

            const currentSpeedBeforeWrite = speedCalculator.getCurrentSpeed();
            progressReporter.markSectorState(currentSector.address, 'processing');
            progressReporter.emitProgress(
              written,
              currentSpeedBeforeWrite,
              this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeedBeforeWrite) }),
              currentAddress,
            );

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (isMultiBank) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            try {
              await rom_program(this.transport, chunk, cartAddress, bufferSize);
            } catch (error) {
              await recoverSectorWrite(currentSectorIndex, error);
              continue;
            }
            const chunkEndTime = Date.now();

            written += chunkSize;
            chunkCount++;

            if (written + baseAddress >= sectorWriteEnd) {
              progressReporter.markSectorState(currentSector.address, 'completed');
            }

            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            if (chunkCount % 10 === 0 || written >= total || written + baseAddress >= sectorWriteEnd) {
              const currentSpeed = speedCalculator.getCurrentSpeed();
              progressReporter.emitProgress(
                written,
                currentSpeed,
                this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeed) }),
                currentAddress,
              );
            }

            const progress = Math.floor((written / total) * 100);
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.rom.writingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
              lastLoggedProgress = progress;
            }
          }

          const transferTime = speedCalculator.getTotalTime();
          const totalTime = (Date.now() - wallClockStartTime) / 1000;
          const eraseTime = eraseDuration / 1000;
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.writeComplete'), 'success');
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: formatTimeDuration(totalTime),
            transferTime: formatTimeDuration(transferTime),
            eraseTime: formatTimeDuration(eraseTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(total),
          }), 'info');

          // 鎶ュ憡瀹屾垚鐘舵€?
          progressReporter.reportCompleted(this.t('messages.rom.writeComplete'), avgSpeed);

          return {
            success: true,
            message: this.t('messages.rom.writeSuccess'),
          };
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'write',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          const errorLog = errorToBurnerLog(this.t('messages.rom.writeFailed'), e);
          const errorMessage = this.summarizeLogMessage(errorLog);
          progressReporter.reportError(errorMessage);
          this.log(errorLog, 'error');
          return {
            success: false,
            message: errorMessage,
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'write_rom',
      },
      {
        fileSize: fileData.byteLength,
        baseAddress,
        bufferSize,
        pageSize,
      },
    );
  }

  /**
   * 璇诲彇ROM
   * @param size - 璇诲彇澶у皬
   * @param baseAddress - 鍩虹鍦板潃
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @param showProgress - 鏄惁鏄剧ず璇诲彇杩涘害闈㈡澘锛岄粯璁や负true
   * @returns - 鎿嶄綔缁撴灉锛屽寘鍚鍙栫殑鏁版嵁
   */
  override async readROM(size = 0x200000, options: CommandOptions, signal?: AbortSignal, showProgress = true) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const readThrottleMs = AdvancedSettings.romReadThrottleMs;
    const retries = AdvancedSettings.romReadRetryCount;
    const retryDelayMs = AdvancedSettings.romReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readROM',
      async () => {
        try {
          // 妫€鏌ユ槸鍚﹀凡琚彇娑?
          if (signal?.aborted) {
            const progressReporter = new ProgressReporter(
              'read',
              size,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
              showProgress,
            );
            progressReporter.reportError(this.t('messages.operation.cancelled'));
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          await this.stabilizeCommandChannel(GBAAdapter.ROM_READ_START_SETTLE_MS);
          this.log(this.t('messages.rom.reading'), 'info');
          let totalRead = 0;

          const data = new Uint8Array(size);

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          // 鍒涘缓杩涘害鎶ュ憡鍣?
          const progressReporter = new ProgressReporter(
            'read',
            size,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
            showProgress,
          );

          // 鎶ュ憡寮€濮嬬姸鎬?
          progressReporter.reportStart(this.t('messages.rom.reading'));

          // 鍒嗗潡璇诲彇浠ヤ究璁＄畻閫熷害缁熻
          let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
          let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟
          let currentBank = -1;

          while (totalRead < size) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, size - totalRead);
            const currentAddress = baseAddress + totalRead;

            // 璁＄畻bank鍜屽湴鍧€
            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            // 璇诲彇鏁版嵁
            const restoreState = options.cfiInfo.deviceSize > (1 << 25)
              ? async () => { await this.switchROMBank(bank); }
              : undefined;
            const chunk = await this.readROMChunkWithRetry(
              chunkSize,
              currentAddress,
              cartAddress,
              Math.floor(totalRead / pageSize) + 1,
              bank,
              restoreState,
            );
            const chunkEndTime = Date.now();
            data.set(chunk, totalRead);

            totalRead += chunkSize;
            chunkCount++;

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 姣?0娆℃搷浣滄垨鏈€鍚庝竴娆℃洿鏂拌繘搴?
            if (chunkCount % 10 === 0 || totalRead >= size) {
              // 璁＄畻褰撳墠閫熷害
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 鎶ュ憡杩涘害
              progressReporter.reportProgress(
                totalRead,
                currentSpeed,
                this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }),
              );
            }

            // 姣?涓櫨鍒嗘瘮璁板綍涓€娆℃棩蹇?
            const progress = Math.floor((totalRead / size) * 100);
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.rom.readingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
              lastLoggedProgress = progress;
            }

            if (totalRead < size && readThrottleMs > 0) {
              await timeout(readThrottleMs);
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
          this.log(this.t('messages.rom.readSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(size),
          }), 'info');

          // 鎶ュ憡瀹屾垚鐘舵€?
          progressReporter.reportCompleted(this.t('messages.rom.readSuccess', { size: data.length }), avgSpeed);

          return {
            success: true,
            data: data,
            message: this.t('messages.rom.readSuccess', { size: data.length }),
          };
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'read',
            size,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
            showProgress,
          );
          progressReporter.reportError(this.t('messages.rom.readFailed'));
          this.log(errorToBurnerLog(this.t('messages.rom.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.rom.readFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'read_rom',
      },
      {
        dataSize: size,
        baseAddress: baseAddress,
      },
    );
  }

  /**
   * 鏍￠獙ROM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param baseAddress - 鍩虹鍦板潃
   * @returns - 鎿嶄綔缁撴灉
   */
  override async verifyROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const readThrottleMs = AdvancedSettings.romReadThrottleMs;

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyROM',
      async () => {
        // 妫€鏌ユ槸鍚﹀凡琚彇娑?
        if (signal?.aborted) {
          const progressReporter = new ProgressReporter(
            'verify',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }
        try {
          await this.stabilizeCommandChannel(GBAAdapter.ROM_READ_START_SETTLE_MS);
          this.log(this.t('messages.rom.verifying'), 'info');

          const configuredSize = options.size ?? fileData.byteLength;
          const deviceSize = options.cfiInfo.deviceSize;
          const fileSize = fileData.byteLength;
          const total = Math.min(configuredSize, deviceSize, fileSize);
          if (configuredSize > deviceSize) {
            this.log(this.t('messages.rom.verifyClampedToDevice', {
              configured: formatBytes(configuredSize),
              device: formatBytes(deviceSize),
              actual: formatBytes(total),
            }), 'warn');
          }
          if (configuredSize > fileSize) {
            this.log(this.t('messages.rom.verifyClampedToFile', {
              configured: formatBytes(configuredSize),
              file: formatBytes(fileSize),
              actual: formatBytes(total),
            }), 'warn');
          }
          let verified = 0;
          let success = true;
          let failedAddress = -1;
          let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
          let currentBank = -1;
          let activeSectorIndex = -1;
          let completedSectorIndex = -1;
          const isMultiCard = options.cfiInfo.deviceSize > (1 << 25);

          // 鍒濆鍖栨墖鍖鸿繘搴︿俊鎭?(鐢ㄤ簬鏄剧ず鏍￠獙杩涘害鍙鍖?
          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          const sectors = this.initializeSectorProgress(sectorInfo);

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          // 鍒涘缓杩涘害鎶ュ憡鍣?
          const progressReporter = new ProgressReporter(
            'verify',
            total,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(sectors);

          // 鎶ュ憡寮€濮嬬姸鎬?
          progressReporter.reportStart(this.t('messages.rom.verifying'));

          // 鍒嗗潡鏍￠獙骞舵洿鏂拌繘搴?
          let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟
          while (verified < total && success) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, total - verified);
            const currentAddress = baseAddress + verified;

            while (
              activeSectorIndex + 1 < sectors.length
              && currentAddress >= sectors[activeSectorIndex + 1].address
            ) {
              activeSectorIndex++;
            }

            const enteredNewSector = activeSectorIndex >= 0
              && progressReporter.markSectorState(sectors[activeSectorIndex].address, 'processing') >= 0
              && (verified === 0 || verified === sectors[activeSectorIndex].address - baseAddress);

            if (enteredNewSector) {
              const currentSpeedBeforeVerify = speedCalculator.getCurrentSpeed();
              progressReporter.emitProgress(
                verified,
                currentSpeedBeforeVerify,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeedBeforeVerify) }),
                currentAddress,
              );
            }

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (isMultiCard) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            // 璇诲彇鏁版嵁
            const restoreState = isMultiCard
              ? async () => { await this.switchROMBank(bank); }
              : undefined;
            const actualChunk = await this.readROMChunkWithRetry(
              chunkSize,
              currentAddress,
              cartAddress,
              Math.floor(verified / pageSize) + 1,
              bank,
              restoreState,
            );
            const chunkEndTime = Date.now();

            // 閫愬瓧鑺傛瘮杈?
            for (let i = 0; i < chunkSize; i++) {
              const expectedByte = fileData[verified + i];
              const actualByte = actualChunk[i];
              if (expectedByte !== actualByte) {
                success = false;
                failedAddress = verified + i;
                this.log(this.t('messages.rom.verifyFailedAt', {
                  address: formatHex(failedAddress, 4),
                  expected: formatHex(expectedByte, 1),
                  actual: formatHex(actualByte, 1),
                }), 'error');
                if (activeSectorIndex >= 0) {
                  progressReporter.markSectorState(sectors[activeSectorIndex].address, 'error');
                }
                break;
              }
            }

            if (!success) break;

            verified += chunkSize;
            chunkCount++;

            const verifiedEndAddress = baseAddress + verified - 1;
            while (completedSectorIndex + 1 < sectors.length) {
              const nextSector = sectors[completedSectorIndex + 1];
              const nextSectorEnd = nextSector.address + nextSector.size - 1;
              if (nextSectorEnd > verifiedEndAddress) {
                break;
              }

              completedSectorIndex++;
              progressReporter.markSectorState(nextSector.address, 'completed');
            }

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 姣?0娆℃搷浣滄垨鏈€鍚庝竴娆℃洿鏂拌繘搴?
            if (chunkCount % 10 === 0 || verified >= total) {
              // 璁＄畻褰撳墠閫熷害
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 鎶ュ憡杩涘害
              progressReporter.emitProgress(
                verified,
                currentSpeed,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
                currentAddress,
              );
            }

            // 姣?%璁板綍涓€娆℃棩蹇?
            const progress = Math.floor((verified / total) * 100);
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.rom.verifyingAt', {
                address: formatHex(currentAddress, 4),
                progress,
              }), 'info');
              lastLoggedProgress = progress;
            }

            if (verified < total && readThrottleMs > 0) {
              await timeout(readThrottleMs);
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          if (success) {
            while (completedSectorIndex + 1 < sectors.length) {
              completedSectorIndex++;
              progressReporter.markSectorState(sectors[completedSectorIndex].address, 'completed');
            }

            this.log(this.t('messages.rom.verifySuccess'), 'success');
            this.log(this.t('messages.rom.verifySummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
            }), 'info');

            // 鎶ュ憡瀹屾垚鐘舵€?
            progressReporter.reportCompleted(this.t('messages.rom.verifySuccess'), avgSpeed);
          } else {
            this.log(this.t('messages.rom.verifyFailed'), 'error');
            progressReporter.reportError(this.t('messages.rom.verifyFailed'));
          }

          const message = success ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
          return {
            success: success,
            message: message,
          };
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'verify',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.reportError(this.t('messages.rom.verifyFailed'));
          this.log(errorToBurnerLog(this.t('messages.rom.verifyFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.rom.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'verify_rom',
      },
      {
        fileSize: fileData.byteLength,
        baseAddress: baseAddress,
      },
    );
  }

  /**
   * 鍐欏叆RAM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 鍐欏叆閫夐」
   * @returns - 鎿嶄綔缁撴灉
   */
  override async writeRAM(fileData: Uint8Array, options: CommandOptions): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);

    if (!isRamTypeSupportedByFirmware(this.firmwareProfile, 'gba', ramType)) {
      return firmwareUnsupportedResult('GBA FRAM RAM write', this.firmwareProfile);
    }

    // 濡傛灉鏄厤鐢靛瓨妗ｏ紝璋冪敤涓撻棬鐨勬柟娉?
    if (ramType === 'BATLESS') {
      return this.writeBatterylessSave(fileData, options);
    }

    this.log(this.t('messages.operation.startWriteRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.writeRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.writing', { size: fileData.byteLength }), 'info');

          const total = options.size ?? fileData.byteLength;
          let written = 0;
          if (ramType === 'FLASH') {
            this.log(this.t('messages.gba.erasingFlash'), 'info');
            await ram_erase_flash(this.transport);

            // 绛夊緟鎿﹂櫎瀹屾垚
            let erased = false;
            while (!erased) {
              const result = await ram_read(this.transport, 1);
              this.log(this.t('messages.gba.eraseStatus', { status: formatHex(result[0], 1) }), 'info');
              if (result[0] === 0xff) {
                this.log(this.t('messages.gba.eraseComplete'), 'success');
                erased = true;
              } else {
                await timeout(1000);
              }
            }
          }

          // 寮€濮嬪啓鍏?
          const startTime = Date.now();
          let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
          let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          while (written < total) {
            // 鍒嘼ank
            if (written === 0x00000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
            } else if (written === 0x10000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(1);
              } else {
                await this.switchSRAMBank(1);
              }
            }

            const baseAddr = written & 0xffff;

            // 鍒嗗寘
            const remainingSize = total - written;
            const chunkSize = Math.min(pageSize, remainingSize);
            const chunk = fileData.subarray(written, written + chunkSize);

            // 鏍规嵁RAM绫诲瀷閫夋嫨鍐欏叆鏂规硶
            if (ramType === 'FLASH') {
              await ram_program_flash(this.transport, chunk, baseAddr);
            } else if (ramType === 'FRAM') {
              const latency = options.framLatency ?? 25;
              await ram_write_fram(this.transport, chunk, baseAddr, latency);
            } else {
              await ram_write(this.transport, chunk, baseAddr);
            }
            const chunkEndTime = Date.now();

            written += chunkSize;
            chunkCount++;

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            const progress = Math.floor((written / total) * 100);

            // 姣?涓櫨鍒嗘瘮璁板綍涓€娆℃棩蹇?
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.ram.writingAt', { address: formatHex(written, 4), progress }), 'info');
              lastLoggedProgress = progress;
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.writeComplete'), 'success');
          this.log(this.t('messages.ram.writeSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(total),
          }), 'info');

          return {
            success: true,
            message: this.t('messages.ram.writeSuccess'),
          };
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.writeFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.writeFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'write_ram',
        ram_type: ramType,
      },
      {
        fileSize: fileData.byteLength,
        base_address: baseAddress,
      },
    );
  }

  /**
   * 璇诲彇RAM
   * @param size - 璇诲彇澶у皬
   * @param options - 璇诲彇鍙傛暟
   * @returns - 鎿嶄綔缁撴灉锛屽寘鍚鍙栫殑鏁版嵁
   */
  override async readRAM(size = 0x8000, options: CommandOptions) {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);
    const readThrottleMs = AdvancedSettings.ramReadThrottleMs;

    if (!isRamTypeSupportedByFirmware(this.firmwareProfile, 'gba', ramType)) {
      return firmwareUnsupportedResult('GBA FRAM RAM read', this.firmwareProfile);
    }

    // 濡傛灉鏄厤鐢靛瓨妗ｏ紝璋冪敤涓撻棬鐨勬柟娉?
    if (ramType === 'BATLESS') {
      return this.readBatterylessSave(options);
    }

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readRAM',
      async () => {
        try {
          await this.stabilizeCommandChannel(GBAAdapter.RAM_READ_START_SETTLE_MS);
          this.log(`RAM read channel synchronized (${GBAAdapter.RAM_READ_START_SETTLE_MS}ms settle)`, 'info');
          this.log(this.t('messages.ram.reading'), 'info');

          const result = new Uint8Array(size);
          let read = 0;
          const retryAttempts = AdvancedSettings.ramReadRetryCount + 1;
          const retryDelayMs = AdvancedSettings.ramReadRetryDelayMs;
          const restoreRAMBankState = async (absoluteAddress: number): Promise<void> => {
            const bank = absoluteAddress >= 0x10000 ? 1 : 0;
            if (ramType === 'FLASH') {
              await this.switchFlashBank(bank);
            } else {
              await this.switchSRAMBank(bank);
            }
          };
          const readChunkWithRetry = async (chunkSize: number, baseAddr: number, absoluteAddress: number): Promise<Uint8Array> => {
            let lastError: unknown;

            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
              try {
                return ramType === 'FRAM'
                  ? await ram_read_fram(this.transport, chunkSize, baseAddr, options.framLatency ?? 25)
                  : await ram_read(this.transport, chunkSize, baseAddr);
              } catch (error) {
                lastError = error;
                this.log(
                  errorToBurnerLog(
                    `RAM chunk read retry ${attempt}/${retryAttempts} @ ${formatHex(baseAddr, 4)} (${chunkSize}B)`,
                    error,
                  ),
                  'warn',
                );

                if (attempt < retryAttempts) {
                  await this.stabilizeCommandChannel(GBAAdapter.RAM_READ_RETRY_RESET_MS);
                  await restoreRAMBankState(absoluteAddress);
                  this.log(`RAM chunk channel resynchronized before retry @ ${formatHex(baseAddr, 4)}`, 'info');
                  if (retryDelayMs > 0) {
                    await timeout(retryDelayMs * attempt);
                  }
                }
              }
            }

            throw lastError instanceof Error ? lastError : new Error(String(lastError));
          };

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          while (read < size) {
            // 鍒嘼ank
            if (read === 0x00000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
              this.log(`RAM bank ready @ ${formatHex(read, 4)}`, 'info');
            } else if (read === 0x10000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(1);
              } else {
                await this.switchSRAMBank(1);
              }
              this.log(`RAM bank ready @ ${formatHex(read, 4)}`, 'info');
            }

            const baseAddr = read & 0xffff;

            // 鍒嗗寘
            const remainingSize = size - read;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 璇诲彇鏁版嵁
            const chunk = await readChunkWithRetry(chunkSize, baseAddr, read);
            const chunkEndTime = Date.now();
            result.set(chunk, read);

            read += chunkSize;

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            if (read < size && readThrottleMs > 0) {
              await timeout(readThrottleMs);
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.readSuccess', { size: result.length }), 'success');
          this.log(this.t('messages.ram.readSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(size),
          }), 'info');

          return {
            success: true,
            data: result,
            message: this.t('messages.ram.readSuccess', { size: result.length }),
          };
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.readFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'read_ram',
        ram_type: ramType ?? 'SRAM',
      },
      {
        dataSize: size,
        base_address: baseAddress,
      },
    );
  }

  /**
   * 鏍￠獙RAM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 閫夐」瀵硅薄
   * @returns - 鎿嶄綔缁撴灉
   */
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions) {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const size = options.size ?? fileData.byteLength;

    if (!isRamTypeSupportedByFirmware(this.firmwareProfile, 'gba', ramType)) {
      return firmwareUnsupportedResult('GBA FRAM RAM verify', this.firmwareProfile);
    }

    // 濡傛灉鏄厤鐢靛瓨妗ｏ紝璋冪敤涓撻棬鐨勬柟娉?
    if (ramType === 'BATLESS') {
      return this.verifyBatterylessSave(fileData, options);
    }

    this.log(this.t('messages.operation.startVerifyRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.verifying'), 'info');
          let success = true;

          const readResult = await this.readRAM(size, options);
          if (readResult.success && readResult.data) {
            const ramData = readResult.data;
            for (let i = 0; i < size; i++) {
              if (fileData[i] !== ramData[i]) {
                this.log(this.t('messages.ram.verifyFailedAt', {
                  address: formatHex(i, 4),
                  expected: formatHex(fileData[i], 1),
                  actual: formatHex(ramData[i], 1),
                }), 'error');
                success = false;
                break;
              }
            }
          }

          const message = success ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');
          this.log(`${this.t('messages.ram.verify')}: ${message}`, success ? 'success' : 'error');

          return {
            success: success,
            message,
          };
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.verifyFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'verify_ram',
        ram_type: ramType ?? 'SRAM',
      },
      {
        file_size: fileData.byteLength,
      },
    );
  }

  /**
   * 鑾峰彇鍗″甫淇℃伅
   * @returns 鍗″甫瀹归噺鐩稿叧淇℃伅
   */
  override async getCartInfo(): Promise<CFIInfo | false> {
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.getCartInfo',
      async () => {
        try {
          // CFI Query
          await rom_write(this.transport, toLittleEndian(0x98, 2), 0x55);
          const cfiData = await rom_read(this.transport, 0x100, 0x00);
          // Reset
          await rom_write(this.transport, toLittleEndian(0xf0, 2), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.log(this.t('messages.operation.cfiParseFailed'), 'error');
            return false;
          }

          // 璇诲彇Flash ID骞舵坊鍔犲埌CFI淇℃伅涓?
          try {
            const flashId = await rom_get_id(this.transport);
            cfiInfo.flashId = flashId;
            const idStr = Array.from(flashId).map(x => x.toString(16).padStart(2, '0')).join(' ');
            const flashName = getFlashName([...flashId]);
            this.log(`Flash ID: ${idStr} (${flashName})`, 'info');
          } catch (e) {
            this.log(errorToBurnerLog(this.t('messages.operation.readIdFailed'), e), 'warn');
            // 鍗充娇Flash ID璇诲彇澶辫触锛屼篃缁х画杩斿洖CFI淇℃伅
          }

          // 璁板綍CFI瑙ｆ瀽缁撴灉
          this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
          this.log(cfiInfo.info, 'info');

          return cfiInfo;
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.operation.romSizeQueryFailed'), e), 'error');
          return false;
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'get_cart_info',
      },
    );
  }

  /**
   * ROM Bank 鍒囨崲
   */
  async switchROMBank(bank: number) : Promise<void> {
    if (bank < 0) return;
    const h = (bank & 0x0f) << 4;

    await ram_write(this.transport, new Uint8Array([h]), 0x02);
    await ram_write(this.transport, new Uint8Array([0x40]), 0x03);

    this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
  }

  romBankRelevantAddress(address: number) {
    const bank = address >> 25;
    const b = bank < 0 ? 0 : bank;

    return {
      bank: b,
      cartAddress: address,
    };
  }

  /**
   * 鍒囨崲SRAM鐨凚ank
   * @param bank - Bank缂栧彿 (0鎴?)
   */
  async switchSRAMBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;
    await rom_write(this.transport, toLittleEndian(bank, 2), 0x800000);
    await timeout(GBAAdapter.RAM_BANK_SWITCH_SETTLE_MS);
    this.log(this.t('messages.ram.bankSwitchSram', { bank }), 'info');
  }

  /**
   * 鍒囨崲Flash鐨凚ank
   * @param bank - Bank缂栧彿 (0鎴?)
   */
  async switchFlashBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;

    await ram_write(this.transport, new Uint8Array([0xaa]), 0x5555);
    await ram_write(this.transport, new Uint8Array([0x55]), 0x2aaa);
    await ram_write(this.transport, new Uint8Array([0xb0]), 0x5555); // FLASH_COMMAND_SWITCH_BANK
    await ram_write(this.transport, new Uint8Array([bank]), 0x0000);
    await timeout(GBAAdapter.RAM_BANK_SWITCH_SETTLE_MS);

    this.log(this.t('messages.gba.bankSwitchFlash', { bank }), 'info');
  }

  /**
   * 鍒嗗潡璇诲彇ROM鏁版嵁
   * @param size - 璇诲彇澶у皬
   * @param baseAddress - 鍩哄湴鍧€
   * @param chunkSize - 鍒嗗潡澶у皬
   * @returns 璇诲彇鐨勬暟鎹?
   */
  private async readROMChunked(size: number, baseAddress: number, chunkSize: number): Promise<Uint8Array> {
    if (size <= chunkSize) {
      // 鍗曟璇诲彇
      return await rom_read(this.transport, size, baseAddress);
    } else {
      // 鍒嗗潡璇诲彇
      const result = new Uint8Array(size);
      let offset = 0;

      while (offset < size) {
        const currentChunkSize = Math.min(chunkSize, size - offset);
        const chunkData = await rom_read(this.transport, currentChunkSize, baseAddress + offset);
        result.set(chunkData, offset);
        offset += currentChunkSize;
      }

      return result;
    }
  }

  /**
   * 鎼滅储鍏嶇數瀛樻。浣嶇疆鍜屽ぇ灏?
   * @param baseAddress - 鍩哄湴鍧€
   * @param options - 鍛戒护閫夐」
   * @returns 瀛樻。淇℃伅鎴杅alse
   */
  async searchBatteryless(baseAddress: number, options: CommandOptions): Promise<{ offset: number; size: number } | false> {
    try {
      const cfiInfo = options.cfiInfo;
      const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB
      const chunkSize = options.romPageSize ?? AdvancedSettings.romPageSize;

      // 鍒囨崲鍒扮浉搴旂殑bank
      if (isMultiCard) {
        const { bank } = this.romBankRelevantAddress(baseAddress);
        await this.switchROMBank(bank);
      }

      // 璇诲彇鍚姩鍚戦噺
      const boot = await this.readROMChunked(4, baseAddress, chunkSize);
      const bootVector = ((boot[0] | (boot[1] << 8) | (boot[2] << 16) | (boot[3] << 24)) >>> 0); // 浣跨敤鏃犵鍙峰彸绉荤‘淇濅负姝ｆ暟
      const bootVectorAddr = ((bootVector & 0x00FFFFFF) + 2) << 2;

      console.log(baseAddress, [...boot], bootVector, bootVectorAddr);

      // 鎼滅储鐩爣瀛楃涓?"<3 from Maniac"
      const targetBytes = new TextEncoder().encode('<3 from Maniac');
      const searchBuf = new Uint8Array(0x2000);

      // 鍒囨崲鍒板惎鍔ㄥ悜閲忓搴旂殑bank
      if (isMultiCard) {
        const { bank } = this.romBankRelevantAddress(baseAddress + bootVectorAddr);
        await this.switchROMBank(bank);
      }

      // 璇诲彇8KB鏁版嵁鐢ㄤ簬鎼滅储
      const searchData = await this.readROMChunked(0x2000, baseAddress + bootVectorAddr, chunkSize);
      searchBuf.set(searchData, 0);

      // 鎼滅储鐩爣瀛楃涓?
      for (let i = 0; i <= searchBuf.length - targetBytes.length; i++) {
        let found = true;
        for (let j = 0; j < targetBytes.length; j++) {
          if (searchBuf[i + j] !== targetBytes[j]) {
            found = false;
            break;
          }
        }

        if (found) {
          // 鎵惧埌鐩爣瀛楃涓诧紝璇诲彇payload澶у皬
          let payloadSize = searchBuf[i + 0x0e] | (searchBuf[i + 0x0f] << 8);
          if (payloadSize === 0) {
            payloadSize = 0x414;
          }

          const offset = baseAddress + bootVectorAddr + i + 0x10; // <3 from Maniac鍚庨潰鏄痯ayload鐨勫ぇ灏忓拰鏁版嵁
          const payloadStart = offset - payloadSize;

          // 鍒囨崲鍒皃ayload寮€濮嬪湴鍧€瀵瑰簲鐨刡ank
          if (isMultiCard) {
            const { bank } = this.romBankRelevantAddress(payloadStart);
            await this.switchROMBank(bank);
          }

          // 璇诲彇payload澶撮儴鑾峰彇瀛樻。澶у皬
          const payloadHeader = await this.readROMChunked(12, payloadStart, chunkSize);
          const size = payloadHeader[8] | (payloadHeader[9] << 8) | (payloadHeader[10] << 16) | (payloadHeader[11] << 24);

          this.log(this.t('messages.ram.batteryless.found', {
            offset: formatHex(offset, 4),
            size: formatBytes(size),
          }), 'success');

          return { offset, size };
        }
      }

      this.log(this.t('messages.ram.batteryless.notFound'), 'warn');
      return false;
    } catch (e) {
      this.log(errorToBurnerLog(this.t('messages.ram.batteryless.searchFailed'), e), 'error');
      return false;
    }
  }

  /**
   * 鍐欏叆鍏嶇數瀛樻。
   * @param fileData - 瀛樻。鏂囦欢鏁版嵁
   * @param options - 鍐欏叆閫夐」
   * @param signal - 鍙栨秷淇″彿
   * @returns 鎿嶄綔缁撴灉
   */
  async writeBatterylessSave(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;

    this.log(this.t('messages.operation.startWriteBatterylessSave', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.writeBatterylessSave',
      async () => {
        try {
          // 妫€鏌ユ槸鍚﹀凡琚彇娑?
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          // 鑾峰彇CFI淇℃伅
          const cfiInfo = options.cfiInfo;
          if (!cfiInfo) {
            return { success: false, message: this.t('messages.operation.getCartInfoFailed') };
          }

          const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB

          // 鎼滅储鍏嶇數瀛樻。浣嶇疆
          const saveInfo = await this.searchBatteryless(baseAddress, options);
          if (!saveInfo) {
            return { success: false, message: this.t('messages.ram.batteryless.notFound') };
          }

          // 闄愬埗鍐欏叆澶у皬涓嶈秴杩囨娴嬪埌鐨勫瓨妗ｅぇ灏?
          const writeSize = Math.min(fileData.byteLength, saveInfo.size);
          console.log(writeSize, fileData.byteLength, saveInfo.size);
          this.log(this.t('messages.ram.batteryless.info', {
            offset: formatHex(saveInfo.offset, 4),
            size: formatBytes(saveInfo.size),
            writeSize: formatBytes(writeSize),
          }), 'info');

          // 鎿﹂櫎瀛樻。鍖哄煙
          this.log(this.t('messages.ram.batteryless.erase', {
            startAddress: formatHex(saveInfo.offset, 6),
            endAddress: formatHex(saveInfo.offset + writeSize, 6),
          }), 'info');

          const sectorInfo = calcSectorUsage(cfiInfo.eraseSectorBlocks, writeSize, saveInfo.offset);
          const eraseResult = await this.eraseSectors(sectorInfo, options, signal);
          if (!eraseResult.success) {
            return eraseResult;
          }

          // 寮€濮嬪啓鍏?
          this.log(this.t('messages.ram.batteryless.startWrite'), 'info');

          let written = 0;
          let currentBank = -1;
          const pageSize = this.resolveRomPageSize(options.romPageSize);

          const speedCalculator = new SpeedCalculator();

          while (written < writeSize) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, writeSize - written);
            const chunk = fileData.subarray(written, written + chunkSize);
            const currentAddress = saveInfo.offset + written;

            // 鍒囨崲bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 鍐欏叆鏁版嵁
            await rom_program(this.transport, chunk, currentAddress, cfiInfo.bufferSize ?? 0);
            const chunkEndTime = Date.now();

            written += chunkSize;
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.batteryless.writeComplete'), 'success');
          this.log(this.t('messages.ram.batteryless.writeSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(writeSize),
          }), 'info');

          return {
            success: true,
            message: this.t('messages.ram.batteryless.writeSuccess'),
          };
        } catch (e) {
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          this.log(errorToBurnerLog(this.t('messages.ram.batteryless.writeFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.batteryless.writeFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'write_batteryless_save',
      },
      {
        fileSize: fileData.byteLength,
      },
    );
  }

  /**
   * 璇诲彇鍏嶇數瀛樻。
   * @param options - 璇诲彇閫夐」
   * @param signal - 鍙栨秷淇″彿
   * @returns 鎿嶄綔缁撴灉锛屽寘鍚鍙栫殑鏁版嵁
   */
  async readBatterylessSave(options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;

    this.log(this.t('messages.operation.startReadBatterylessSave', {
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readBatterylessSave',
      async () => {
        try {
          // 妫€鏌ユ槸鍚﹀凡琚彇娑?
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          // 鑾峰彇CFI淇℃伅
          const cfiInfo = options.cfiInfo;
          if (!cfiInfo) {
            return { success: false, message: this.t('messages.operation.getCartInfoFailed') };
          }

          const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB

          // 鎼滅储鍏嶇數瀛樻。浣嶇疆
          const saveInfo = await this.searchBatteryless(baseAddress, options);
          if (!saveInfo) {
            return { success: false, message: this.t('messages.ram.batteryless.notFound') };
          }

          this.log(this.t('messages.ram.batteryless.info', {
            offset: formatHex(saveInfo.offset, 4),
            size: formatBytes(saveInfo.size),
          }), 'info');

          // 寮€濮嬭鍙?
          this.log(this.t('messages.ram.batteryless.startRead'), 'info');

          const data = new Uint8Array(saveInfo.size);
          let readCount = 0;
          let currentBank = -1;
          const pageSize = this.resolveRomPageSize(options.romPageSize);

          const speedCalculator = new SpeedCalculator();

          while (readCount < saveInfo.size) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, saveInfo.size - readCount);
            const currentAddress = saveInfo.offset + readCount;

            // 鍒囨崲bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 璇诲彇鏁版嵁
            const chunk = await rom_read(this.transport, chunkSize, currentAddress);
            const chunkEndTime = Date.now();
            data.set(chunk, readCount);

            readCount += chunkSize;
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.batteryless.readComplete', { size: formatBytes(data.length) }), 'success');
          this.log(this.t('messages.ram.batteryless.readSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(saveInfo.size),
          }), 'info');

          return {
            success: true,
            data: data,
            message: this.t('messages.ram.batteryless.readSuccess', { size: formatBytes(data.length) }),
          };
        } catch (e) {
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          this.log(errorToBurnerLog(this.t('messages.ram.batteryless.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.batteryless.readFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'read_batteryless_save',
      },
    );
  }

  /**
   * 鏍￠獙鍏嶇數瀛樻。
   * @param fileData - 瀛樻。鏂囦欢鏁版嵁
   * @param options - 鏍￠獙閫夐」
   * @param signal - 鍙栨秷淇″彿
   * @returns 鎿嶄綔缁撴灉
   */
  async verifyBatterylessSave(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;

    this.log(this.t('messages.operation.startVerifyBatterylessSave', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyBatterylessSave',
      async () => {
        try {
          this.log(this.t('messages.ram.verifying'), 'info');
          let success = true;

          const readResult = await this.readBatterylessSave(options, signal);
          if (readResult.success && readResult.data) {
            const saveData = readResult.data;
            const verifySize = Math.min(fileData.byteLength, saveData.length);

            for (let i = 0; i < verifySize; i++) {
              if (fileData[i] !== saveData[i]) {
                this.log(this.t('messages.ram.verifyFailedAt', {
                  address: formatHex(i, 4),
                  expected: formatHex(fileData[i], 1),
                  actual: formatHex(saveData[i], 1),
                }), 'error');
                success = false;
                break;
              }
            }
          } else {
            return readResult; // 杩斿洖璇诲彇澶辫触鐨勭粨鏋?
          }

          const message = success ? this.t('messages.ram.batteryless.verifySuccess') : this.t('messages.ram.batteryless.verifyFailed');
          this.log(`${this.t('messages.ram.verify')}: ${message}`, success ? 'success' : 'error');

          return {
            success: success,
            message,
          };
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.batteryless.verifyFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.batteryless.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'verify_batteryless_save',
      },
      {
        fileSize: fileData.byteLength,
      },
    );
  }

  // 妫€鏌ュ尯鍩熸槸鍚︿负绌?
  async isBlank(address: number, size = 0x100) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');

    const data = await rom_read(this.transport, size, address);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'success');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'warn');
    }

    return blank;
  }
}

// 榛樿瀵煎嚭
export default GBAAdapter;
