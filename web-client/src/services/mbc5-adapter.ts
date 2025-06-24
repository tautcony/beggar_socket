import {
  gbc_read,
  gbc_rom_erase_chip,
  gbc_rom_erase_sector,
  gbc_rom_get_id,
  gbc_rom_program,
  gbc_write,
} from '@/protocol/beggar_socket/protocol';
import { getFlashId } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { CFIInfo, parseCFI } from '@/utils/cfi-parser';
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
  override async readID(): Promise<CommandResult & { idStr?: string }> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readID',
      async () => {
        this.log(this.t('messages.operation.readId'));
        try {
          const id = [... await gbc_rom_get_id(this.device)];

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
        this.log(this.t('messages.operation.eraseChip'));

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
        adapter_type: 'mbc5',
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
  override async eraseSectors(startAddress: number, endAddress: number, sectorSize: number, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseSectors',
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

            await gbc_rom_erase_sector(this.device, addr);
            const sectorEndTime = Date.now();

            eraseCount++;
            const erasedBytes = eraseCount * sectorSize;

            // 添加数据点到速度计算器
            speedCalculator.addDataPoint(sectorSize, sectorEndTime);

            // 计算当前速度
            const currentSpeed = speedCalculator.getCurrentSpeed();

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
        adapter_type: 'mbc5',
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
  override async writeROM(fileData: Uint8Array, options: CommandOptions = { baseAddress: 0x00 }, signal?: AbortSignal) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = AdvancedSettings.romPageSize;
    const bufferSize = AdvancedSettings.romBufferSize;

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeROM',
      async () => {
        const startTime = Date.now();
        try {
          this.log(this.t('messages.rom.writing', { size: fileData.length }));

          const total = fileData.length;
          let written = 0;

          const blank = await this.isBlank(baseAddress, 0x100);
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
          let currentBank = -1; // 当前ROM Bank
          for (let currentAddress = baseAddress; currentAddress < baseAddress + total; currentAddress += pageSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunk = fileData.slice(currentAddress, Math.min(currentAddress + pageSize, total));

            // 计算bank和地址
            const bank = currentAddress >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (currentAddress & 0x3fff) :
              0x4000 + (currentAddress & 0x3fff);

            // 写入数据
            await gbc_rom_program(this.device, chunk, cartAddress);
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
              this.log(this.t('messages.rom.writingAt', { address: currentAddress.toString(16).padStart(6, '0'), progress }));
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
        adapter_type: 'mbc5',
        operation_type: 'write_rom',
      },
      {
        fileSize: fileData.length,
        baseAddress,
        pageSize,
        bufferSize,
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
  override async readROM(size: number, options: CommandOptions = { baseAddress: 0x00 }, signal?: AbortSignal) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readROM',
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
          let currentBank = -1;

          for (let currentAddress = baseAddress; currentAddress < baseAddress + size; currentAddress += pageSize) {
            // 检查是否已被取消
            if (signal?.aborted) {
              this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, size - currentAddress);

            // 计算bank和地址
            const bank = currentAddress >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (currentAddress & 0x3fff) :
              0x4000 + (currentAddress & 0x3fff);

            // 读取数据
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
            const chunkEndTime = Date.now();
            data.set(chunk, currentAddress);

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
              this.log(this.t('messages.rom.readingAt', { address: (baseAddress + currentAddress).toString(16).padStart(6, '0'), progress }));
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
  override async verifyROM(fileData: Uint8Array, options: CommandOptions = { baseAddress: 0x00 }, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyROM',
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

          let currentBank = -1;
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
            // 计算bank和地址
            const currentAddress = baseAddress + verified;
            const bank = currentAddress >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (currentAddress & 0x3fff) :
              0x4000 + (currentAddress & 0x3fff);

            // 读取数据
            const actualChunk = await gbc_read(this.device, chunkSize, cartAddress);
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
              const currentSpeed = speedCalculator.getCurrentSpeed();

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
  override async writeRAM(fileData: Uint8Array, options: CommandOptions = { baseAddress: 0x00 }) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.writing', { size: fileData.length }));

          const total = fileData.length;
          let written = 0;
          const pageSize = AdvancedSettings.ramPageSize;

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
  override async readRAM(size: number, options: CommandOptions = { baseAddress: 0x00 }) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.reading'));

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          const result = new Uint8Array(size);
          let currentBank = -1;
          let read = 0;
          const pageSize = AdvancedSettings.ramPageSize;
          const startTime = Date.now();

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
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions = { baseAddress: 0x00 }) : Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.verifying'));

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          let currentBank = -1;
          const total = fileData.length;
          let read = 0;
          const pageSize = AdvancedSettings.ramPageSize;
          let success = true;

          while (read < total) {
            const currAddress = baseAddress + read;
            // 计算bank和地址
            const bank = currAddress >> 13;
            const b = bank < 0 ? 0 : bank;
            if (b !== currentBank) {
              currentBank = b;
              await this.switchRAMBank(b);
            }

            const cartAddress = 0xa000 + (currAddress & 0x1fff);

            // 分包
            const remainingSize = total - currAddress;
            const chunkSize = Math.min(pageSize, remainingSize);

            // 读取数据进行比较
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);

            // 校验数据
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[currAddress + i] !== chunk[i]) {
                this.log(this.t('messages.ram.verifyFailedAt', {
                  address: (currAddress + i).toString(16).padStart(6, '0'),
                  expected: fileData[currAddress + i].toString(16).padStart(2, '0'),
                  actual: chunk[i].toString(16).padStart(2, '0'),
                }));
                success = false;
                break;
              }
            }

            if (!success) break;

            read += chunkSize;
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
        adapter_type: 'mbc5',
        operation_type: 'verify_ram',
      },
      {
        fileSize: fileData.length,
      },
    );
  }

  // 获取卡带信息 - 通过CFI查询
  override async getCartInfo(): Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number, cfiInfo?: CFIInfo }> {
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
          const bufferWriteBytes = cfiInfo.bufferSize ?? 0;

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
  async switchROMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b0 = bank & 0xff;
    const b1 = (bank >> 8) & 0xff;

    // ROM addr [21:14]
    await gbc_write(this.device, new Uint8Array([b0]), 0x2000);
    // ROM addr [22]
    await gbc_write(this.device, new Uint8Array([b1]), 0x3000);

    this.log(this.t('messages.rom.bankSwitch', { bank }));
  }

  /**
   * RAM Bank 切换
   */
  async switchRAMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b = bank & 0xff;
    // RAM addr [16:13]
    await gbc_write(this.device, new Uint8Array([b]), 0x4000);

    this.log(this.t('messages.ram.bankSwitch', { bank }));
  }

  // 检查区域是否为空
  async isBlank(address: number, size = 0x100) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'));

    const bank = address >> 14;
    await this.switchROMBank(bank);

    const cartAddress = bank === 0 ?
      0x0000 + (address & 0x3fff) :
      0x4000 + (address & 0x3fff);

    const data = await gbc_read(this.device, size, cartAddress);
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
export default MBC5Adapter;
