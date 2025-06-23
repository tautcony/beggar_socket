import { gbc_read, gbc_rom_erase_sector, gbc_rom_get_id, gbc_rom_program, gbc_write } from '@/protocol/beggar_socket/protocol';
import { getFlashId } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { CFIInfo, CFIParser } from '@/utils/cfi-parser';
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
  async readID(): Promise<CommandResult & { idStr?: string }> {
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
          // Chip Erase sequence
          await gbc_write(this.device, new Uint8Array([0xaa]), 0xaaa);
          await gbc_write(this.device, new Uint8Array([0x55]), 0x555);
          await gbc_write(this.device, new Uint8Array([0x80]), 0xaaa);
          await gbc_write(this.device, new Uint8Array([0xaa]), 0xaaa);
          await gbc_write(this.device, new Uint8Array([0x55]), 0x555);
          await gbc_write(this.device, new Uint8Array([0x10]), 0xaaa); // Chip Erase

          // Wait for completion (poll for 0xff)
          let temp;
          do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (signal?.aborted) {
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }
            temp = await gbc_read(this.device, 1, 0);
            this.log(`...... ${temp[0].toString(16).padStart(2, '0').toUpperCase()}`);
          } while (temp[0] !== 0xff);

          this.log(this.t('messages.operation.eraseSuccess'));
          return {
            success: true,
            message: this.t('messages.operation.eraseSuccess'),
          };
        } catch (e) {
          this.log(this.t('messages.operation.eraseFailed'));
          return {
            success: false,
            message: `${this.t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'erase_chip',
      },
      {
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  // ROM Bank 切换
  async switchROMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b0 = bank & 0xff;
    const b1 = (bank >> 8) & 0xff;

    // ROM addr [21:14]
    await gbc_write(this.device, new Uint8Array([b0]), 0x2000);
    // ROM addr [22]
    await gbc_write(this.device, new Uint8Array([b1]), 0x3000);

    // this.log(this.t('messages.rom.bankSwitch', { bank }));
  }

  // RAM Bank 切换
  async switchRAMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b = bank & 0xff;
    // RAM addr [16:13]
    await gbc_write(this.device, new Uint8Array([b]), 0x4000);

    this.log(this.t('messages.ram.bankSwitch', { bank }));
  }

  // 获取卡带信息 - 通过CFI查询
  async getCartInfo(): Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number, cfiInfo?: CFIInfo }> {
    try {
      // CFI Query
      await gbc_write(this.device, new Uint8Array([0x98]), 0xaa);

      // 读取完整的CFI数据 (通常需要1KB的数据)
      const cfiData = await gbc_read(this.device, 0x400, 0x00);

      // Reset CFI查询模式
      await gbc_write(this.device, new Uint8Array([0xf0]), 0x00);

      // 使用CFI解析器解析数据
      const cfiParser = new CFIParser();
      const cfiInfo = cfiParser.parse(cfiData);

      if (!cfiInfo) {
        // 如果CFI解析失败
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
      throw e;
    }
  }

  /**
   * 扇区擦除
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小
   * @returns - 包含成功状态和消息的对象
   */
  async eraseSectors(startAddress: number, endAddress: number, sectorSize: number, signal?: AbortSignal) : Promise<CommandResult> {
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

            const sectorStartTime = Date.now();
            await gbc_rom_erase_sector(this.device, addr);
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
  async writeROM(fileData: Uint8Array, options: CommandOptions = {}, signal?: AbortSignal) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeROM',
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
          let currentBank = -1; // 当前ROM Bank
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

            // 计算bank和地址
            const bank = addr >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (addr & 0x3fff) :
              0x4000 + (addr & 0x3fff);

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
        adapter_type: 'mbc5',
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
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, baseAddress = 0, signal?: AbortSignal) : Promise<CommandResult> {
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

            // 计算bank和地址
            const bank = addr >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (addr & 0x3fff) :
              0x4000 + (addr & 0x3fff);

            // 读取数据
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
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
   * @returns - 包含成功状态和消息的对象
   */
  async verifyROM(fileData: Uint8Array, baseAddress = 0) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyROM',
      async () => {
        const startTime = Date.now(); // 移到 try 块外面以便在 catch 块中使用
        try {
          this.log(this.t('messages.rom.verifying'));

          let currentBank = -123;
          let readCount = 0;
          let success = true;

          while (readCount < fileData.length) {
            // 分包处理
            let chunkSize = fileData.length - readCount;
            chunkSize = Math.min(chunkSize, 4096);

            const romAddress = baseAddress + readCount;

            // 计算bank和地址
            const bank = romAddress >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (romAddress & 0x3fff) :
              0x4000 + (romAddress & 0x3fff);

            // 读取并对比
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[readCount + i] !== chunk[i]) {
                const errorAddr = romAddress + i;
                const errorMessage = this.t('messages.rom.verifyFailed', {
                  address: errorAddr.toString(16).toUpperCase().padStart(8, '0'),
                  expected: fileData[readCount + i].toString(16).toUpperCase().padStart(2, '0'),
                  actual: chunk[i].toString(16).toUpperCase().padStart(2, '0'),
                });
                this.log(errorMessage);
                success = false;
              }
            }

            readCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? ((readCount / 1024) / elapsed).toFixed(1) : '0';
            this.updateProgress(this.createProgressInfo(
              readCount / fileData.length * 100,
              this.t('messages.progress.verifySpeed', { speed: speed }),
              fileData.length,
              readCount,
              startTime,
              parseFloat(speed),
            ));
          }

          const elapsedTime = (Date.now() - startTime) / 1000;
          const message = success ?
            this.t('messages.rom.verifySuccess', { time: elapsedTime.toFixed(3) }) :
            this.t('messages.rom.verifyFailed');
          this.log(message);

          return {
            success: success,
            message: message,
          };
        } catch (e) {
          this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
          const message = `${this.t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`;
          this.log(message);
          return {
            success: false,
            message: message,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'verify_rom',
      },
      {
        fileSize: fileData.length,
        baseAddress,
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  /**
   * 写入RAM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 包含成功状态和消息的对象
   */
  async writeRAM(fileData: Uint8Array, options: CommandOptions = {}) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeRAM',
      async () => {
        const baseAddress = options.baseAddress || 0;

        try {
          this.log(this.t('messages.ram.writing'));

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          const startTime = Date.now();
          let currentBank = -123;
          let writtenCount = 0;
          let maxSpeed = 0;

          while (writtenCount < fileData.length) {
            // 分包处理
            let chunkSize = fileData.length - writtenCount;
            chunkSize = Math.min(chunkSize, 4096);

            const chunk = fileData.slice(writtenCount, writtenCount + chunkSize);
            const ramAddress = baseAddress + writtenCount;

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

            writtenCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (writtenCount / 1024) / elapsed : 0;
            maxSpeed = Math.max(maxSpeed, currentSpeed);
            this.updateProgress(this.createProgressInfo(
              writtenCount / fileData.length * 100,
              this.t('messages.progress.writeSpeed', { speed: currentSpeed.toFixed(1) }),
              fileData.length,
              writtenCount,
              startTime,
              currentSpeed,
            ));
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = totalTime > 0 ? (fileData.length / 1024) / totalTime : 0;

          // Log comprehensive summary
          this.log(this.t('messages.ram.writeSummary', {
            totalTime: totalTime.toFixed(2),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: fileData.length,
          }));

          const message = this.t('messages.ram.writeComplete', { time: totalTime.toFixed(3) });
          this.log(message);

          return {
            success: true,
            message: message,
          };
        } catch (e) {
          const message = `${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`;
          this.log(message);
          return {
            success: false,
            message: message,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'write_ram',
      },
      {
        fileSize: fileData.length,
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param options - 读取参数
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readRAM(size: number, options: CommandOptions = { baseAddress: 0 }) : Promise<CommandResult> {
    const baseAddress = options.baseAddress || 0;
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
          this.log(this.t('messages.ram.reading'));

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          const result = new Uint8Array(size);
          const startTime = Date.now();
          let currentBank = -123;
          let readCount = 0;
          let maxSpeed = 0;

          while (readCount < size) {
            // 分包处理
            let chunkSize = size - readCount;
            chunkSize = Math.min(chunkSize, 4096);

            const ramAddress = baseAddress + readCount;

            // 计算bank和地址
            const bank = ramAddress >> 13;
            const b = bank < 0 ? 0 : bank;
            if (b !== currentBank) {
              currentBank = b;
              await this.switchRAMBank(b);
            }

            const cartAddress = 0xa000 + (ramAddress & 0x1fff);

            // 读取数据
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
            result.set(chunk, readCount);

            readCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (readCount / 1024) / elapsed : 0;
            maxSpeed = Math.max(maxSpeed, currentSpeed);
            this.updateProgress(this.createProgressInfo(
              readCount / size * 100,
              this.t('messages.progress.readSpeed', { speed: currentSpeed.toFixed(1) }),
              size,
              readCount,
              startTime,
              currentSpeed,
            ));
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = totalTime > 0 ? (size / 1024) / totalTime : 0;

          // Log comprehensive summary
          this.log(this.t('messages.ram.readSummary', {
            totalTime: totalTime.toFixed(2),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: size,
          }));

          const message = this.t('messages.ram.readSuccess', { time: totalTime.toFixed(3) });
          this.log(message);

          return {
            success: true,
            data: result,
            message: message,
          };
        } catch (e) {
          const message = `${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`;
          this.log(message);
          return {
            success: false,
            message: message,
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
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  /**
   * 校验RAM
   * @param fileData - 文件数据
   * @param options - 校验选项
   * @returns - 包含成功状态和消息的对象
   */
  async verifyRAM(fileData: Uint8Array, options: CommandOptions = {}) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
      async () => {
        const baseAddress = options.baseAddress || 0;

        try {
          this.log(this.t('messages.ram.verifying'));

          // 开启RAM访问权限
          await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);

          const startTime = Date.now();
          let currentBank = -123;
          let readCount = 0;
          let success = true;

          while (readCount < fileData.length) {
            // 分包处理
            let chunkSize = fileData.length - readCount;
            chunkSize = Math.min(chunkSize, 4096);

            const ramAddress = baseAddress + readCount;

            // 计算bank和地址
            const bank = ramAddress >> 13;
            const b = bank < 0 ? 0 : bank;
            if (b !== currentBank) {
              currentBank = b;
              await this.switchRAMBank(b);
            }

            const cartAddress = 0xa000 + (ramAddress & 0x1fff);

            // 读取并对比
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
            for (let i = 0; i < chunkSize; i++) {
              if (fileData[readCount + i] !== chunk[i]) {
                const errorAddr = ramAddress + i;
                const errorMessage = this.t('messages.ram.verifyFailed', {
                  address: errorAddr.toString(16).toUpperCase().padStart(8, '0'),
                  expected: fileData[readCount + i].toString(16).toUpperCase().padStart(2, '0'),
                  actual: chunk[i].toString(16).toUpperCase().padStart(2, '0'),
                });
                this.log(errorMessage);
                success = false;
              }
            }

            readCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? ((readCount / 1024) / elapsed).toFixed(1) : '0';
            this.updateProgress(this.createProgressInfo(
              readCount / fileData.length * 100,
              this.t('messages.progress.verifySpeed', { speed: speed }),
              fileData.length,
              readCount,
              startTime,
              parseFloat(speed),
            ));
          }

          const elapsedTime = (Date.now() - startTime) / 1000;
          const message = success ?
            this.t('messages.ram.verifySuccess', { time: elapsedTime.toFixed(3) }) :
            this.t('messages.ram.verifyFailed');
          this.log(message);

          return {
            success: success,
            message: message,
          };
        } catch (e) {
          const message = `${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`;
          this.log(message);
          return {
            success: false,
            message: message,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'verify_ram',
      },
      {
        fileSize: fileData.length,
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  // 检查区域是否为空
  async isBlank(address: number, size = 0x200) : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'));

    const bank = address >> 14;
    await this.switchROMBank(bank);

    const cartAddress = bank === 0 ?
      0x0000 + (address & 0x3fff) :
      0x4000 + (address & 0x3fff);

    const data = await gbc_read(this.device, size, cartAddress);
    const isBlank = data.every(byte => byte === 0xff);

    if (isBlank) {
      this.log(this.t('messages.rom.areaIsBlank'));
    } else {
      this.log(this.t('messages.rom.areaNotBlank'));
    }

    return isBlank;
  }
}
