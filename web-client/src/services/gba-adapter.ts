import { firmwareUnsupportedResult } from '@/device/compat/firmware-profile';
import {
  boost_configure_amd_flash,
  boost_enter_mode,
  boost_program_flash,
  boost_program_save,
  boost_read_ram,
  boost_read_rom,
  boost_write_ram,
  boost_write_units,
  FLASH_CMD_RESET,
  flashEraseSector,
  flashGetId,
  GBA_FLASH_ADDR_1,
  GBA_FLASH_ADDR_2,
  GBA_ROM_FLASH_CMD_SET,
  getFlashName,
  ram_erase_flash,
  ram_program_flash,
  ram_read,
  ram_read_fram,
  ram_write,
  ram_write_fram,
  rom_erase_sector,
  rom_get_id,
  rom_program,
  rom_read,
  rom_write,
  toLittleEndian,
} from '@/protocol';
import { planBankChunk } from '@/services/bank-chunk-planner';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import type { PlatformOps } from '@/services/platform-ops';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import type { SectorProgressInfo } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { errorToBurnerLog } from '@/utils/burner-log';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { PerformanceTracker } from '@/utils/monitoring/sentry-tracker';
import { CFIInfo, parseCFI, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';
import { calcSectorUsage, getExtraErasedBytes } from '@/utils/sector-utils';
import { isAllErasedBytes, nextChunkSize, prepareRomImage } from '@/utils/transfer-plan';

/**
 * GBA Adapter - 封装GBA卡带的协议操作
 */
export class GBAAdapter extends CartridgeAdapter {
  private static readonly ROM_BANK_SIZE = 1 << 25;
  private static readonly RAM_BANK_SWITCH_SETTLE_MS = 100;
  private static readonly CHIP_ERASE_TIMEOUT_MS = 120_000;

  /**
   * 构造函数
   * @param device - 设备对象
   * @param logCallback - 日志回调函数
   * @param progressCallback - 进度回调函数
   * @param translateFunc - 国际化翻译函数
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
    const boost = this.isBoostMode;
    return {
      platformId: 'gba',
      flashCmdSet: {
        ...GBA_ROM_FLASH_CMD_SET,
        read: boost
          ? (transport, size, baseAddress) => boost_read_rom(transport, 'agb', size, baseAddress)
          : (...args: Parameters<typeof rom_read>) => rom_read(...args),
        write: boost
          ? async (transport, data, baseAddress) => {
            const units: { address: number; value: number }[] = [];
            for (let i = 0; i < data.byteLength; i += 2) {
              const lo = data[i] ?? 0;
              const hi = data[i + 1] ?? 0;
              units.push({ address: baseAddress + (i >>> 1), value: lo | (hi << 8) });
            }
            await boost_write_units(transport, true, units);
          }
          : (...args: Parameters<typeof rom_write>) => rom_write(...args),
      },
      cfiEntryAddress: 0x55,
      romBankSize: GBAAdapter.ROM_BANK_SIZE,
      cfiGetId: boost
        ? (device) => flashGetId(device, this.ops.flashCmdSet, [{ address: 0x00, size: 4 }, { address: 0x1c, size: 4 }])
        : (device) => rom_get_id(device),
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

  private async eraseRomSectorWithRetry(
    sector: SectorProgressInfo,
    isMultiBank: boolean,
    reason: 'prepare' | 'recover',
    signal?: AbortSignal,
  ): Promise<void> {
    const retries = this.settings.romEraseRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = this.settings.romEraseRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (signal?.aborted) {
        throw new Error(this.t('messages.operation.cancelled'));
      }

      try {
        if (this.isBoostMode) {
          const alignedSectorAddress = sector.address & ~1;
          await flashEraseSector(this.transport, this.ops.flashCmdSet, alignedSectorAddress >>> 1, alignedSectorAddress, {
            pollBytes: 2,
            pollIntervalMs: 20,
            timeoutMs: 60_000,
          });
        } else {
          await rom_erase_sector(this.transport, sector.address);
        }
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
   * 全片擦除
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    if (!this.supports('rom.erase.sector')) {
      return firmwareUnsupportedResult('GBA ROM sector erase', this.firmwareProfile);
    }
    if (sectorInfo.length === 0) {
      return {
        success: false,
        errorCode: 'unsupported',
        message: `${this.t('messages.operation.eraseFailed')}: cartridge has no sector erase geometry`,
      };
    }

    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseSectors',
      async () => {
        // 计算擦除范围信息
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
          if (this.isBoostMode) {
            await boost_enter_mode(this.transport, 'agb');
          } else {
            await this.ensureDefaultProtocolMode();
          }
          let currentBank = -1;
          let eraseCount = 0;

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 创建扇区进度信息
          const sectors = this.initializeSectorProgress(sectorInfo);

          // 计算总字节数
          const totalBytes = sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0);

          // 创建进度报告器
          const progressReporter = new ProgressReporter(
            'erase',
            totalBytes,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(this.currentSectorProgress);

          // 报告开始状态
          progressReporter.reportStart(this.t('messages.operation.startEraseSectors'));

          // 按照创建的扇区顺序进行擦除（从高地址到低地址）
          for (const sector of sectors) {
            // 检查是否已被取消
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            // 更新当前扇区状态为"擦除中"
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

            this.log(this.t('messages.operation.eraseSector', {
              from: formatHex(sector.address, 4),
              to: formatHex(sector.address + sector.size - 1, 4),
            }), 'info');
            await this.eraseRomSectorWithRetry(sector, isMultiBank, 'prepare', signal);
            const sectorEndTime = Date.now();

            // 更新当前扇区状态为"已完成"
            progressReporter.markSectorState(sector.address, 'erased');

            eraseCount++;
            const erasedBytes = eraseCount * sector.size;

            // 添加数据点到速度计算
            speedCalculator.addDataPoint(sector.size, sectorEndTime);

            // 计算当前速度
            const currentSpeed = speedCalculator.getCurrentSpeed();

            // 报告进度
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

          // 报告完成状态
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
   * 写入ROM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
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
          const image = prepareRomImage(fileData, total);
          const wallClockStartTime = Date.now();
          let written = 0;
          this.log(this.t('messages.rom.writing', { size: total }), 'info');

          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          const extraErase = getExtraErasedBytes(sectorInfo, baseAddress, total);
          if (extraErase) {
            this.log(
              `Partial sector coverage: erasing [${formatHex(extraErase.eraseStart, 4)}, ${formatHex(extraErase.eraseEnd, 4)}) `
              + `(headExtra=${extraErase.headExtra}B, tailExtra=${extraErase.tailExtra}B)`,
              'warn',
            );
          }
          const eraseStartTime = Date.now();
          const eraseResult = await this.eraseSectors(sectorInfo, options, signal);
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
          const useBoostProgram = this.isBoostMode && !options.cfiInfo.isIntel;
          if (useBoostProgram) {
            await boost_enter_mode(this.transport, 'agb');
            await boost_configure_amd_flash(this.transport, {
              unlockAddr1: GBA_FLASH_ADDR_1,
              unlockAddr2: GBA_FLASH_ADDR_2,
              buffered: bufferSize > 0,
              swapD0D1: options.cfiInfo.isSwapD0D1,
            });
          } else {
            await this.ensureDefaultProtocolMode();
          }
          progressReporter.reportStart(this.t('messages.rom.writing', { size: total }));

          let lastLoggedProgress = -1;
          let chunkCount = 0;
          let programRequests = 0;
          let retryCount = 0;
          let skippedBytes = 0;
          let currentBank = -1;
          const writeEndAddressExclusive = baseAddress + total;

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

            const chunkSize = nextChunkSize({
              address: currentAddress,
              remaining: total - written,
              pageSize,
              bankSize: isMultiBank ? GBAAdapter.ROM_BANK_SIZE : undefined,
              sectorEnd: sectorWriteEnd,
              bufferSize,
            });
            const chunk = image.subarray(written, written + chunkSize);
            if (chunk.byteLength === 0) {
              this.log(this.t('messages.rom.writeNoData'), 'warn');
              break;
            }

            if (isAllErasedBytes(chunk)) {
              written += chunkSize;
              skippedBytes += chunkSize;
              chunkCount++;
              if (written + baseAddress >= sectorWriteEnd) {
                progressReporter.markSectorState(currentSector.address, 'completed');
              }
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
              continue;
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

            const { attemptsUsed, retriesPerformed } = await this.programRomChunkWithRetry(
              () => (useBoostProgram
                ? boost_program_flash(this.transport, 'agb', cartAddress, bufferSize, chunk)
                : rom_program(this.transport, chunk, cartAddress, bufferSize)),
              currentAddress,
              signal,
              useBoostProgram
                ? async () => {
                  await boost_enter_mode(this.transport, 'agb');
                  await boost_configure_amd_flash(this.transport, {
                    unlockAddr1: GBA_FLASH_ADDR_1,
                    unlockAddr2: GBA_FLASH_ADDR_2,
                    buffered: bufferSize > 0,
                    swapD0D1: options.cfiInfo.isSwapD0D1,
                  });
                  if (isMultiBank) {
                    await this.switchROMBank(bank);
                  }
                }
                : undefined,
            );
            programRequests += attemptsUsed;
            retryCount += retriesPerformed;
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

          const totalTime = (Date.now() - wallClockStartTime) / 1000;
          const eraseTime = eraseDuration / 1000;
          const transferTime = speedCalculator.getTotalTime() || Math.max(0, totalTime - eraseTime);
          const avgSpeed = transferTime > 0 ? total / transferTime : 0;
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.writeComplete'), 'success');
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: formatTimeDuration(totalTime),
            transferTime: formatTimeDuration(transferTime),
            eraseTime: formatTimeDuration(eraseTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(total),
            programRequests,
            retryCount,
            skippedBytes: formatBytes(skippedBytes),
          }), 'info');

          // 报告完成状态
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
   * 读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @param signal - 取消信号，用于中止操作
   * @param showProgress - 是否显示读取进度面板，默认为true
   * @returns - 操作结果，包含读取的数据
   */
  override async readROM(size = 0x200000, options: CommandOptions, signal?: AbortSignal, showProgress = true) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomReadPageSize(options.romPageSize);
    const readThrottleMs = this.settings.romReadThrottleMs;
    const retries = this.settings.romReadRetryCount;
    const retryDelayMs = this.settings.romReadRetryDelayMs;
    const timeoutMs = this.settings.packageReceiveTimeout;

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readROM',
      async () => {
        try {
          // 检查是否已被取消
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

          await this.stabilizeReadChannel(options, GBAAdapter.ROM_READ_START_SETTLE_MS);
          if (this.isBoostMode) {
            await boost_enter_mode(this.transport, 'agb');
          }
          this.log(this.t('messages.rom.reading'), 'info');
          let totalRead = 0;

          const data = new Uint8Array(size);

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 创建进度报告器
          const progressReporter = new ProgressReporter(
            'read',
            size,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
            showProgress,
          );

          // 报告开始状态
          progressReporter.reportStart(this.t('messages.rom.reading'));

          // 分块读取以便计算速度统计
          let lastLoggedProgress = -1; // 初始化为 -1，确保第一次 0% 会被记录
          let chunkCount = 0; // 记录已处理的块数
          let currentBank = -1;

          while (totalRead < size) {
            // 检查是否已被取消
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const currentAddress = baseAddress + totalRead;
            const isMultiCard = options.cfiInfo.deviceSize > (1 << 25);
            const { bank, cartAddress, chunkSize } = planBankChunk(currentAddress, size - totalRead, pageSize, { platform: 'gba', memory: 'rom' });
            if (isMultiCard) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.ensureRomBank(`gba:${bank}`, () => this.switchROMBank(bank));
              }
            }

            // 读取数据
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
              signal,
            );
            const chunkEndTime = Date.now();
            data.set(chunk, totalRead);

            totalRead += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || totalRead >= size) {
              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 报告进度
              progressReporter.reportProgress(
                totalRead,
                currentSpeed,
                this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }),
              );
            }

            // 每 5 个百分比记录一次日志
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
          const avgSpeed = totalTime > 0 ? size / totalTime : speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
          this.log(this.t('messages.rom.readSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(size),
            requestCount: chunkCount,
          }), 'info');

          // 报告完成状态
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
   * 校验ROM
   * @param fileData - 文件数据
   * @param baseAddress - 基础地址
   * @returns - 操作结果
   */
  override async verifyROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = this.resolveRomReadPageSize(options.romPageSize);
    const readThrottleMs = this.settings.romReadThrottleMs;

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyROM',
      async () => {
        // 检查是否已被取消
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
          if (!this.isBoostMode) {
            await this.stabilizeCommandChannel(GBAAdapter.ROM_READ_START_SETTLE_MS);
          }
          this.log(this.t('messages.rom.verifying'), 'info');

          const configuredSize = options.size ?? fileData.byteLength;
          const deviceSize = options.cfiInfo.deviceSize;
          const availableDeviceSize = Math.max(0, deviceSize - baseAddress);
          const total = Math.min(configuredSize, availableDeviceSize);
          if (configuredSize > availableDeviceSize) {
            this.log(this.t('messages.rom.verifyClampedToDevice', {
              configured: formatBytes(configuredSize),
              device: formatBytes(deviceSize),
              actual: formatBytes(total),
            }), 'warn');
          }
          const image = prepareRomImage(fileData, total);
          let verified = 0;
          let success = true;
          let mismatchMessage = '';
          let lastLoggedProgress = -1; // 初始化为 -1，确保第一次 0% 会被记录
          let currentBank = -1;
          const isMultiCard = options.cfiInfo.deviceSize > (1 << 25);

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 创建进度报告器
          const progressReporter = new ProgressReporter(
            'verify',
            total,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );

          // 报告开始状态
          progressReporter.reportStart(this.t('messages.rom.verifying'));

          if (this.isBoostMode) {
            return await this.verifyROMWithBoostCrc32({
              mode: 'agb',
              image,
              baseAddress,
              total,
              readChunkSize: pageSize,
              isMultiBank: isMultiCard,
              switchBankInBoostMode: (bank) => this.switchROMBankInBoostMode(bank),
              progressReporter,
              speedCalculator,
              signal,
            });
          }

          // 分块校验并更新进度
          let chunkCount = 0; // 记录已处理的块数
          while (verified < total && success) {
            // 检查是否已被取消
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const currentAddress = baseAddress + verified;
            const { bank, cartAddress, chunkSize } = planBankChunk(currentAddress, total - verified, pageSize, { platform: 'gba', memory: 'rom' });

            if (isMultiCard) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.ensureRomBank(`gba:${bank}`, () => this.switchROMBank(bank));
              }
            }

            // 读取数据
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
              signal,
            );
            const chunkEndTime = Date.now();

            // 逐字节比较
            for (let i = 0; i < chunkSize; i++) {
              const expectedByte = image[verified + i];
              const actualByte = actualChunk[i];
              if (expectedByte !== actualByte) {
                success = false;
                const failedAddress = baseAddress + verified + i;
                mismatchMessage = this.t('messages.rom.verifyFailedAt', {
                  address: formatHex(failedAddress, 4),
                  expected: formatHex(expectedByte, 1),
                  actual: formatHex(actualByte, 1),
                });
                this.log(mismatchMessage, 'error');
                break;
              }
            }

            if (!success) break;

            verified += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || verified >= total) {
              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 报告进度
              progressReporter.reportProgress(
                verified,
                currentSpeed,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
              );
            }

            // 每5%记录一次日志
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
          const avgSpeed = totalTime > 0 ? total / totalTime : speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          if (success) {
            this.log(this.t('messages.rom.verifySuccess'), 'success');
            this.log(this.t('messages.rom.verifySummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
              requestCount: chunkCount,
            }), 'info');

            // 报告完成状态
            progressReporter.reportCompleted(this.t('messages.rom.verifySuccess'), avgSpeed);
          } else {
            const failureMessage = mismatchMessage || this.t('messages.rom.verifyFailed');
            if (!mismatchMessage) {
              this.log(failureMessage, 'error');
            }
            progressReporter.reportError(failureMessage);
          }

          const message = success ? this.t('messages.rom.verifySuccess') : (mismatchMessage || this.t('messages.rom.verifyFailed'));
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
   * 写入RAM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 操作结果
   */
  override async writeRAM(fileData: Uint8Array, options: CommandOptions): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);

    if (ramType === 'FRAM' && !this.supports('ram.fram.gba')) {
      return firmwareUnsupportedResult('GBA FRAM RAM write', this.firmwareProfile);
    }

    // 如果是免电存档，调用专门的方法
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

          const useBoostRam = this.isBoostMode && ramType !== 'FRAM';
          if (useBoostRam) {
            await boost_enter_mode(this.transport, 'agb');
          } else {
            await this.ensureDefaultProtocolMode();
          }
          const total = options.size ?? fileData.byteLength;
          let written = 0;
          if (ramType === 'FLASH') {
            this.log(this.t('messages.gba.erasingFlash'), 'info');
            if (useBoostRam) {
              await boost_write_units(this.transport, false, [
                { address: 0x5555, value: 0xaa },
                { address: 0x2aaa, value: 0x55 },
                { address: 0x5555, value: 0x80 },
                { address: 0x5555, value: 0xaa },
                { address: 0x2aaa, value: 0x55 },
                { address: 0x5555, value: 0x10 },
              ]);
            } else {
              await ram_erase_flash(this.transport);
            }

            // 等待擦除完成
            let erased = false;
            while (!erased) {
              const result = useBoostRam
                ? await boost_read_ram(this.transport, 1, 0)
                : await ram_read(this.transport, 1);
              this.log(this.t('messages.gba.eraseStatus', { status: formatHex(result[0], 1) }), 'info');
              if (result[0] === 0xff) {
                this.log(this.t('messages.gba.eraseComplete'), 'success');
                erased = true;
              } else {
                await timeout(1000);
              }
            }
          }

          // 开始写入
          const startTime = Date.now();
          let lastLoggedProgress = -1; // 初始化为 -1，确保第一次 0% 会被记录
          let chunkCount = 0; // 记录已处理的块数

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          let currentBank = -1;
          while (written < total) {
            const absoluteAddress = baseAddress + written;
            const { bank, cartAddress: baseAddr, chunkSize } = planBankChunk(
              absoluteAddress, total - written, pageSize, { platform: 'gba', memory: 'ram' },
            );
            if (bank !== currentBank) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(bank);
              } else {
                await this.switchSRAMBank(bank);
              }
              currentBank = bank;
            }
            const chunk = fileData.subarray(written, written + chunkSize);

            // 根据RAM类型选择写入方法
            if (ramType === 'FLASH') {
              if (useBoostRam) {
                await boost_program_save(this.transport, 1, baseAddr, chunk);
              } else {
                await ram_program_flash(this.transport, chunk, baseAddr);
              }
            } else if (ramType === 'FRAM') {
              const latency = options.framLatency ?? 25;
              await ram_write_fram(this.transport, chunk, baseAddr, latency);
            } else if (useBoostRam) {
              await boost_write_ram(this.transport, chunk, baseAddr);
            } else {
              await ram_write(this.transport, chunk, baseAddr);
            }
            const chunkEndTime = Date.now();

            written += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            const progress = Math.floor((written / total) * 100);

            // 每 5 个百分比记录一次日志
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
   * 读取RAM
   * @param size - 读取大小
   * @param options - 读取参数
   * @returns - 操作结果，包含读取的数据
   */
  override async readRAM(size = 0x8000, options: CommandOptions) {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);
    const readThrottleMs = this.settings.ramReadThrottleMs;

    if (ramType === 'FRAM' && !this.supports('ram.fram.gba')) {
      return firmwareUnsupportedResult('GBA FRAM RAM read', this.firmwareProfile);
    }

    // 如果是免电存档，调用专门的方法
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
          const useBoostRam = this.isBoostMode && ramType !== 'FRAM';
          if (useBoostRam) {
            this.markChannelBusy();
            await boost_enter_mode(this.transport, 'agb');
          } else {
            await this.ensureDefaultProtocolMode();
            await this.stabilizeCommandChannel(GBAAdapter.RAM_READ_START_SETTLE_MS);
            this.log(`RAM read channel synchronized (${GBAAdapter.RAM_READ_START_SETTLE_MS}ms settle)`, 'info');
          }
          this.log(this.t('messages.ram.reading'), 'info');

          const result = new Uint8Array(size);
          let read = 0;
          const retryAttempts = this.settings.ramReadRetryCount + 1;
          const retryDelayMs = this.settings.ramReadRetryDelayMs;
          const restoreRAMBankState = async (absoluteAddress: number): Promise<void> => {
            const { bank } = planBankChunk(absoluteAddress, 1, 1, { platform: 'gba', memory: 'ram' });
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
                if (ramType === 'FRAM') {
                  return await ram_read_fram(this.transport, chunkSize, baseAddr, options.framLatency ?? 25);
                }
                return useBoostRam
                  ? await boost_read_ram(this.transport, chunkSize, baseAddr)
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

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          let currentBank = -1;
          while (read < size) {
            const absoluteAddress = baseAddress + read;
            const { bank, cartAddress: baseAddr, chunkSize } = planBankChunk(
              absoluteAddress, size - read, pageSize, { platform: 'gba', memory: 'ram' },
            );
            if (bank !== currentBank) {
              await restoreRAMBankState(absoluteAddress);
              this.log(`RAM bank ready @ ${formatHex(absoluteAddress, 4)}`, 'info');
              currentBank = bank;
            }

            // 读取数据
            const chunk = await readChunkWithRetry(chunkSize, baseAddr, absoluteAddress);
            const chunkEndTime = Date.now();
            result.set(chunk, read);

            read += chunkSize;

            // 添加数据点到速度计算
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
   * 校验RAM
   * @param fileData - 文件数据
   * @param options - 选项对象
   * @returns - 操作结果
   */
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions) {
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const size = options.size ?? fileData.byteLength;

    if (ramType === 'FRAM' && !this.supports('ram.fram.gba')) {
      return firmwareUnsupportedResult('GBA FRAM RAM verify', this.firmwareProfile);
    }

    // 如果是免电存档，调用专门的方法
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
          let mismatchMessage = '';

          const readResult = await this.readRAM(size, options);
          if (!readResult.success || !readResult.data) {
            const failureMessage = readResult.message || this.t('messages.ram.verifyFailed');
            this.log(`${this.t('messages.ram.verify')}: ${failureMessage}`, 'error');
            return {
              success: false,
              message: failureMessage,
            };
          }

          const ramData = readResult.data;
          for (let i = 0; i < size; i++) {
            if (fileData[i] !== ramData[i]) {
              mismatchMessage = this.t('messages.ram.verifyFailedAt', {
                address: formatHex(baseAddress + i, 4),
                expected: formatHex(fileData[i], 1),
                actual: formatHex(ramData[i], 1),
              });
              this.log(mismatchMessage, 'error');
              success = false;
              break;
            }
          }

          const message = success ? this.t('messages.ram.verifySuccess') : (mismatchMessage || this.t('messages.ram.verifyFailed'));
          if (success || !mismatchMessage) {
            this.log(`${this.t('messages.ram.verify')}: ${message}`, success ? 'success' : 'error');
          }

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
   * 获取卡带信息
   * @returns 卡带容量相关信息
   */
  override async getCartInfo(): Promise<CFIInfo | false> {
    this.lastCartInfoError = undefined;
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.getCartInfo',
      async () => {
        try {
          if (this.isBoostMode) {
            await boost_enter_mode(this.transport, 'agb');
          } else {
            await this.ensureDefaultProtocolMode();
          }
          // CFI Query
          await this.ops.flashCmdSet.write(this.transport, toLittleEndian(0x98, 2), 0x55);
          const cfiData = await this.ops.flashCmdSet.read(this.transport, 0x100, 0x00);
          // Reset
          await this.ops.flashCmdSet.write(this.transport, toLittleEndian(0xf0, 2), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.lastCartInfoError = this.t('messages.operation.cfiParseFailed');
            this.log(this.lastCartInfoError, 'error');
            return false;
          }

          // 读取Flash ID并添加到CFI信息
          try {
            const flashId = await this.ops.cfiGetId(this.transport);
            cfiInfo.flashId = flashId;
            const idStr = Array.from(flashId).map(x => x.toString(16).padStart(2, '0')).join(' ');
            const flashName = getFlashName([...flashId]);
            this.log(`Flash ID: ${idStr} (${flashName})`, 'info');
          } catch (e) {
            this.log(errorToBurnerLog(this.t('messages.operation.readIdFailed'), e), 'warn');
            // 即使Flash ID读取失败，也继续返回CFI信息
          }

          // 记录CFI解析结果
          this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
          this.log(cfiInfo.info, 'info');

          return cfiInfo;
        } catch (e) {
          this.lastCartInfoError = e instanceof Error ? e.message : String(e);
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
   * ROM Bank 切换
   */
  async switchROMBank(bank: number) : Promise<void> {
    if (bank < 0) return;
    if (this.isBoostMode) {
      await this.switchROMBankInBoostMode(bank);
      return;
    }
    const h = (bank & 0x0f) << 4;

    await ram_write(this.transport, new Uint8Array([h]), 0x02);
    await ram_write(this.transport, new Uint8Array([0x40]), 0x03);
    this.setActiveRomBankKey(`gba:${bank}`);

    this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
  }

  private async switchROMBankInBoostMode(bank: number): Promise<void> {
    if (bank < 0) return;
    const h = (bank & 0x0f) << 4;
    await boost_write_units(this.transport, false, [
      { address: 0x02, value: h },
      { address: 0x03, value: 0x40 },
    ]);
    this.setActiveRomBankKey(`gba:${bank}`);
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
   * 切换SRAM的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;
    if (this.isBoostMode) {
      await boost_write_units(this.transport, true, [{ address: 0x800000, value: bank }]);
    } else {
      await rom_write(this.transport, toLittleEndian(bank, 2), 0x800000);
    }
    await timeout(GBAAdapter.RAM_BANK_SWITCH_SETTLE_MS);
    this.log(this.t('messages.ram.bankSwitchSram', { bank }), 'info');
  }

  /**
   * 切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;

    if (this.isBoostMode) {
      await boost_write_units(this.transport, false, [
        { address: 0x5555, value: 0xaa },
        { address: 0x2aaa, value: 0x55 },
        { address: 0x5555, value: 0xb0 },
        { address: 0x0000, value: bank },
      ]);
    } else {
      await ram_write(this.transport, new Uint8Array([0xaa]), 0x5555);
      await ram_write(this.transport, new Uint8Array([0x55]), 0x2aaa);
      await ram_write(this.transport, new Uint8Array([0xb0]), 0x5555); // FLASH_COMMAND_SWITCH_BANK
      await ram_write(this.transport, new Uint8Array([bank]), 0x0000);
    }
    await timeout(GBAAdapter.RAM_BANK_SWITCH_SETTLE_MS);

    this.log(this.t('messages.gba.bankSwitchFlash', { bank }), 'info');
  }

  /**
   * 分块读取ROM数据
   * @param size - 读取大小
   * @param baseAddress - 基地址
   * @param chunkSize - 分块大小
   * @returns 读取的数据
   */
  private async readROMChunked(size: number, baseAddress: number, chunkSize: number): Promise<Uint8Array> {
    if (size <= chunkSize) {
      return await this.ops.flashCmdSet.read(this.transport, size, baseAddress);
    }
    const result = new Uint8Array(size);
    let offset = 0;

    while (offset < size) {
      const currentChunkSize = Math.min(chunkSize, size - offset);
      const chunkData = await this.ops.flashCmdSet.read(this.transport, currentChunkSize, baseAddress + offset);
      result.set(chunkData, offset);
      offset += currentChunkSize;
    }

    return result;
  }

  /**
   * 搜索免电存档位置和大小
   * @param baseAddress - 基地址
   * @param options - 命令选项
   * @returns 存档信息或false
   */
  async searchBatteryless(baseAddress: number, options: CommandOptions): Promise<{ offset: number; size: number } | false> {
    try {
      const cfiInfo = options.cfiInfo;
      const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB
      const chunkSize = options.romPageSize ?? this.settings.romPageSize;

      if (this.isBoostMode) {
        this.markChannelBusy();
        await boost_enter_mode(this.transport, 'agb');
      }

      // 切换到相应的bank
      if (isMultiCard) {
        const { bank } = this.romBankRelevantAddress(baseAddress);
        await this.ensureRomBank(`gba:${bank}`, () => this.switchROMBank(bank));
      }

      // 读取启动向量
      const boot = await this.readROMChunked(4, baseAddress, chunkSize);
      const bootVector = ((boot[0] | (boot[1] << 8) | (boot[2] << 16) | (boot[3] << 24)) >>> 0); // 使用无符号右移确保为正数
      const bootVectorAddr = ((bootVector & 0x00FFFFFF) + 2) << 2;

      console.log(baseAddress, [...boot], bootVector, bootVectorAddr);

      // 搜索目标字符串 "<3 from Maniac"
      const targetBytes = new TextEncoder().encode('<3 from Maniac');
      const searchBuf = new Uint8Array(0x2000);

      // 切换到启动向量对应的bank
      if (isMultiCard) {
        const { bank } = this.romBankRelevantAddress(baseAddress + bootVectorAddr);
        await this.ensureRomBank(`gba:${bank}`, () => this.switchROMBank(bank));
      }

      // 读取8KB数据用于搜索
      const searchData = await this.readROMChunked(0x2000, baseAddress + bootVectorAddr, chunkSize);
      searchBuf.set(searchData, 0);

      // 搜索目标字符串
      for (let i = 0; i <= searchBuf.length - targetBytes.length; i++) {
        let found = true;
        for (let j = 0; j < targetBytes.length; j++) {
          if (searchBuf[i + j] !== targetBytes[j]) {
            found = false;
            break;
          }
        }

        if (found) {
          // 找到目标字符串，读取payload大小
          let payloadSize = searchBuf[i + 0x0e] | (searchBuf[i + 0x0f] << 8);
          if (payloadSize === 0) {
            payloadSize = 0x414;
          }

          const offset = baseAddress + bootVectorAddr + i + 0x10; // <3 from Maniac后面是payload的大小和数据
          const payloadStart = offset - payloadSize;

          // 切换到payload开始地址对应的bank
          if (isMultiCard) {
            const { bank } = this.romBankRelevantAddress(payloadStart);
            await this.switchROMBank(bank);
          }

          // 读取payload头部获取存档大小
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
   * 写入免电存档
   * @param fileData - 存档文件数据
   * @param options - 写入选项
   * @param signal - 取消信号
   * @returns 操作结果
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
          // 检查是否已被取消
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          // 获取CFI信息
          const cfiInfo = options.cfiInfo;
          if (!cfiInfo) {
            return { success: false, message: this.t('messages.operation.getCartInfoFailed') };
          }

          const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB

          // 搜索免电存档位置
          const saveInfo = await this.searchBatteryless(baseAddress, options);
          if (!saveInfo) {
            return { success: false, message: this.t('messages.ram.batteryless.notFound') };
          }

          // 限制写入大小不超过检测到的存档大小
          const writeSize = Math.min(fileData.byteLength, saveInfo.size);
          console.log(writeSize, fileData.byteLength, saveInfo.size);
          this.log(this.t('messages.ram.batteryless.info', {
            offset: formatHex(saveInfo.offset, 4),
            size: formatBytes(saveInfo.size),
            writeSize: formatBytes(writeSize),
          }), 'info');

          // 擦除存档区域
          this.log(this.t('messages.ram.batteryless.erase', {
            startAddress: formatHex(saveInfo.offset, 6),
            endAddress: formatHex(saveInfo.offset + writeSize, 6),
          }), 'info');

          const sectorInfo = calcSectorUsage(cfiInfo.eraseSectorBlocks, writeSize, saveInfo.offset);
          const eraseResult = await this.eraseSectors(sectorInfo, options, signal);
          if (!eraseResult.success) {
            return eraseResult;
          }

          const useBoostProgram = this.isBoostMode && !cfiInfo.isIntel;
          const flashBufferSize = cfiInfo.bufferSize ?? 0;
          if (useBoostProgram) {
            await boost_enter_mode(this.transport, 'agb');
            await boost_configure_amd_flash(this.transport, {
              unlockAddr1: GBA_FLASH_ADDR_1,
              unlockAddr2: GBA_FLASH_ADDR_2,
              buffered: flashBufferSize > 0,
              swapD0D1: cfiInfo.isSwapD0D1,
            });
          } else {
            await this.ensureDefaultProtocolMode();
          }

          // 开始写入
          this.log(this.t('messages.ram.batteryless.startWrite'), 'info');

          let written = 0;
          let currentBank = -1;
          const pageSize = this.resolveRomPageSize(options.romPageSize);

          const speedCalculator = new SpeedCalculator();

          while (written < writeSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, writeSize - written);
            const chunk = fileData.subarray(written, written + chunkSize);
            const currentAddress = saveInfo.offset + written;

            // 切换bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 写入数据
            if (useBoostProgram) {
              await boost_program_flash(this.transport, 'agb', currentAddress, flashBufferSize, chunk);
            } else {
              await rom_program(this.transport, chunk, currentAddress, flashBufferSize);
            }
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
   * 读取免电存档
   * @param options - 读取选项
   * @param signal - 取消信号
   * @returns 操作结果，包含读取的数据
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
          // 检查是否已被取消
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          // 获取CFI信息
          const cfiInfo = options.cfiInfo;
          if (!cfiInfo) {
            return { success: false, message: this.t('messages.operation.getCartInfoFailed') };
          }

          const isMultiCard = cfiInfo.deviceSize > (1 << 25); // 32MB

          // 搜索免电存档位置
          const saveInfo = await this.searchBatteryless(baseAddress, options);
          if (!saveInfo) {
            return { success: false, message: this.t('messages.ram.batteryless.notFound') };
          }

          this.log(this.t('messages.ram.batteryless.info', {
            offset: formatHex(saveInfo.offset, 4),
            size: formatBytes(saveInfo.size),
          }), 'info');

          // 开始读取
          this.log(this.t('messages.ram.batteryless.startRead'), 'info');

          const data = new Uint8Array(saveInfo.size);
          let readCount = 0;
          let currentBank = -1;
          const pageSize = this.resolveRomPageSize(options.romPageSize);

          const speedCalculator = new SpeedCalculator();

          while (readCount < saveInfo.size) {
            // 检查是否已被取消
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, saveInfo.size - readCount);
            const currentAddress = saveInfo.offset + readCount;

            // 切换bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 读取数据
            const chunk = await this.ops.flashCmdSet.read(this.transport, chunkSize, currentAddress);
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
   * 校验免电存档
   * @param fileData - 存档文件数据
   * @param options - 校验选项
   * @param signal - 取消信号
   * @returns 操作结果
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
            return readResult; // 返回读取失败的结果
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

  // 检查区域是否为空
  async isBlank(address: number, size = 0x100) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');

    if (this.isBoostMode) {
      this.markChannelBusy();
      await boost_enter_mode(this.transport, 'agb');
    }
    const data = await this.ops.flashCmdSet.read(this.transport, size, address);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'success');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'warn');
    }

    return blank;
  }
}

// 默认导出
export default GBAAdapter;
