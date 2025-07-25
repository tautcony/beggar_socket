import {
  ram_erase_flash,
  ram_program_flash,
  ram_read,
  ram_write,
  rom_erase_chip,
  rom_erase_sector,
  rom_get_id,
  rom_program,
  rom_read,
  rom_write,
} from '@/protocol/beggar_socket/protocol';
import { getFlashId, toLittleEndian } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { CFIInfo, parseCFI } from '@/utils/cfi-parser';
import { formatBytes, formatHex, formatSpeed } from '@/utils/formatter-utils';
import { calcSectorUsage } from '@/utils/sector-utils';
import { PerformanceTracker } from '@/utils/sentry-tracker';
import { SpeedCalculator } from '@/utils/speed-calculator';

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
   * 读取ROM芯片ID
   * @returns - ID字符串
   */
  override async readID(): Promise<CommandResult & { id?: number[] }> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.readID',
      async () => {
        this.log(this.t('messages.operation.readId'), 'info');
        try {
          const id = [...await rom_get_id(this.device)];

          const idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
          const flashId = getFlashId(id);
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
        adapter_type: 'gba',
        operation_type: 'read_id',
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
              await new Promise(resolve => setTimeout(resolve, 1000));
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
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小（默认64KB）
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(startAddress: number, endAddress: number, sectorSize = 0x10000, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseSectors',
      async () => {
        this.log(this.t('messages.operation.startEraseSectors', {
          startAddress: formatHex(startAddress, 4),
          endAddress: formatHex(endAddress, 4),
          sectorSize,
        }), 'info');

        try {
          // 确保扇区对齐
          const sectorMask = sectorSize - 1;
          const alignedEndAddress = endAddress & ~sectorMask;

          let currentBank = -1;
          let eraseCount = 0;
          const totalSectors = Math.floor((alignedEndAddress - startAddress) / sectorSize) + 1;
          const totalBytes = endAddress - startAddress;
          const startTime = Date.now();

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 从高地址向低地址擦除
          for (let currentAddress = alignedEndAddress; currentAddress >= startAddress; currentAddress -= sectorSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const { bank } = this.romBankRelevantAddress(currentAddress);
            if (endAddress > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            this.log(this.t('messages.operation.eraseSector', {
              from: formatHex(currentAddress, 4),
              to: formatHex(currentAddress + sectorSize - 1, 4),
            }), 'info');

            await rom_erase_sector(this.device, currentAddress);
            const sectorEndTime = Date.now();

            eraseCount++;
            const erasedBytes = eraseCount * sectorSize;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(sectorSize, sectorEndTime);

            // 计算当前速度
            const currentSpeed = speedCalculator.getCurrentSpeed();

            this.updateProgress(this.createProgressInfo(
              (eraseCount / totalSectors) * 100,
              this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
              totalBytes,
              erasedBytes,
              startTime,
              currentSpeed,
              true, // 允许取消
            ));
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.operation.eraseSuccess'), 'success');
          this.log(this.t('messages.operation.eraseSummary', {
            totalTime: SpeedCalculator.formatTime(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSectors: totalSectors,
          }), 'info');

          // 报告完成状态
          this.updateProgress(this.createProgressInfo(
            100,
            this.t('messages.operation.eraseSuccess'),
            totalBytes,
            totalBytes,
            startTime,
            avgSpeed,
            false, // 完成后禁用取消
            'completed',
          ));

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

          this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.eraseSectorFailed')));
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
      {
        startAddress,
        endAddress,
        sectorSize,
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
    const pageSize = AdvancedSettings.romPageSize;
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

          {
            const { bank } = this.romBankRelevantAddress(baseAddress);
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              await this.switchROMBank(bank);
            }
          }

          const blank = await this.isBlank(baseAddress, 0x100);
          if (!blank) {
            const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
            for (const { startAddress, endAddress, sectorSize } of sectorInfo) {
              await this.eraseSectors(startAddress, endAddress, sectorSize, signal);
            }
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
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
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
            if (options.cfiInfo.deviceSize > (1 << 25)) {
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank);
              }
            }

            await rom_program(this.device, chunk, cartAddress, bufferSize);
            const chunkEndTime = Date.now();

            written += chunk.length;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunk.length, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || written >= total) {
              const progress = (written / total) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
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
              this.log(this.t('messages.rom.writingAt', { address: formatHex(baseAddress + written, 4), progress }), 'info');
              lastLoggedProgress = progress;
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.writeComplete'), 'success');
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: SpeedCalculator.formatTime(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(total),
          }), 'info');

          // 报告完成状态
          this.updateProgress(this.createProgressInfo(
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
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.writeFailed')));
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
   * @returns - 操作结果，包含读取的数据
   */
  override async readROM(size = 0x200000, options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = AdvancedSettings.romPageSize;

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
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
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
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
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
              const progress = (totalRead / size) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
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
              this.log(this.t('messages.rom.readingAt', { address: formatHex(baseAddress + totalRead, 4), progress }), 'info');
              lastLoggedProgress = progress;
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
          this.log(this.t('messages.rom.readSummary', {
            totalTime: SpeedCalculator.formatTime(totalTime),
            avgSpeed: formatSpeed(avgSpeed),
            maxSpeed: formatSpeed(maxSpeed),
            totalSize: formatBytes(size),
          }), 'info');

          this.updateProgress(this.createProgressInfo(
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
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.readFailed')));
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
    const pageSize = AdvancedSettings.romPageSize;

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyROM',
      async () => {
        // 检查是否已被取消
        if (signal?.aborted) {
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }
        const startTime = Date.now(); // 移到 try 块外面以便在 catch 块中使用
        try {
          this.log(this.t('messages.rom.verifying'), 'info');

          const total = fileData.byteLength;
          let verified = 0;
          let success = true;
          let failedAddress = -1;
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let currentBank = -1;

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 分块校验并更新进度
          let chunkCount = 0; // 记录已处理的块数
          while (verified < total && success) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, total - verified);
            const expectedChunk = fileData.slice(verified, verified + chunkSize);
            const currentAddress = baseAddress + verified;

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

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || verified >= total) {
              const progress = (verified / total) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.getCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
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
              totalTime: SpeedCalculator.formatTime(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
            }), 'info');
            this.updateProgress(this.createProgressInfo(
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
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
          }

          const message = success ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
          return {
            success: success,
            message: message,
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
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
    const pageSize = AdvancedSettings.ramPageSize;
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
                await new Promise(resolve => setTimeout(resolve, 1000));
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
            totalTime: SpeedCalculator.formatTime(totalTime),
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
    const pageSize = AdvancedSettings.ramPageSize;
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
            const chunk = await ram_read(this.device, chunkSize, baseAddr);
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
            totalTime: SpeedCalculator.formatTime(totalTime),
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
   * 获取卡带信息 - 通过CFI查询
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
          const cfiData = await rom_read(this.device, 0x400, 0x00);
          // Reset
          await rom_write(this.device, toLittleEndian(0xf0, 2), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.log(this.t('messages.operation.cfiParseFailed'), 'error');
            return false;
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
        operation_type: 'get_rom_size',
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
