import {
  cart_power,
  gbc_read,
  gbc_read_fram,
  gbc_rom_erase_chip,
  gbc_rom_erase_sector,
  gbc_rom_get_id,
  gbc_rom_program,
  gbc_write,
  gbc_write_fram,
} from '@/protocol/beggar_socket/protocol';
import { ProtocolAdapter } from '@/protocol/beggar_socket/protocol-adapter';
import { getFlashName } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions, MbcType } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { timeout } from '@/utils/async-utils';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { PerformanceTracker } from '@/utils/monitoring/sentry-tracker';
import { CFIInfo, parseCFI, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';
import { calcSectorUsage } from '@/utils/sector-utils';

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

  private async pulseSignals(): Promise<void> {
    try {
      await ProtocolAdapter.setSignals(this.device, { dataTerminalReady: true, requestToSend: true });
      await timeout(10);
      await ProtocolAdapter.setSignals(this.device, { dataTerminalReady: false, requestToSend: false });
    } catch (e) {
      // 仅输出调试信息，不中断流程
      console.debug('Failed to toggle serial signals after cart_power:', e);
    } finally {
      await timeout(10);
    }
  }

  private async setCartPower(mode: 0 | 1 | 2): Promise<void> {
    await cart_power(this.device, mode);
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

  /**
   * 根据 MBC 类型和 bank 号返回基础地址
   * @param mbcType - MBC 类型
   * @param bank - Bank 号
   * @returns 基础地址（0x0000 或 0x4000）
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
   * @param bank - Bank 号
   */
  private async switchRomBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 写入 0x2000 地址，8位 bank 号
        // bank 0 会被映射为 bank 1
        const bankValue = bank === 0 ? 1 : bank & 0xff;
        await gbc_write(this.device, new Uint8Array([bankValue]), 0x2000);
        break;
      }
      case 'MBC5': {
        // MBC5: 支持 9位 bank 号 (0-511)
        // 低 8位写入 0x2000, 高位写入 0x3000
        const b0 = bank & 0xff;
        const b1 = (bank >> 8) & 0xff;
        await gbc_write(this.device, new Uint8Array([b1]), 0x3000);
        await gbc_write(this.device, new Uint8Array([b0]), 0x2000);
        break;
      }
      case 'MBC1':
        // MBC1: 支持最多 125 个 ROM banks
        // 低 5位写入 0x2000 (0x01-0x1F)
        // 高 2位写入 0x4000 (0x00-0x03)
        // 需要设置 banking mode
        // TODO: 实现 MBC1 完整支持
        throw new Error('MBC1 ROM bank switching not yet implemented');
      case 'MBC2':
        // MBC2: 支持最多 16 个 ROM banks
        // 低 4位写入 0x2100 (0x00-0x0F)
        // TODO: 实现 MBC2 完整支持
        throw new Error('MBC2 ROM bank switching not yet implemented');
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  /**
   * 根据 MBC 类型切换 RAM bank
   * @param mbcType - MBC 类型
   * @param bank - Bank 号
   */
  private async switchRamBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 写入 0x4000 地址，3位 bank 号 (0-7)
        const bankValue = bank & 0x07;
        await gbc_write(this.device, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC5': {
        // MBC5: 写入 0x4000 地址，8位 bank 号 (0-255)
        const bankValue = bank & 0xff;
        await gbc_write(this.device, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC1':
        // MBC1: RAM banking 与 ROM banking 共享高位
        // 写入 0x4000 (0x00-0x03)
        // 需要设置 banking mode 为 simple (0)
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
   * 从 CFI 信息读取擦除超时参数并计算预期擦除时间
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
      this.log(`${this.t('messages.operation.calculateEraseTimeoutFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
      return 0;
    }
  }

  /**
   * 全片擦除
   * @param options - 命令选项，包含 CFI 信息、MBC 类型和 5V 使能设置
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  override async eraseChip(options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'), 'info');

        const mbcType = options.mbcType ?? 'MBC5';
        const enable5V = options.enable5V ?? false;

        try {
          return await this.withOptional5v(enable5V, async () => {
            // 检查是否已被取消
            if (signal?.aborted) {
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            // 获取擦除超时时间
            const eraseTimeoutMs = this.calculateEraseTimeout(options.cfiInfo);

            await gbc_rom_erase_chip(this.device);

            const startTime = Date.now();
            let elapsedMilliseconds = 0;

            // 验证擦除是否完成
            while (true) {
              if (signal?.aborted) {
                this.log(this.t('messages.operation.cancelled'), 'warn');
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              const eraseComplete = await this.isBlank(0x00, 0x100, mbcType);
              elapsedMilliseconds = Date.now() - startTime;

              if (eraseComplete) {
                this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedMilliseconds / 1000).toFixed(1)}s)`, 'success');
                break;
              } else {
                // 如果有预期擦除时间，显示进度百分比
                if (eraseTimeoutMs > 0) {
                  const progress = Math.min(100, Math.floor((elapsedMilliseconds / eraseTimeoutMs) * 100));
                  this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedMilliseconds / 1000).toFixed(1)}s, ${progress}%)`, 'info');
                } else {
                  this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedMilliseconds / 1000).toFixed(1)}s)`, 'info');
                }
                await timeout(1000);
              }
            }

            return {
              success: true,
              message: this.t('messages.operation.eraseComplete'),
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

          this.log(`${this.t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.operation.eraseFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'erase_chip',
      },
    );
  }

  /**
   * 擦除ROM扇区
   * @param sectorInfo - 扇区信息数组
   * @param options - 命令选项，包含 MBC 类型和 5V 使能设置
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
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

              // 更新当前扇区状态为"正在处理"
              const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

              this.log(this.t('messages.operation.eraseSector', {
                from: formatHex(sector.address, 4),
                to: formatHex(sector.address + sector.size - 1, 4),
              }), 'info');

              const { bank, cartAddress } = this.romBankRelevantAddress(sector.address, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              await gbc_rom_erase_sector(this.device, cartAddress);
              const sectorEndTime = Date.now();

              // 更新当前扇区状态为"已完成"
              progressReporter.updateSectorProgress(sector.address, 'completed');

              eraseCount++;
              const erasedBytes = eraseCount * sector.size;

              // 添加数据点到速度计算器
              speedCalculator.addDataPoint(sector.size, sectorEndTime);

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 报告进度
              progressReporter.reportProgress(
                erasedBytes,
                currentSpeed,
                this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
                eraseCount,
                sectorIndex,
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

          const progressReporter = new ProgressReporter(
            'erase',
            sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0),
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.reportError(this.t('messages.operation.eraseSectorFailed'));
          this.log(`${this.t('messages.operation.eraseSectorFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.operation.eraseSectorFailed'),
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
    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);
    const bufferSize = options.cfiInfo.bufferSize ?? 0;

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
            let written = 0;
            this.log(this.t('messages.rom.writing', { size: total }), 'info');

            // 初始化扇区进度信息 (用于显示写入进度可视化)
            const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
            this.initializeSectorProgress(sectorInfo);

            const blank = await this.isBlank(baseAddress, 0x100, mbcType);
            if (!blank) {
              await this.eraseSectors(sectorInfo, options, signal);
            }

            // 重置扇区状态为pending，准备开始写入阶段
            this.resetSectorsState();

            // 使用速度计算器
            const speedCalculator = new SpeedCalculator();

            // 创建进度报告器
            const progressReporter = new ProgressReporter(
              'write',
              total,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
            );
            progressReporter.setSectors(this.currentSectorProgress);

            // 重置 progressReporter 的扇区状态为pending（因为要开始写入阶段）
            progressReporter.resetSectorsState();

            // 报告开始状态
            progressReporter.reportStart(this.t('messages.rom.writing', { size: total }));

            // 分块写入并更新进度
            let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
            let chunkCount = 0; // 记录已处理的块数
            let currentBank = -1;
            while (written < total) {
              // 检查是否已被取消
              if (signal?.aborted) {
                progressReporter.reportError(this.t('messages.operation.cancelled'));
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              const chunkSize = Math.min(pageSize, total - written);
              const chunk = fileData.slice(written, written + chunkSize);
              if (chunk.byteLength === 0) {
                this.log(this.t('messages.rom.writeNoData'), 'warn');
                break;
              }
              const currentAddress = baseAddress + written;

              // 更新当前扇区状态为"正在处理"
              progressReporter.updateSectorProgress(currentAddress, 'processing');

              const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              await gbc_rom_program(this.device, chunk, cartAddress, bufferSize);
              const chunkEndTime = Date.now();

              written += chunkSize;
              chunkCount++;

              // 更新已写入范围的扇区状态
              progressReporter.updateSectorRangeProgress(baseAddress, baseAddress + written - 1, 'completed');

              // 添加数据点到速度计算器
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              // 每10次操作或最后一次更新进度
              if (chunkCount % 10 === 0 || written >= total) {
                // 计算当前速度
                const currentSpeed = speedCalculator.getCurrentSpeed();

                const currentSectorIndex = this.currentSectorProgress.findIndex(s =>
                  currentAddress >= s.address && currentAddress < s.address + s.size,
                );
                const completedSectors = this.currentSectorProgress.filter(s => s.state === 'completed').length;

                // 报告进度
                progressReporter.reportProgress(
                  written,
                  currentSpeed,
                  this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeed) }),
                  completedSectors,
                  currentSectorIndex,
                );
              }

              // 每5个百分比记录一次日志
              const progress = Math.floor((written / total) * 100);
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.rom.writingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
              }
            }

            const totalTime = speedCalculator.getTotalTime();
            const avgSpeed = speedCalculator.getAverageSpeed();
            const maxSpeed = speedCalculator.getMaxSpeed();

            this.log(this.t('messages.rom.writeComplete'), 'success');
            this.log(this.t('messages.rom.writeSummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
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
          progressReporter.reportError(this.t('messages.rom.writeFailed'));
          this.log(`${this.t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.rom.writeFailed'),
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
    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

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
            let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
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

              const chunkSize = Math.min(pageSize, size - totalRead);
              const currentAddress = baseAddress + totalRead;

              // 计算bank和地址
              const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              // 读取数据
              const chunk = await gbc_read(this.device, chunkSize, cartAddress);
              const chunkEndTime = Date.now();
              data.set(chunk, totalRead);

              totalRead += chunkSize;
              chunkCount++;

              // 添加数据点到速度计算器
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

              // 每5个百分比记录一次日志
              const progress = Math.floor((totalRead / size) * 100);
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.rom.readingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
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
          this.log(`${this.t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const mbcType = options.mbcType ?? 'MBC5';
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

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
          this.log(this.t('messages.rom.verifying'), 'info');

          const total = fileData.byteLength;
          let verified = 0;
          let success = true;
          let failedAddress = -1;
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let currentBank = -1;

          // 初始化扇区进度信息 (用于显示校验进度可视化)
          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          this.initializeSectorProgress(sectorInfo);

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 创建进度报告器
          const progressReporter = new ProgressReporter(
            'verify',
            total,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(this.currentSectorProgress);

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

            const chunkSize = Math.min(pageSize, total - verified);
            const expectedChunk = fileData.slice(verified, verified + chunkSize);
            const currentAddress = baseAddress + verified;

            // 更新当前扇区状态为"正在处理"
            progressReporter.updateSectorProgress(currentAddress, 'processing');

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            // 读取数据
            const actualChunk = await gbc_read(this.device, chunkSize, cartAddress);
            const chunkEndTime = Date.now();

            // 逐字节比较
            for (let i = 0; i < chunkSize; i++) {
              if (expectedChunk[i] !== actualChunk[i]) {
                success = false;
                failedAddress = verified + i;
                this.log(this.t('messages.rom.verifyFailedAt', {
                  address: formatHex(failedAddress, 4),
                  expected: formatHex(expectedChunk[i], 1),
                  actual: formatHex(actualChunk[i], 1),
                }), 'error');
                break;
              }
            }

            if (!success) break;

            verified += chunkSize;
            chunkCount++;

            // 更新已校验范围的扇区状态
            progressReporter.updateSectorRangeProgress(baseAddress, baseAddress + verified - 1, 'completed');

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || verified >= total) {
              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              const currentSectorIndex = this.currentSectorProgress.findIndex(s =>
                currentAddress >= s.address && currentAddress < s.address + s.size,
              );
              const completedSectors = this.currentSectorProgress.filter(s => s.state === 'completed').length;

              // 报告进度
              progressReporter.reportProgress(
                verified,
                currentSpeed,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
                completedSectors,
                currentSectorIndex,
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
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          if (success) {
            this.log(this.t('messages.rom.verifySuccess'), 'success');
            this.log(this.t('messages.rom.verifySummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
            }), 'info');

            // 报告完成状态
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
          this.log(`${this.t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);

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

            // 开启RAM访问权限
            await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

            // 开始写入
            let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
            let chunkCount = 0; // 记录已处理的块数
            let currentBank = -1;

            // 使用速度计算器
            const speedCalculator = new SpeedCalculator();

            while (written < total) {
              const ramAddress = baseAddress + written;
              // 分包
              const remainingSize = total - written;
              const chunkSize = Math.min(pageSize, remainingSize);
              const chunk = fileData.slice(written, written + chunkSize);

              // 计算bank和地址
              const { bank, cartAddress } = this.ramBankRelevantAddress(ramAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 写入数据
              if (ramType === 'FRAM') {
                const latency = options.framLatency ?? 25;
                await gbc_write_fram(this.device, chunk, cartAddress, latency);
              } else {
                await gbc_write(this.device, chunk, cartAddress);
              }

              const chunkEndTime = Date.now();

              written += chunkSize;
              chunkCount++;

              // 添加数据点到速度计算器
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              const progress = Math.floor((written / total) * 100);

              // 每5个百分比记录一次日志
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
          this.log(`${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            this.log(this.t('messages.ram.reading'), 'info');

            // 开启RAM访问权限
            await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

            const result = new Uint8Array(size);
            let currentBank = -1;
            let read = 0;

            // 使用速度计算器
            const speedCalculator = new SpeedCalculator();

            while (read < size) {
              const ramAddress = baseAddress + read;

              // 计算bank和地址
              const { bank, cartAddress } = this.ramBankRelevantAddress(ramAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 分包
              const remainingSize = size - read;
              const chunkSize = Math.min(pageSize, remainingSize);

              // 读取数据
              const chunk = ramType === 'FRAM'
                ? await gbc_read_fram(this.device, chunkSize, cartAddress, options.framLatency ?? 25)
                : await gbc_read(this.device, chunkSize, cartAddress);
              const chunkEndTime = Date.now();
              result.set(chunk, read);

              read += chunkSize;

              // 添加数据点到速度计算器
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
          this.log(`${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const size = options.size ?? fileData.byteLength;

    this.log(this.t('messages.operation.startVerifyRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
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
          this.log(`${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.getCartInfo',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            // CFI Query
            await gbc_write(this.device, new Uint8Array([0x98]), 0xaa);
            const cfiData = await gbc_read(this.device, 0x100, 0x00);
            // Reset
            await gbc_write(this.device, new Uint8Array([0xf0]), 0x00);

            const cfiInfo = parseCFI(cfiData);

            if (!cfiInfo) {
              this.log(this.t('messages.operation.cfiParseFailed'), 'error');
              return false;
            }

            // 读取Flash ID并添加到CFI信息中
            try {
              const flashId = await gbc_rom_get_id(this.device);
              cfiInfo.flashId = flashId;
              const idStr = Array.from(flashId).map(x => x.toString(16).padStart(2, '0')).join(' ');
              const flashName = getFlashName([...flashId]);
              this.log(`Flash ID: ${idStr} (${flashName})`, 'info');
            } catch (e) {
              this.log(`${this.t('messages.operation.readIdFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
              // 即使Flash ID读取失败，也继续返回CFI信息
            }

            // 记录CFI解析结果
            this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
            this.log(cfiInfo.info, 'info');

            return cfiInfo;
          });
        } catch (e) {
          this.log(`${this.t('messages.operation.romSizeQueryFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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

    const data = await gbc_read(this.device, size, cartAddress);
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
