import {
  gbc_read,
  gbc_rom_erase_chip,
  gbc_rom_erase_sector,
  gbc_rom_get_id,
  gbc_rom_program,
  gbc_write,
} from '@/protocol/beggar_socket/protocol';
import { getFlashName } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { timeout } from '@/utils/async-utils';
import { CFIInfo, parseCFI } from '@/utils/cfi-parser';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { calcSectorUsage } from '@/utils/sector-utils';
import { PerformanceTracker } from '@/utils/sentry-tracker';
import { SpeedCalculator } from '@/utils/speed-calculator';

/**
 * MBC5 Adapter - 封装MBC5卡带的协议操作
 */
export class MBC5Adapter extends CartridgeAdapter {
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
   * 读取ROM芯片ID
   * @returns - ID字符串
   */
  override async readID(): Promise<CommandResult & { id?: number[] }> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readID',
      async () => {
        this.log(this.t('messages.operation.readId'), 'info');
        try {
          const id = [... await gbc_rom_get_id(this.device)];

          const idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
          const flashId = getFlashName(id);
          if (flashId === null) {
            this.log(this.t('messages.operation.unknownFlashId'), 'warn');
          } else {
            this.log(`${this.t('messages.operation.readIdSuccess')}: ${idStr} (${flashId})`, 'success');
          }

          return {
            success: true,
            id,
            message: this.t('messages.operation.readIdSuccess'),
          };
        } catch (e) {
          this.log(`${this.t('messages.operation.readIdFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
          return {
            success: false,
            message: this.t('messages.operation.readIdFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'read_id',
      },
      {
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId ?? 'unknown',
      },
    );
  }

  /**
   * 全片擦除
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  override async eraseChip(signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseChip',
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

          await gbc_rom_erase_chip(this.device);

          const startTime = Date.now();
          let elapsedSeconds = 0;

          // 验证擦除是否完成
          while (true) {
            // 检查是否已被取消
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
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(
    sectorInfo: { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[],
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseSectors',
      async () => {
        this.log(this.t('messages.operation.startEraseSectors'), 'info');

        try {
          let currentBank = -1;
          let eraseCount = 0;
          const startTime = Date.now();

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 创建扇区进度信息
          const sectors = this.createSectorProgressInfo(sectorInfo);
          const totalSectors = sectors.length;

          // 计算总字节数
          const totalBytes = sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0);

          // 初始化扇区可视化进度
          this.updateProgress(this.createProgressInfo(
            'erase',
            0,
            this.t('messages.operation.startEraseSectors'),
            totalBytes,
            0,
            startTime,
            0,
            true,
            'running',
            {
              sectors: this.currentSectorProgress,
              totalSectors,
              completedSectors: 0,
              currentSectorIndex: 0,
            },
          ));

          // 按照创建的扇区顺序进行擦除（从高地址到低地址）
          for (const sector of sectors) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo('erase', this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            // 更新当前扇区状态为"正在擦除"
            const sectorIndex = this.updateSectorProgress(sector.address, 'erasing');

            this.log(this.t('messages.operation.eraseSector', {
              from: formatHex(sector.address, 4),
              to: formatHex(sector.address + sector.size - 1, 4),
            }), 'info');

            // 更新进度显示当前正在擦除的扇区
            this.updateProgress(this.createProgressInfo(
              'erase',
              (eraseCount / totalSectors) * 100,
              this.t('messages.operation.eraseSector', {
                from: formatHex(sector.address, 4),
                to: formatHex(sector.address + sector.size - 1, 4),
              }),
              totalBytes,
              eraseCount * sector.size,
              startTime,
              speedCalculator.getCurrentSpeed(),
              true,
              'running',
              {
                sectors: this.currentSectorProgress,
                totalSectors,
                completedSectors: eraseCount,
                currentSectorIndex: sectorIndex,
              },
            ));

            const { bank, cartAddress } = this.romBankRelevantAddress(sector.address);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            await gbc_rom_erase_sector(this.device, cartAddress);
            const sectorEndTime = Date.now();

            // 更新当前扇区状态为"已完成"
            this.updateSectorProgress(sector.address, 'completed');

            eraseCount++;
            const erasedBytes = eraseCount * sector.size;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(sector.size, sectorEndTime);

            // 计算当前速度
            const currentSpeed = speedCalculator.getCurrentSpeed();

            // 更新进度
            this.updateProgress(this.createProgressInfo(
              'erase',
              (eraseCount / totalSectors) * 100,
              this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
              totalBytes,
              erasedBytes,
              startTime,
              currentSpeed,
              true, // 允许取消
              'running',
              {
                sectors: this.currentSectorProgress,
                totalSectors,
                completedSectors: eraseCount,
                currentSectorIndex: sectorIndex,
              },
            ));
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
          this.updateProgress(this.createProgressInfo(
            'erase',
            100,
            this.t('messages.operation.eraseSuccess'),
            totalBytes,
            totalBytes,
            startTime,
            avgSpeed,
            false, // 完成后禁用取消
            'completed',
            {
              sectors: this.currentSectorProgress,
              totalSectors,
              completedSectors: totalSectors,
              currentSectorIndex: totalSectors,
            },
          ));

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

          this.updateProgress(this.createErrorProgressInfo('erase', this.t('messages.operation.eraseSectorFailed')));
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
        const startTime = Date.now();
        try {
          const total = options.size ?? fileData.byteLength;
          let written = 0;
          this.log(this.t('messages.rom.writing', { size: total }), 'info');

          const blank = await this.isBlank(baseAddress, 0x100);
          if (!blank) {
            const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
            await this.eraseSectors(sectorInfo, signal);
          }

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 分块写入并更新进度
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let chunkCount = 0; // 记录已处理的块数
          let currentBank = -1;
          while (written < total) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo('write', this.t('messages.operation.cancelled')));
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

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            await gbc_rom_program(this.device, chunk, cartAddress, bufferSize);
            const chunkEndTime = Date.now();

            written += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || written >= total) {
              const progress = (written / total) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                'write',
                progress,
                this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeed) }),
                total,
                written,
                startTime,
                currentSpeed,
                true, // 允许取消
              ));
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
          this.updateProgress(this.createProgressInfo(
            'write',
            100,
            this.t('messages.rom.writeComplete'),
            total,
            total,
            startTime,
            avgSpeed,
            false, // 完成后禁用取消
            'completed',
          ));

          return {
            success: true,
            message: this.t('messages.rom.writeSuccess'),
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo('write', this.t('messages.rom.writeFailed')));
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
   * @returns - 包含成功状态、数据和消息的对象
   */
  override async readROM(size: number, options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readROM',
      async () => {
        const startTime = Date.now();
        try {
          // 检查是否已被取消
          if (signal?.aborted) {
            this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.operation.cancelled')));
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

          // 分块读取以便计算速度统计
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let chunkCount = 0; // 记录已处理的块数
          let currentBank = -1;

          while (totalRead < size) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, size - totalRead);
            const currentAddress = baseAddress + totalRead;

            // 计算bank和地址
            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
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
              const progress = (totalRead / size) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                'read',
                progress,
                this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }),
                size,
                totalRead,
                startTime,
                currentSpeed,
                true, // 允许取消
              ));
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

          this.updateProgress(this.createProgressInfo(
            'read',
            100,
            this.t('messages.rom.readSuccess', { size: data.length }),
            size,
            size,
            startTime,
            avgSpeed,
            false,
            'completed',
          ));

          return {
            success: true,
            data: data,
            message: this.t('messages.rom.readSuccess', { size: data.length }),
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.rom.readFailed')));
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
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = Math.min(options.romPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.length,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyROM',
      async () => {
        // 检查是否已被取消
        if (signal?.aborted) {
          this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.operation.cancelled')));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }
        const startTime = Date.now(); // 移到 try 块外面以便在 catch 块中使用
        try {
          this.log(this.t('messages.rom.verifying'), 'info');

          let currentBank = -1;
          const total = fileData.length;
          let verified = 0;
          let success = true;
          let failedAddress = -1;
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 分块校验并更新进度
          let chunkCount = 0; // 记录已处理的块数
          while (verified < total && success) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, total - verified);
            const expectedChunk = fileData.slice(verified, verified + chunkSize);

            const currentAddress = baseAddress + verified;
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
                  address:  formatHex(failedAddress, 4),
                  expected: formatHex(expectedChunk[i], 1),
                  actual: formatHex(actualChunk[i], 1),
                }), 'error');
                break;
              }
            }

            if (!success) break;

            verified += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || verified >= total) {
              const progress = (verified / total) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                'read',
                progress,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
                total,
                verified,
                startTime,
                currentSpeed,
                true, // 允许取消
              ));
            }

            // 每5%记录一次日志
            const progress = Math.floor((verified / total) * 100);
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.rom.verifyingAt', {
                address: formatHex(baseAddress + verified, 4),
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
            this.updateProgress(this.createProgressInfo(
              'read',
              100,
              this.t('messages.rom.verifySuccess'),
              total,
              total,
              startTime,
              avgSpeed,
              false,
              'completed',
            ));
          } else {
            this.log(this.t('messages.rom.verifyFailed'), 'error');
            this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.rom.verifyFailed')));
          }

          const message = success ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
          return {
            success: success,
            message: message,
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.rom.verifyFailed')));
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
        fileSize: fileData.length,
        baseAddress: baseAddress,
      },
    );
  }

  /**
   * 写入RAM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 包含成功状态和消息的对象
   */
  override async writeRAM(fileData: Uint8Array, options: CommandOptions) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);

    this.log(this.t('messages.operation.startWriteRAM', {
      fileSize: fileData.length,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.writing', { size: fileData.length }), 'info');

          const total = fileData.length;
          let written = 0;

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          const startTime = Date.now();
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
            const bank = ramAddress >> 13;
            const b = bank < 0 ? 0 : bank;
            if (b !== currentBank) {
              currentBank = b;
              await this.switchRAMBank(b);
            }

            const cartAddress = 0xa000 + (ramAddress & 0x1fff);

            // 写入数据
            await gbc_write(this.device, chunk, cartAddress);

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
      },
      {
        fileSize: fileData.length,
        baseAddress,
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
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
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
            const bank = ramAddress >> 13;
            const b = bank < 0 ? 0 : bank;
            if (b !== currentBank) {
              currentBank = b;
              await this.switchRAMBank(b);
            }

            const cartAddress = 0xa000 + (ramAddress & 0x1fff);

            // 分包
            const remainingSize = size - read;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 读取数据
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
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
        adapter_type: 'mbc5',
        operation_type: 'read_ram',
      },
      {
        dataSize: size,
        baseAddress,
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
    const pageSize = Math.min(options.ramPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);

    this.log(this.t('messages.operation.startVerifyRAM', {
      fileSize: fileData.length,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.verifying'), 'info');

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          let currentBank = -1;
          const total = fileData.length;
          let read = 0;
          let success = true;

          while (read < total) {
            const currAddress = baseAddress + read;
            // 计算bank和地址
            const { bank, cartAddress } = this.ramBankRelevantAddress(currAddress);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchRAMBank(bank);
            }
            // 分包
            const remainingSize = total - currAddress;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 读取数据进行比较
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);

            // 校验数据
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[currAddress + i] !== chunk[i]) {
                this.log(this.t('messages.ram.verifyFailedAt', {
                  address: formatHex(currAddress + i, 4),
                  expected: formatHex(fileData[currAddress + i], 1),
                  actual: formatHex(chunk[i], 1),
                }), 'error');
                success = false;
                break;
              }
            }

            if (!success) break;

            read += chunkSize;
          }

          const message = success ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');
          this.log(`${this.t('messages.ram.verify')}: ${message}`, success ? 'success' : 'error');

          return {
            success: success,
            message: message,
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
      },
      {
        fileSize: fileData.length,
      },
    );
  }

  // 获取卡带信息 - 通过CFI查询
  override async getCartInfo(): Promise<CFIInfo | false> {
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.getCartInfo',
      async () => {
        try {
          // CFI Query
          await gbc_write(this.device, new Uint8Array([0x98]), 0xaa);
          const cfiData = await gbc_read(this.device, 0x400, 0x00);
          // Reset
          await gbc_write(this.device, new Uint8Array([0xf0]), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.log(this.t('messages.operation.cfiParseFailed'), 'error');
            return false;
          }

          // 记录CFI解析结果
          this.log(this.t('messages.operation.cfiParseSuccess'), 'info');
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

    const b0 = bank & 0xff;
    const b1 = (bank >> 8) & 0xff;

    // ROM addr [21:14]
    await gbc_write(this.device, new Uint8Array([b0]), 0x2000);
    // ROM addr [22]
    await gbc_write(this.device, new Uint8Array([b1]), 0x3000);

    this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
  }

  /**
   * RAM Bank 切换
   */
  async switchRAMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b = bank & 0xff;
    // RAM addr [16:13]
    await gbc_write(this.device, new Uint8Array([b]), 0x4000);

    this.log(this.t('messages.ram.bankSwitch', { bank }), 'info');
  }

  // 检查区域是否为空
  async isBlank(address: number, size = 0x100) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');

    const { bank, cartAddress } = this.romBankRelevantAddress(address);
    await this.switchROMBank(bank);

    const data = await gbc_read(this.device, size, cartAddress);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'success');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'info');
    }

    return blank;
  }

  romBankRelevantAddress(address: number) {
    const bank = address >> 14;
    const b = bank < 0 ? 0 : bank;

    /*
    const cartAddress = b === 0 ?
      0x0000 + (address & 0x3fff) :
      0x4000 + (address & 0x3fff);
    */
    const cartAddress = 0x4000 + (address & 0x3fff);

    return {
      bank: b,
      cartAddress,
    };
  }

  ramBankRelevantAddress(address: number) {
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
