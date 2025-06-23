import {
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
  async readID(): Promise<CommandResult & { idStr?: string }> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.readID',
      async () => {
        this.log(this.t('messages.operation.readId'));
        try {
          const id = [...await rom_get_id(this.device)];

          const idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
          const flashId = getFlashId(id);
          if (flashId === null) {
            this.log(this.t('messages.operation.unknownFlashId'));
          } else {
            this.log(`${this.t('messages.operation.readIdSuccess')}: ${idStr} (${flashId})`);
          }

          return {
            success: true,
            idStr,
            message: this.t('messages.operation.readIdSuccess'),
          };
        } catch (e) {
          this.log(`${this.t('messages.operation.readIdFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
      {
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  /**
   * 全片擦除
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async eraseChip(signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'));

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
              this.log(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const eraseComplete = await this.isBlank(0x00, 0x100);
            elapsedSeconds = Date.now() - startTime;
            if (eraseComplete) {
              this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedSeconds / 1000).toFixed(1)}s)`);
              break;
            } else {
              this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedSeconds / 1000).toFixed(1)}s)`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          return {
            success: true,
            message: this.t('messages.operation.eraseComplete'),
          };
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'));
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          this.log(`${this.t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
  async eraseSectors(startAddress: number = 0, endAddress: number, sectorSize = 0x10000, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.eraseSectors',
      async () => {
        try {
          // 确保扇区对齐
          const sectorMask = sectorSize - 1;
          const alignedEndAddress = endAddress & ~sectorMask;

          let eraseCount = 0;
          const totalSectors = Math.floor((alignedEndAddress - startAddress) / sectorSize) + 1;
          const totalBytes = endAddress - startAddress;
          const startTime = Date.now();

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 从高地址向低地址擦除
          for (let addr = alignedEndAddress; addr >= startAddress; addr -= sectorSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            this.log(this.t('messages.operation.eraseSector', {
              from: addr.toString(16).toUpperCase().padStart(8, '0'),
              to: (addr + sectorSize - 1).toString(16).toUpperCase().padStart(8, '0'),
            }));

            const sectorStartTime = Date.now();
            await rom_erase_sector(this.device, addr);
            const sectorEndTime = Date.now();

            eraseCount++;
            const erasedBytes = eraseCount * sectorSize;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(sectorSize, sectorEndTime);

            // 计算当前速度
            const currentSpeed = speedCalculator.calculateCurrentSpeed();

            this.updateProgress(this.createProgressInfo(
              (eraseCount / totalSectors) * 100,
              this.t('messages.progress.eraseSpeed', { speed: currentSpeed.toFixed(1) }),
              totalBytes,
              erasedBytes,
              startTime,
              currentSpeed,
              true, // 允许取消
            ));
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(totalBytes, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.operation.eraseSuccess'));
          this.log(this.t('messages.operation.eraseSummary', {
            totalTime: totalTime.toFixed(1),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSectors: totalSectors,
          }));

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
            this.log(this.t('messages.operation.cancelled'));
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.eraseSectorFailed')));
          this.log(`${this.t('messages.operation.eraseSectorFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
  async writeROM(fileData: Uint8Array, options: CommandOptions = {}, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.writeROM',
      async () => {
        const startTime = Date.now();
        try {
          this.log(this.t('messages.rom.writing', { size: fileData.length }));

          const baseAddr = options.baseAddress ?? 0x00;
          const pageSize = AdvancedSettings.romPageSize;
          const bufferSize = options.bufferSize ?? 0x200;

          const total = fileData.length;
          let written = 0;

          const blank = await this.isBlank(baseAddr, 0x100);
          if (!blank) {
            const romInfo = await this.getCartInfo();
            const startAddress = 0x00;
            const endAddress = romInfo.sectorCount * romInfo.sectorSize;
            await this.eraseSectors(startAddress, endAddress, romInfo.sectorSize, signal);
          }

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 分块写入并更新进度
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let chunkCount = 0; // 记录已处理的块数
          for (let addr = baseAddr; addr < total; addr += pageSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunk = fileData.slice(addr, Math.min(addr + pageSize, total));
            const chunkStartTime = Date.now();
            await rom_program(this.device, chunk, addr, bufferSize);
            const chunkEndTime = Date.now();

            written += chunk.length;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunk.length, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || written >= total) {
              const progress = (written / total) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.calculateCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                progress,
                this.t('messages.progress.writeSpeed', { speed: currentSpeed.toFixed(1) }),
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
              this.log(this.t('messages.rom.writingAt', { address: addr.toString(16).padStart(6, '0'), progress }));
              lastLoggedProgress = progress;
            }
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(total, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.writeComplete'));
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: totalTime.toFixed(1),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: (total / 1024).toFixed(1),
          }));

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
          this.log(`${this.t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
        fileSize: fileData.length,
        baseAddress: options.baseAddress || 0,
        bufferSize: options.bufferSize || 512,
        pageSize: AdvancedSettings.romPageSize,
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
  async readROM(size = 0x200000, baseAddress = 0, signal?: AbortSignal) : Promise<CommandResult> {
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

          this.log(this.t('messages.rom.reading'));
          const pageSize = AdvancedSettings.romPageSize;
          let totalRead = 0;

          const data = new Uint8Array(size);

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          // 分块读取以便计算速度统计
          let lastLoggedProgress = -1; // 初始化为-1，确保第一次0%会被记录
          let chunkCount = 0; // 记录已处理的块数
          for (let addr = 0; addr < size; addr += pageSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, size - addr);
            const chunkStartTime = Date.now();
            const chunk = await rom_read(this.device, chunkSize, baseAddress + addr);
            const chunkEndTime = Date.now();
            data.set(chunk, addr);

            totalRead += chunkSize;
            chunkCount++;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 每10次操作或最后一次更新进度
            if (chunkCount % 10 === 0 || totalRead >= size) {
              const progress = (totalRead / size) * 100;

              // 计算当前速度
              const currentSpeed = speedCalculator.calculateCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                progress,
                this.t('messages.progress.readSpeed', { speed: currentSpeed.toFixed(1) }),
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
              this.log(this.t('messages.rom.readingAt', { address: (baseAddress + addr).toString(16).padStart(6, '0'), progress }));
              lastLoggedProgress = progress;
            }
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(size, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.rom.readSuccess', { size: data.length }));
          this.log(this.t('messages.rom.readSummary', {
            totalTime: totalTime.toFixed(1),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: (size / 1024).toFixed(1),
          }));

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
          this.log(`${this.t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
  async verifyROM(fileData: Uint8Array, baseAddress = 0, signal?: AbortSignal): Promise<CommandResult> {
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
          this.log(this.t('messages.rom.verifying'));

          const total = fileData.length;
          let verified = 0;
          const pageSize = AdvancedSettings.romPageSize;
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
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, total - verified);
            const expectedChunk = fileData.slice(verified, verified + chunkSize);

            // 读取对应的ROM数据
            const chunkStartTime = Date.now();
            const actualChunk = await rom_read(this.device, chunkSize, baseAddress + verified);
            const chunkEndTime = Date.now();

            // 逐字节比较
            for (let i = 0; i < chunkSize; i++) {
              if (expectedChunk[i] !== actualChunk[i]) {
                success = false;
                failedAddress = verified + i;
                this.log(this.t('messages.rom.verifyFailedAt', {
                  address: failedAddress.toString(16).padStart(6, '0'),
                  expected: expectedChunk[i].toString(16).padStart(2, '0'),
                  actual: actualChunk[i].toString(16).padStart(2, '0'),
                }));
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
              const currentSpeed = speedCalculator.calculateCurrentSpeed();

              this.updateProgress(this.createProgressInfo(
                progress,
                this.t('messages.progress.verifySpeed', { speed: currentSpeed.toFixed(1) }),
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
                address: verified.toString(16).padStart(6, '0'),
                progress,
              }));
              lastLoggedProgress = progress;
            }
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(total, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          if (success) {
            this.log(this.t('messages.rom.verifySuccess'));
            this.log(this.t('messages.rom.verifySummary', {
              totalTime: totalTime.toFixed(1),
              avgSpeed: avgSpeed.toFixed(1),
              maxSpeed: maxSpeed.toFixed(1),
              totalSize: (total / 1024).toFixed(1),
            }));
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
            this.log(this.t('messages.rom.verifyFailed'));
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
          }

          const message = success ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
          return {
            success: success,
            message: message,
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
          this.log(`${this.t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
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
        fileSize: fileData.length,
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
  async writeRAM(fileData: Uint8Array, options: CommandOptions = { ramType: 'SRAM' }): Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'gba.writeRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.writing', { size: fileData.length }));

          const total = fileData.length;
          let written = 0;
          const pageSize = AdvancedSettings.ramPageSize;
          if (options.ramType === 'FLASH') {
            this.log(this.t('messages.gba.erasingFlash'));
            await ram_write(this.device, new Uint8Array([0xaa]), 0x5555);
            await ram_write(this.device, new Uint8Array([0x55]), 0x2aaa);
            await ram_write(this.device, new Uint8Array([0x80]), 0x5555);
            await ram_write(this.device, new Uint8Array([0xaa]), 0x5555);
            await ram_write(this.device, new Uint8Array([0x55]), 0x2aaa);
            await ram_write(this.device, new Uint8Array([0x10]), 0x5555); // Chip-Erase

            // 等待擦除完成
            let erased = false;
            while (!erased) {
              const result = await ram_read(this.device, 1, 0x0000);
              this.log(this.t('messages.gba.eraseStatus', { status: result[0].toString(16) }));
              if (result[0] === 0xff) {
                this.log(this.t('messages.gba.eraseComplete'));
                this.updateProgress(this.createProgressInfo(
                  100,
                  this.t('messages.progress.eraseCompleteReady'),
                  total,
                  written,
                  Date.now(),
                  0,
                ));
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
              if (options.ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
            } else if (written === 0x10000) {
              if (options.ramType === 'FLASH') {
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
            const chunkStartTime = Date.now();
            if (options.ramType === 'FLASH') {
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
              this.log(this.t('messages.ram.writingAt', { address: written.toString(16).padStart(6, '0'), progress }));
              lastLoggedProgress = progress;
            }
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(total, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.writeComplete'));
          this.log(this.t('messages.ram.writeSummary', {
            totalTime: totalTime.toFixed(1),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: (total / 1024).toFixed(1),
          }));

          return {
            success: true,
            message: this.t('messages.ram.writeSuccess'),
          };
        } catch (e) {
          this.log(`${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
          return {
            success: false,
            message: this.t('messages.ram.writeFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'write_ram',
        ram_type: options.ramType || 'SRAM',
      },
      {
        fileSize: fileData.length,
      },
    );
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param options - 读取参数
   * @returns - 操作结果，包含读取的数据
   */
  async readRAM(size = 0x8000, options: CommandOptions = { ramType: 'SRAM' }) {
    return PerformanceTracker.trackAsyncOperation(
      'gba.readRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.reading'));

          const result = new Uint8Array(size);
          let read = 0;
          const pageSize = AdvancedSettings.ramPageSize;
          const startTime = Date.now();

          // 使用速度计算器
          const speedCalculator = new SpeedCalculator();

          while (read < size) {
            // 切bank
            if (read === 0x00000) {
              if (options.ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
            } else if (read === 0x10000) {
              if (options.ramType === 'FLASH') {
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
            const chunkStartTime = Date.now();
            const chunk = await ram_read(this.device, chunkSize, baseAddr);
            const chunkEndTime = Date.now();
            result.set(chunk, read);

            read += chunkSize;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = SpeedCalculator.calculateAverageSpeed(size, totalTime);
          const maxSpeed = speedCalculator.getMaxSpeed();

          this.log(this.t('messages.ram.readSuccess', { size: result.length }));
          this.log(this.t('messages.ram.readSummary', {
            totalTime: totalTime.toFixed(1),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: (size / 1024).toFixed(1),
          }));

          return {
            success: true,
            data: result,
            message: this.t('messages.ram.readSuccess', { size: result.length }),
          };
        } catch (e) {
          this.log(`${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
          return {
            success: false,
            message: this.t('messages.ram.readFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'read_ram',
        ram_type: options.ramType || 'SRAM',
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
  async verifyRAM(fileData: Uint8Array, options: CommandOptions = { ramType: 'SRAM' }) {
    return PerformanceTracker.trackAsyncOperation(
      'gba.verifyRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.verifying'));

          const total = fileData.length;
          let currAddress = options.baseAddress || 0;
          const pageSize = AdvancedSettings.ramPageSize;
          let success = true;

          while (currAddress < total) {
            // 切bank
            if (currAddress === 0x00000) {
              if (options.ramType === 'FLASH') {
                await this.switchFlashBank(0);
              } else {
                await this.switchSRAMBank(0);
              }
            } else if (currAddress === 0x10000) {
              if (options.ramType === 'FLASH') {
                await this.switchFlashBank(1);
              } else {
                await this.switchSRAMBank(1);
              }
            }

            const relAddress = currAddress & 0xffff;

            // 分包
            const remainingSize = total - currAddress;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 读取数据进行比较
            const readData = await ram_read(this.device, chunkSize, relAddress);

            // 校验数据
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[currAddress + i] !== readData[i]) {
                this.log(this.t('messages.ram.verifyFailedDetail', {
                  address: (currAddress + i).toString(16),
                  expected: fileData[currAddress + i].toString(16),
                  actual: readData[i].toString(16),
                }));
                success = false;
                break;
              }
            }

            if (!success) break;

            currAddress += chunkSize;
          }

          const message = success ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');
          this.log(`${this.t('messages.ram.verify')}: ${message}`);

          return {
            success: success,
            message: message,
          };
        } catch (e) {
          this.log(`${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
          return {
            success: false,
            message: this.t('messages.ram.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'gba',
        operation_type: 'verify_ram',
        ram_type: options.ramType || 'SRAM',
      },
      {
        fileSize: fileData.length,
      },
    );
  }

  /**
   * 获取卡带信息 - 通过CFI查询
   * @returns 卡带容量相关信息
   */
  async getCartInfo(): Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number, cfiInfo?: CFIInfo }> {
    return PerformanceTracker.trackAsyncOperation(
      'GBA:getROMSize',
      async () => {
        try {
          this.log(this.t('messages.operation.queryingRomSize'));

          // CFI Query
          await rom_write(this.device, toLittleEndian(0x98, 2), 0x55);
          const cfiData = await rom_read(this.device, 0x400, 0x00);
          // Reset
          await rom_write(this.device, toLittleEndian(0xf0, 2), 0x00);

          const cfiInfo = parseCFI(cfiData);

          if (!cfiInfo) {
            this.log(this.t('messages.operation.cfiParseFailed'));
            return {
              deviceSize: -1,
              sectorCount: -1,
              sectorSize: -1,
              bufferWriteBytes: -1,
              cfiInfo: undefined,
            };
          }

          // 从CFI信息中提取所需数据
          const deviceSize = cfiInfo.deviceSize;
          const bufferWriteBytes = cfiInfo.bufferSize || 0;

          // 获取第一个擦除区域的信息作为主要扇区信息
          const sectorSize = cfiInfo.eraseSectorBlocks.length > 0 ? cfiInfo.eraseSectorBlocks[0][0] : 0;
          const sectorCount = cfiInfo.eraseSectorBlocks.length > 0 ? cfiInfo.eraseSectorBlocks[0][1] : 0;

          // 记录CFI解析结果
          this.log(this.t('messages.operation.cfiParseSuccess'));
          this.log(cfiInfo.info);

          this.log(this.t('messages.operation.romSizeQuerySuccess', {
            deviceSize: deviceSize.toString(),
            sectorCount: sectorCount.toString(),
            sectorSize: sectorSize.toString(),
            bufferWriteBytes: bufferWriteBytes.toString(),
          }));

          return {
            deviceSize,
            sectorCount,
            sectorSize,
            bufferWriteBytes,
            cfiInfo,
          };
        } catch (e) {
          this.log(`${this.t('messages.operation.romSizeQueryFailed')}: ${e instanceof Error ? e.message : String(e)}`);
          return {
            deviceSize: -1,
            sectorCount: -1,
            sectorSize: -1,
            bufferWriteBytes: -1,
            cfiInfo: undefined,
          };
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
  async switchROMBank(bank: number, isBankIn4m = false) : Promise<void> {
    if (bank < 0) return;

    if (isBankIn4m) {
      const h = ((bank / 8) & 0x0f) << 4;
      const l = 0x40 | ((bank % 8) << 3);

      await ram_write(this.device, new Uint8Array([h]), 0x02);
      await ram_write(this.device, new Uint8Array([l]), 0x03);
    } else {
      const h = (bank & 0x0f) << 4;

      await ram_write(this.device, new Uint8Array([h]), 0x02);
      await ram_write(this.device, new Uint8Array([0x40]), 0x03);
    }
  }

  /**
   * 切换SRAM的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;
    this.log(this.t('messages.gba.bankSwitchSram', { bank }));
    await rom_write(this.device, toLittleEndian(bank, 2), 0x800000);
  }

  /**
   * 切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;
    this.log(this.t('messages.gba.bankSwitchFlash', { bank }));

    await ram_write(this.device, new Uint8Array([0xaa]), 0x5555);
    await ram_write(this.device, new Uint8Array([0x55]), 0x2aaa);
    await ram_write(this.device, new Uint8Array([0xb0]), 0x5555); // FLASH_COMMAND_SWITCH_BANK
    await ram_write(this.device, new Uint8Array([bank]), 0x0000);
  }

  // 检查区域是否为空
  async isBlank(address: number, size = 0x100) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'));

    const data = await rom_read(this.device, size, address);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'));
    } else {
      this.log(this.t('messages.rom.areaNotBlank'));
    }

    return blank;
  }
}

// 默认导出
export default GBAAdapter;
