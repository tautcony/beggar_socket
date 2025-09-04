import {
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
} from '@/protocol/beggar_socket/protocol';
import { getFlashName, toLittleEndian } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
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
 * GBA Adapter - 封装GBA卡带的协议操作
 */
export class GBAAdapter extends CartridgeAdapter {
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

  /**
   * 全片擦除
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  override async eraseChip(signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'), 'info');

        try {
          // 检查是否已被取消
          if (signal?.aborted) {
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          await rom_erase_chip(this.device);

          const startTime = Date.now();
          let elapsedSeconds = 0;

          // 验证擦除是否完成
          while (true) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.log(this.t('messages.operation.cancelled'), 'error');
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

          return {
            success: true,
            message: this.t('messages.operation.eraseComplete'),
          };
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'error');
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
        adapter_type: 'gba',
        operation_type: 'erase_chip',
      },
    );
  }

  /**
   * 擦除ROM扇区
   * @param sectorInfo - 扇区信息数组
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    signal?: AbortSignal,
  ): Promise<CommandResult> {
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

        try {
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

            const { bank } = this.romBankRelevantAddress(sector.address);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            // 更新当前扇区状态为"正在处理"
            const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

            this.log(this.t('messages.operation.eraseSector', {
              from: formatHex(sector.address, 4),
              to: formatHex(sector.address + sector.size - 1, 4),
            }), 'info');

            await rom_erase_sector(this.device, sector.address);
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
            totalSectors: sectors.length,
          }), 'info');

          // 报告完成状态
          progressReporter.reportCompleted(this.t('messages.operation.eraseSuccess'), avgSpeed);

          return {
            success: true,
            message: this.t('messages.operation.eraseSuccess'),
          };
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'error');
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          this.log(`${this.t('messages.operation.eraseSectorFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.operation.eraseSectorFailed'),
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
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);
    const bufferSize = options.cfiInfo.bufferSize ?? 0;

    this.log(this.t('messages.operation.startWriteROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
      pageSize,
      bufferSize,
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.writeROM',
      async () => {
        const startTime = Date.now();
        try {
          const total = options.size ?? fileData.byteLength;
          let written = 0;
          this.log(this.t('messages.rom.writing', { size: total }), 'info');

          // 初始化扇区进度信息 (用于显示写入进度可视化)
          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          this.initializeSectorProgress(sectorInfo);

          {
            const { bank } = this.romBankRelevantAddress(baseAddress);
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              await this.switchROMBank(bank);
            }
          }

          const blank = await this.isBlank(baseAddress, 0x100);
          if (!blank) {
            await this.eraseSectors(sectorInfo, signal);
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

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            await rom_program(this.device, chunk, cartAddress, bufferSize);
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
        } catch (e) {
          this.log(`${this.t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.rom.writeFailed'),
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
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readROM',
      async () => {
        const startTime = Date.now();
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

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            const chunk = await rom_read(this.device, chunkSize, cartAddress);
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
              this.log(this.t('messages.rom.readingAt', { address: formatHex(baseAddress + totalRead, 4), progress }), 'info');
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
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

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
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            // 读取对应的ROM数据
            const actualChunk = await rom_read(this.device, chunkSize, cartAddress);
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
                address: formatHex(verified, 4),
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
    const ramType = options.ramType ?? 'SRAM';

    // 如果是免电存档，调用专门的方法
    if (ramType === 'BATLESS') {
      return this.writeBatterylessSave(fileData, options);
    }

    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);
    const baseAddress = options.baseAddress ?? 0x00;

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
            await ram_erase_flash(this.device);

            // 等待擦除完成
            let erased = false;
            while (!erased) {
              const result = await ram_read(this.device, 1);
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
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let chunkCount = 0; // 记录已处理的块数

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();
          while (written < total) {
            // 切bank
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

            // 分包
            const remainingSize = total - written;
            const chunkSize = Math.min(pageSize, remainingSize);
            const chunk = fileData.slice(written, written + chunkSize);

            // 根据RAM类型选择写入方法
            if (ramType === 'FLASH') {
              await ram_program_flash(this.device, chunk, baseAddr);
            } else if (ramType === 'FRAM') {
              const latency = options.framLatency ?? 25;
              await ram_write_fram(this.device, chunk, baseAddr, latency);
            } else {
              await ram_write(this.device, chunk, baseAddr);
            }
            const chunkEndTime = Date.now();

            written += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            const progress = Math.floor((written / total) * 100);

            // 每5个百分比记录一次日志
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
          this.log(`${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const ramType = options.ramType ?? 'SRAM';

    // 如果是免电存档，调用专门的方法
    if (ramType === 'BATLESS') {
      return this.readBatterylessSave(options);
    }

    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);
    const baseAddress = options.baseAddress ?? 0x00;

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.readRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.reading'), 'info');

          const result = new Uint8Array(size);
          let read = 0;
          const startTime = Date.now();

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          while (read < size) {
            // 切bank
            if (read === 0x00000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
            } else if (read === 0x10000) {
              if (ramType === 'FLASH') {
                await this.switchFlashBank(1);
              } else {
                await this.switchSRAMBank(1);
              }
            }

            const baseAddr = read & 0xffff;

            // 分包
            const remainingSize = size - read;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 读取数据
            const chunk = ramType === 'FRAM'
              ? await ram_read_fram(this.device, chunkSize, baseAddr, options.framLatency ?? 25)
              : await ram_read(this.device, chunkSize, baseAddr);
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
        } catch (e) {
          this.log(`${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const ramType = options.ramType ?? 'SRAM';

    // 如果是免电存档，调用专门的方法
    if (ramType === 'BATLESS') {
      return this.verifyBatterylessSave(fileData, options);
    }

    const baseAddress = options.baseAddress ?? 0x00;
    const size = options.size ?? fileData.byteLength;

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
          this.log(`${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
        fileSize: fileData.byteLength,
      },
    );
  }

  /**
   * 获取卡带信息
   * @returns 卡带容量相关信息
   */
  override async getCartInfo(): Promise<CFIInfo | false> {
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.getCartInfo',
      async () => {
        try {
          // CFI Query
          await rom_write(this.device, toLittleEndian(0x98, 2), 0x55);
          const cfiData = await rom_read(this.device, 0x100, 0x00);
          // Reset
          await rom_write(this.device, toLittleEndian(0xf0, 2), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.log(this.t('messages.operation.cfiParseFailed'), 'error');
            return false;
          }

          // 读取Flash ID并添加到CFI信息中
          try {
            const flashId = await rom_get_id(this.device);
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
        } catch (e) {
          this.log(`${this.t('messages.operation.romSizeQueryFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    const h = (bank & 0x0f) << 4;

    await ram_write(this.device, new Uint8Array([h]), 0x02);
    await ram_write(this.device, new Uint8Array([0x40]), 0x03);

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
    await rom_write(this.device, toLittleEndian(bank, 2), 0x800000);
    this.log(this.t('messages.gba.bankSwitchSram', { bank }), 'info');
  }

  /**
   * 切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;

    await ram_write(this.device, new Uint8Array([0xaa]), 0x5555);
    await ram_write(this.device, new Uint8Array([0x55]), 0x2aaa);
    await ram_write(this.device, new Uint8Array([0xb0]), 0x5555); // FLASH_COMMAND_SWITCH_BANK
    await ram_write(this.device, new Uint8Array([bank]), 0x0000);

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
      // 单次读取
      return await rom_read(this.device, size, baseAddress);
    } else {
      // 分块读取
      const result = new Uint8Array(size);
      let offset = 0;

      while (offset < size) {
        const currentChunkSize = Math.min(chunkSize, size - offset);
        const chunkData = await rom_read(this.device, currentChunkSize, baseAddress + offset);
        result.set(chunkData, offset);
        offset += currentChunkSize;
      }

      return result;
    }
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
      const chunkSize = options.romPageSize ?? AdvancedSettings.romPageSize;

      // 切换到相应的bank
      if (isMultiCard) {
        const { bank } = this.romBankRelevantAddress(baseAddress);
        await this.switchROMBank(bank);
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
        await this.switchROMBank(bank);
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
      this.log(`${this.t('messages.ram.batteryless.searchFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
          const eraseResult = await this.eraseSectors(sectorInfo, signal);
          if (!eraseResult.success) {
            return eraseResult;
          }

          // 开始写入
          this.log(this.t('messages.ram.batteryless.startWrite'), 'info');

          let written = 0;
          let currentBank = -1;
          const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

          const speedCalculator = new SpeedCalculator();
          const progressReporter = new ProgressReporter(
            'write',
            writeSize,
            (progressInfo) => {
              this.updateProgress(progressInfo);
            },
            (key, params) => this.t(key, params),
          );

          progressReporter.reportStart(this.t('messages.ram.batteryless.startWrite'));

          while (written < writeSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, writeSize - written);
            const chunk = fileData.slice(written, written + chunkSize);
            const currentAddress = saveInfo.offset + written;

            // 切换bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 写入数据
            await rom_program(this.device, chunk, currentAddress, cfiInfo.bufferSize ?? 0);
            const chunkEndTime = Date.now();

            written += chunkSize;
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 更新进度
            progressReporter.reportProgress(
              written,
              speedCalculator.getCurrentSpeed(),
              this.t('messages.ram.batteryless.writing', { progress: Math.floor((written / writeSize) * 100) }),
            );
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();

          this.log(this.t('messages.ram.batteryless.writeComplete'), 'success');
          this.log(this.t('messages.ram.batteryless.writeSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            totalSize: formatBytes(writeSize),
          }), 'info');

          progressReporter.reportCompleted(this.t('messages.ram.batteryless.writeComplete'), avgSpeed);

          return {
            success: true,
            message: this.t('messages.ram.batteryless.writeSuccess'),
          };
        } catch (e) {
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          this.log(`${this.t('messages.ram.batteryless.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
          const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

          const speedCalculator = new SpeedCalculator();
          const progressReporter = new ProgressReporter(
            'read',
            saveInfo.size,
            (progressInfo) => {
              this.updateProgress(progressInfo);
            },
            (key, params) => this.t(key, params),
          );

          progressReporter.reportStart(this.t('messages.ram.batteryless.startRead'));

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
                this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 读取数据
            const chunk = await rom_read(this.device, chunkSize, currentAddress);
            const chunkEndTime = Date.now();
            data.set(chunk, readCount);

            readCount += chunkSize;
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 更新进度
            progressReporter.reportProgress(
              readCount,
              speedCalculator.getCurrentSpeed(),
              this.t('messages.ram.batteryless.reading', { progress: Math.floor((readCount / saveInfo.size) * 100) }),
            );
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();

          this.log(this.t('messages.ram.batteryless.readComplete', { size: formatBytes(data.length) }), 'success');
          this.log(this.t('messages.ram.batteryless.readSummary', {
            totalTime: formatTimeDuration(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            totalSize: formatBytes(saveInfo.size),
          }), 'info');

          progressReporter.reportCompleted(this.t('messages.ram.batteryless.readComplete', { size: formatBytes(data.length) }), avgSpeed);

          return {
            success: true,
            data: data,
            message: this.t('messages.ram.batteryless.readSuccess', { size: formatBytes(data.length) }),
          };
        } catch (e) {
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          this.log(`${this.t('messages.ram.batteryless.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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

          // 限制校验大小
          const verifySize = Math.min(fileData.byteLength, saveInfo.size);
          this.log(this.t('messages.ram.batteryless.info', {
            offset: formatHex(saveInfo.offset, 4),
            size: formatBytes(saveInfo.size),
            verifySize: formatBytes(verifySize),
          }), 'info');

          // 开始校验
          this.log(this.t('messages.ram.batteryless.startVerify'), 'info');

          let verified = 0;
          let currentBank = -1;
          let success = true;
          let errorCount = 0;
          const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

          const speedCalculator = new SpeedCalculator();
          const progressReporter = new ProgressReporter(
            'verify',
            verifySize,
            (progressInfo) => {
              this.updateProgress(progressInfo);
            },
            (key, params) => this.t(key, params),
          );

          progressReporter.reportStart(this.t('messages.ram.batteryless.startVerify'));

          while (verified < verifySize && success) {
            // 检查是否已被取消
            if (signal?.aborted) {
              return { success: false, message: this.t('messages.operation.cancelled') };
            }

            const chunkSize = Math.min(pageSize, verifySize - verified);
            const currentAddress = saveInfo.offset + verified;

            // 切换bank
            if (isMultiCard) {
              const { bank } = this.romBankRelevantAddress(currentAddress);
              if (bank !== currentBank) {
                this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
                await this.switchROMBank(bank);
                currentBank = bank;
              }
            }

            // 读取数据进行比较
            const readData = await rom_read(this.device, chunkSize, currentAddress);
            const chunkEndTime = Date.now();

            // 逐字节比较
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[verified + i] !== readData[i]) {
                this.log(this.t('messages.ram.verifyMismatch', {
                  address: formatHex(verified + i, 6),
                  expected: formatHex(fileData[verified + i], 2),
                  actual: formatHex(readData[i], 2),
                }), 'error');
                errorCount++;

                // 如果错误太多，停止校验
                if (errorCount > 100) {
                  success = false;
                  break;
                }
              }
            }

            verified += chunkSize;
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 更新进度
            progressReporter.reportProgress(
              verified,
              speedCalculator.getCurrentSpeed(),
              this.t('messages.ram.batteryless.verifying', { progress: Math.floor((verified / verifySize) * 100) }),
            );
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();

          if (success && errorCount === 0) {
            this.log(this.t('messages.ram.batteryless.verifySuccess'), 'success');
            this.log(this.t('messages.ram.batteryless.verifySummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              totalSize: formatBytes(verifySize),
            }), 'info');

            progressReporter.reportCompleted(this.t('messages.ram.batteryless.verifySuccess'), avgSpeed);

            return {
              success: true,
              message: this.t('messages.ram.batteryless.verifySuccess'),
            };
          } else {
            const message = errorCount > 0
              ? this.t('messages.ram.batteryless.verifyFailed', { errorCount })
              : this.t('messages.ram.batteryless.verifyFailed');

            this.log(message, 'error');
            progressReporter.reportError(message);

            return {
              success: false,
              message,
            };
          }
        } catch (e) {
          if (signal?.aborted) {
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          this.log(`${this.t('messages.ram.batteryless.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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

    const data = await rom_read(this.device, size, address);
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
