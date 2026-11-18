import {
  cart_power,
  FLASH_CMD_RESET,
  GBC_FLASH_CMD_SET,
  gbc_read,
  gbc_read_fram,
  gbc_rom_erase_sector,
  gbc_rom_get_id,
  gbc_rom_program,
  gbc_write,
  gbc_write_fram,
  getFlashName,
  setSignals,
} from '@/protocol';
import { planBankChunk } from '@/services/bank-chunk-planner';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions, MbcType } from '@/types/command-options';
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
import { calcSectorUsage, getExtraErasedBytes } from '@/utils/sector-utils';
import { isAllErasedBytes, nextChunkSize, prepareRomImage } from '@/utils/transfer-plan';

import type { PlatformOps } from './platform-ops';

/**
 * MBC5 Adapter - 封装MBC5卡带的协议操作
 */
export class MBC5Adapter extends CartridgeAdapter {
  private power5vActive = false;

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
    return {
      platformId: 'mbc5',
      flashCmdSet: {
        ...GBC_FLASH_CMD_SET,
        read: (...args: Parameters<typeof gbc_read>) => gbc_read(...args),
        write: (...args: Parameters<typeof gbc_write>) => gbc_write(...args),
      },
      cfiEntryAddress: 0xaa,
      romBankSize: 0x4000,
      cfiGetId: (device) => gbc_rom_get_id(device),
      toRomBank: (address, options) => {
        const mbcType = (options as CommandOptions | undefined)?.mbcType ?? 'MBC5';
        return this.romBankRelevantAddress(address, mbcType);
      },
      switchRomBank: async (_device, bank, options) => {
        const mbcType = (options as CommandOptions | undefined)?.mbcType ?? 'MBC5';
        await this.switchROMBank(bank, mbcType);
      },
      needsRomBankSwitch: () => true,
    };
  }

  private getUnsupportedPowerControlResult(): CommandResult | null {
    return this.firmwareProfile.capabilities.cartPowerControl
      ? null
      : firmwareUnsupportedResult('MBC 5V power control', this.firmwareProfile);
  }

  private getUnsupportedRamTypeResult(ramType: CommandOptions['ramType'], operation: string): CommandResult | null {
    const resolvedRamType = ramType ?? 'SRAM';
    return isRamTypeSupportedByFirmware(this.firmwareProfile, 'mbc5', resolvedRamType)
      ? null
      : firmwareUnsupportedResult(operation, this.firmwareProfile);
  }

  private async pulseSignals(): Promise<void> {
    try {
      await setSignals(this.transport, { dataTerminalReady: true, requestToSend: true });
      await timeout(10);
      await setSignals(this.transport, { dataTerminalReady: false, requestToSend: false });
    } catch (e) {
      // 仅输出调试信息，不中断流程
      console.debug('Failed to toggle serial signals after cart_power:', e);
    } finally {
      await timeout(10);
    }
  }

  private async setCartPower(mode: 0 | 1 | 2): Promise<void> {
    await cart_power(this.transport, mode);
    await this.pulseSignals();
  }

  private async enableFiveVoltPower(): Promise<void> {
    this.log(this.t('messages.operation.enable5V'), 'info');
    await this.setCartPower(0); // power down
    await timeout(120);
    await this.setCartPower(2); // 5V
    await timeout(350);
    this.power5vActive = true;
  }

  private async restoreDefaultPower(): Promise<void> {
    if (!this.power5vActive) return;
    await this.setCartPower(1); // 3.3V
    this.log(this.t('messages.operation.disable5V'), 'info');
    this.power5vActive = false;
    await timeout(200);
  }

  private async withOptional5v<T>(enable: boolean, fn: () => Promise<T>): Promise<T> {
    if (!enable) {
      return fn();
    }

    await this.enableFiveVoltPower();
    try {
      return await fn();
    } finally {
      await this.restoreDefaultPower();
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async eraseRomSectorWithRetry(
    sector: SectorProgressInfo,
    mbcType: MbcType,
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
        const { cartAddress } = this.romBankRelevantAddress(sector.address, mbcType);
        await gbc_rom_erase_sector(this.transport, cartAddress);
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
          await this.stabilizeCommandChannel(MBC5Adapter.ROM_ERASE_RETRY_RESET_MS);
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

  private async readRAMChunkWithRetry(
    chunkSize: number,
    logicalAddress: number,
    cartAddress: number,
    chunkIndex: number,
    bank: number,
    ramType: 'SRAM' | 'FLASH' | 'FRAM',
    framLatency: number,
    restoreState?: () => Promise<void>,
  ): Promise<Uint8Array> {
    let lastError: unknown;
    const retries = AdvancedSettings.ramReadRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.ramReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return ramType === 'FRAM'
          ? await gbc_read_fram(this.transport, chunkSize, cartAddress, framLatency)
          : await gbc_read(this.transport, chunkSize, cartAddress);
      } catch (error) {
        lastError = error;
        this.log(
          errorToBurnerLog(
            `RAM chunk read retry ${attempt}/${attempts} #${chunkIndex} @ ${formatHex(logicalAddress, 4)} `
            + `(cart ${formatHex(cartAddress, 4)}, bank ${bank}, ${chunkSize}B, timeout ${timeoutMs}ms, type ${ramType})`,
            error,
          ),
          'warn',
        );

        if (attempt < attempts) {
          await this.stabilizeCommandChannel(MBC5Adapter.RAM_READ_RETRY_RESET_MS);
          if (restoreState) {
            await restoreState();
          }
          this.log(
            `RAM chunk channel resynchronized before retry #${chunkIndex} @ ${formatHex(logicalAddress, 4)} `
            + `(cart ${formatHex(cartAddress, 4)}, bank ${bank}, type ${ramType})`,
            'info',
          );
          if (retryDelayMs > 0) {
            await timeout(retryDelayMs * attempt);
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * 根据 MBC 类型和 bank 号返回基础地址
   * @param mbcType - MBC 类型
   * @param bank - Bank
   * @returns 基础地址，0x0000 或 0x4000
   */
  private getBaseAddressOfBank(mbcType: MbcType, bank: number): number {
    switch (mbcType) {
      case 'MBC3':
        // MBC3: bank 0 使用 0x0000, 其他 bank 使用 0x4000
        return bank === 0 ? 0x0000 : 0x4000;
      case 'MBC5':
      case 'MBC1':
      case 'MBC2':
      default:
        // MBC5/MBC1/MBC2: 所有 bank 都使用 0x4000
        return 0x4000;
    }
  }

  /**
   * 根据 MBC 类型切换 ROM bank
   * @param mbcType - MBC 类型
   * @param bank - Bank
   */
  private async switchRomBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 写入 0x2000 地址切换 bank
        // bank 0 会被映射为 bank 1
        const bankValue = bank === 0 ? 1 : bank & 0xff;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x2000);
        break;
      }
      case 'MBC5': {
        // MBC5: 支持最多 9 位 bank (0-511)
        // 低8位写入 0x2000, 高1位写入 0x3000
        const b0 = bank & 0xff;
        const b1 = (bank >> 8) & 0xff;
        await gbc_write(this.transport, new Uint8Array([b1]), 0x3000);
        await gbc_write(this.transport, new Uint8Array([b0]), 0x2000);
        break;
      }
      case 'MBC1':
        // MBC1: 支持最多 125 ROM banks
        // 5位写0x2000 (0x01-0x1F)
        // 2位写0x4000 (0x00-0x03)
        // 需要设置 banking mode
        // TODO: 实现 MBC1 完整支持
        throw new Error('MBC1 ROM bank switching not yet implemented');
      case 'MBC2':
        // MBC2: 支持最多 16 ROM banks
        // 4位写0x2100 (0x00-0x0F)
        // TODO: 实现 MBC2 完整支持
        throw new Error('MBC2 ROM bank switching not yet implemented');
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  /**
   * 根据 MBC 类型切换 RAM bank
   * @param mbcType - MBC 类型
   * @param bank - Bank
   */
  private async switchRamBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 写入 0x4000 地址切换 bank (0-7)
        const bankValue = bank & 0x07;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC5': {
        // MBC5: 写入 0x4000 地址切换 bank (0-255)
        const bankValue = bank & 0xff;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC1':
        // MBC1: RAM banking 与 ROM banking 共用高位
        // 写入 0x4000 (0x00-0x03)
        // 需要设置 banking mode simple (0)
        // TODO: 实现 MBC1 完整支持
        throw new Error('MBC1 RAM bank switching not yet implemented');
      case 'MBC2':
        // MBC2: 没有 RAM banking（内置 512x4bit RAM）
        // 不需要 bank 切换
        break;
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  /**
   * 计算芯片擦除超时时间
   * 读取 CFI 信息中的擦除超时参数并计算预期擦除时间
   * @param cfiInfo - CFI 信息对象
   * @returns 预期擦除时间（毫秒），如果无法计算则返回 0
   */
  private calculateEraseTimeout(cfiInfo: CFIInfo): number {
    try {
      let timeoutBlock = 0;
      let timeoutChip = 0;
      let totalSectors = 0;

      if (cfiInfo) {
        timeoutBlock = cfiInfo.sectorEraseTimeAvg ?? 0;
        timeoutChip = cfiInfo.chipEraseTimeAvg ?? 0;
        totalSectors = cfiInfo.eraseSectorBlocks.reduce((sum, block) => sum + block.sectorCount, 0);
      }

      // 如果有芯片擦除超时，使用它；否则使用扇区擦除超时 × 扇区数量
      if (timeoutChip > 0) {
        this.log(`${this.t('messages.operation.eraseTimeout')}: ${(timeoutChip / 1000).toFixed(1)}s (chip)`, 'info');
        return timeoutChip;
      }

      if (timeoutBlock > 0 && totalSectors > 0) {
        const estimatedTime = timeoutBlock * totalSectors;
        this.log(`${this.t('messages.operation.eraseTimeout')}: ${(estimatedTime / 1000).toFixed(1)}s (block × ${totalSectors})`, 'info');
        return estimatedTime;
      }

      return 0;
    } catch (e) {
      this.log(errorToBurnerLog(this.t('messages.operation.calculateEraseTimeoutFailed'), e), 'warn');
      return 0;
    }
  }

  /**
   * 全片擦除
   * @param options - 命令选项，包含 CFI 信息、MBC 类型和 5V 使能
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseSectors',
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

        const mbcType = options.mbcType ?? 'MBC5';
        const enable5V = options.enable5V ?? false;

        try {
          return await this.withOptional5v(enable5V, async () => {
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

              const { bank } = this.romBankRelevantAddress(sector.address, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              this.log(this.t('messages.operation.eraseSector', {
                from: formatHex(sector.address, 4),
                to: formatHex(sector.address + sector.size - 1, 4),
              }), 'info');
              await this.eraseRomSectorWithRetry(sector, mbcType, 'prepare', signal);
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
          });
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
        adapter_type: 'mbc5',
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
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    // 与 C# 客户端对齐：JS28F256 等 Intel 系（厂商 ID 0x89）在 x8 模式下写缓冲
    // 最大 256 字节，CFI 报告值在这类卡上不可靠；错误的缓冲长度会让固件的
    // 编程校验轮询永不收敛（设备永久沉默，主机只能等到超时）。
    const bufferSize = options.cfiInfo.flashId?.[0] === 0x89
      ? 256
      : (options.cfiInfo.bufferSize ?? 0);

    this.log(this.t('messages.operation.startWriteROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
      pageSize,
      bufferSize,
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeROM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
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
            // GBC 扇区擦除不受固件能力限制，与 C# 客户端一致写前无条件擦除；
            // 抽样跳过误判会导致在未擦除数据上编程，触发固件校验轮询死循环。
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
                bankSize: 0x4000,
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

              const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              const { attemptsUsed, retriesPerformed } = await this.programRomChunkWithRetry(
                () => gbc_rom_program(this.transport, chunk, cartAddress, bufferSize),
                currentAddress,
                signal,
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
          });
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
        adapter_type: 'mbc5',
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
  override async readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress = true) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomReadPageSize(options.romPageSize);
    const readThrottleMs = AdvancedSettings.romReadThrottleMs;
    const retries = AdvancedSettings.romReadRetryCount;
    const retryDelayMs = AdvancedSettings.romReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readROM',
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

          return await this.withOptional5v(enable5V, async () => {
            await this.stabilizeReadChannel(options, MBC5Adapter.ROM_READ_START_SETTLE_MS);
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
              const { bank, cartAddress, chunkSize } = planBankChunk(currentAddress, size - totalRead, pageSize, { platform: 'mbc', memory: 'rom', mbcType });

              // 计算 bank 和地址
              if (bank !== currentBank) {
                currentBank = bank;
                await this.ensureRomBank(`${mbcType}:${bank}`, () => this.switchROMBank(bank, mbcType));
              }

              // 读取数据
              const chunk = await this.readROMChunkWithRetry(
                chunkSize,
                currentAddress,
                cartAddress,
                Math.floor(totalRead / pageSize) + 1,
                bank,
                async () => { await this.switchROMBank(bank, mbcType); },
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
          });
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
        adapter_type: 'mbc5',
        operation_type: 'read_rom',
      },
      {
        dataSize: size,
        baseAddress,
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
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = this.resolveRomReadPageSize(options.romPageSize);

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyROM',
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
          return await this.withOptional5v(enable5V, async () => {
            await this.stabilizeCommandChannel(MBC5Adapter.ROM_READ_START_SETTLE_MS);
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
              const { bank, cartAddress, chunkSize } = planBankChunk(currentAddress, total - verified, pageSize, { platform: 'mbc', memory: 'rom', mbcType });

              if (bank !== currentBank) {
                currentBank = bank;
                await this.ensureRomBank(`${mbcType}:${bank}`, () => this.switchROMBank(bank, mbcType));
              }

              // 读取数据
              const actualChunk = await this.readROMChunkWithRetry(
                chunkSize,
                currentAddress,
                cartAddress,
                Math.floor(verified / pageSize) + 1,
                bank,
                async () => { await this.switchROMBank(bank, mbcType); },
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
          });
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
        adapter_type: 'mbc5',
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
  override async writeRAM(fileData: Uint8Array, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM write');
    if (unsupportedRamType) return unsupportedRamType;

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);

    this.log(this.t('messages.operation.startWriteRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeRAM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            this.log(this.t('messages.ram.writing', { size: fileData.byteLength }), 'info');

            const total = options.size ?? fileData.byteLength;
            let written = 0;

            // 开启RAM写权限
            await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);

            // 开始写入
            let lastLoggedProgress = -1; // 初始化为 -1，确保第一次 0% 会被记录
            let chunkCount = 0; // 记录已处理的块数
            let currentBank = -1;

            // 使用速度计算器
            const speedCalculator = new SpeedCalculator();

            while (written < total) {
              const ramAddress = baseAddress + written;
              // 分包
              const remainingSize = total - written;
              const { bank, cartAddress, chunkSize } = planBankChunk(ramAddress, remainingSize, pageSize, { platform: 'mbc', memory: 'ram', mbcType });
              const chunk = fileData.subarray(written, written + chunkSize);

              // 计算 bank 和地址
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 写入数据
              if (ramType === 'FRAM') {
                const latency = options.framLatency ?? 25;
                await gbc_write_fram(this.transport, chunk, cartAddress, latency);
              } else {
                await gbc_write(this.transport, chunk, cartAddress);
              }

              const chunkEndTime = Date.now();

              written += chunkSize;
              chunkCount++;

              // 添加数据点到速度计算
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              const progress = Math.floor((written / total) * 100);

              // 每 5 个百分比记录一次日志
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.ram.writingAt', { address: formatHex(ramAddress, 4), progress }), 'info');
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
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.writeFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.writeFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
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
  override async readRAM(size: number, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM read');
    if (unsupportedRamType) return unsupportedRamType;

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const effectiveRamType = ramType === 'BATLESS' ? 'SRAM' : ramType;
    const pageSize = this.resolveRamPageSize(options.ramPageSize);
    const retries = AdvancedSettings.ramReadRetryCount;
    const retryDelayMs = AdvancedSettings.ramReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;
    const framLatency = options.framLatency ?? 25;

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');
    this.log(
      `RAM read session config: page=${formatBytes(pageSize)}, retries=${retries}, `
      + `retryDelay=${retryDelayMs}ms, timeout=${timeoutMs}ms, type=${ramType}, mbc=${mbcType}, 5v=${enable5V}`,
      'info',
    );

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            await this.stabilizeCommandChannel(MBC5Adapter.RAM_READ_START_SETTLE_MS);
            this.log(this.t('messages.ram.reading'), 'info');

            // 开启RAM写权限
            await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);

            const result = new Uint8Array(size);
            let currentBank = -1;
            let read = 0;

            // 使用速度计算器
            const speedCalculator = new SpeedCalculator();

            while (read < size) {
              const ramAddress = baseAddress + read;

              // 计算 bank 和地址
              const { bank, cartAddress, chunkSize } = planBankChunk(
                ramAddress, size - read, pageSize, { platform: 'mbc', memory: 'ram', mbcType },
              );
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 读取数据
              const chunk = await this.readRAMChunkWithRetry(
                chunkSize,
                ramAddress,
                cartAddress,
                Math.floor(read / pageSize) + 1,
                bank,
                effectiveRamType,
                framLatency,
                async () => { await this.switchRAMBank(bank, mbcType); },
              );
              const chunkEndTime = Date.now();
              result.set(chunk, read);

              read += chunkSize;

              // 添加数据点到速度计算
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);
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
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.readFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
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
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM verify');
    if (unsupportedRamType) return unsupportedRamType;

    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const configuredSize = options.size ?? fileData.byteLength;
    const fileSize = fileData.byteLength;
    const size = Math.min(configuredSize, fileSize);

    this.log(this.t('messages.operation.startVerifyRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
      async () => {
        try {
          if (configuredSize > fileSize) {
            this.log(this.t('messages.ram.verifyClampedToFile', {
              configured: formatBytes(configuredSize),
              file: formatBytes(fileSize),
              actual: formatBytes(size),
            }), 'warn');
          }
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
        adapter_type: 'mbc5',
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
   * @param enable5V - 是否启用 5V 电源（可选，默认 false）
   * @returns 卡带容量相关信息
   */
  override async getCartInfo(enable5V = false): Promise<CFIInfo | false> {
    this.lastCartInfoError = undefined;
    if (enable5V && !this.firmwareProfile.capabilities.cartPowerControl) {
      const unsupported = firmwareUnsupportedResult('MBC 5V power control', this.firmwareProfile);
      this.lastCartInfoError = unsupported.message;
      this.log(unsupported.message, 'error');
      return false;
    }

    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.getCartInfo',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            // CFI Query
            await gbc_write(this.transport, new Uint8Array([0x98]), 0xaa);
            const cfiData = await gbc_read(this.transport, 0x100, 0x00);
            // Reset
            await gbc_write(this.transport, new Uint8Array([0xf0]), 0x00);

            const cfiInfo = parseCFI(cfiData);

            if (!cfiInfo) {
              this.lastCartInfoError = this.t('messages.operation.cfiParseFailed');
              this.log(this.lastCartInfoError, 'error');
              return false;
            }

            // 读取Flash ID并添加到CFI信息
            try {
              const flashId = await gbc_rom_get_id(this.transport);
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
          });
        } catch (e) {
          this.lastCartInfoError = e instanceof Error ? e.message : String(e);
          this.log(errorToBurnerLog(this.t('messages.operation.romSizeQueryFailed'), e), 'error');
          return false;
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'get_cart_info',
      },
    );
  }

  /**
   * ROM Bank 切换
   */
  async switchROMBank(bank: number, mbcType: MbcType = 'MBC5') : Promise<void> {
    await this.switchRomBank(mbcType, bank);
    this.setActiveRomBankKey(`${mbcType}:${bank}`);
    this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
  }

  /**
   * RAM Bank 切换
   */
  async switchRAMBank(bank: number, mbcType: MbcType = 'MBC5') : Promise<void> {
    await this.switchRamBank(mbcType, bank);
    this.log(this.t('messages.ram.bankSwitch', { bank }), 'info');
  }

  // 检查区域是否为空
  async isBlank(address: number, size = 0x100, mbcType: MbcType = 'MBC5') : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');

    const { bank, cartAddress } = this.romBankRelevantAddress(address, mbcType);
    await this.switchROMBank(bank, mbcType);

    const data = await gbc_read(this.transport, size, cartAddress);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'success');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'info');
    }

    return blank;
  }

  romBankRelevantAddress(address: number, mbcType: MbcType = 'MBC5') {
    const bank = address >> 14;
    const b = bank < 0 ? 0 : bank;

    const cartAddress = this.getBaseAddressOfBank(mbcType, b) + (address & 0x3fff);

    return {
      bank: b,
      cartAddress,
    };
  }

  ramBankRelevantAddress(address: number, mbcType: MbcType = 'MBC5') {
    const bank = address >> 13;
    const b = bank < 0 ? 0 : bank;

    const cartAddress = 0xa000 + (address & 0x1fff);

    return {
      bank: b,
      cartAddress,
    };
  }
}

// 默认导出
export default MBC5Adapter;
