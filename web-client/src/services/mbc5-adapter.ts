import { gbc_direct_write, gbc_read, gbc_rom_program } from '@/protocol/beggar_socket/protocol';
import { CartridgeAdapter, EnhancedProgressCallback, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';

import { PerformanceTracker } from '../utils/sentry';

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
   * @param enhancedProgressCallback - 增强进度回调函数
   */
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
    enhancedProgressCallback: EnhancedProgressCallback | null = null,
  ) {
    super(device, logCallback, progressCallback, translateFunc, enhancedProgressCallback);
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
          // Enter autoselect mode
          await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa);
          await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555);
          await gbc_direct_write(this.device, new Uint8Array([0x90]), 0xaaa);

          // Read ID (4 bytes)
          const id = await gbc_read(this.device, 4, 0);

          // Reset
          await gbc_direct_write(this.device, new Uint8Array([0xf0]), 0x00);

          const idStr = Array.from(id).map(x => x.toString(16).padStart(2, '0')).join(' ');
          this.log(this.t('messages.operation.readIdSuccess'));

          await this.getROMSize();

          return {
            success: true,
            idStr,
            message: this.t('messages.operation.readIdSuccess'),
          };
        } catch (e) {
          this.log(`${this.t('messages.operation.readIdFailed')}: ${e}`);
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
   * @returns - 包含成功状态和消息的对象
   */
  async eraseChip() : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'));

        try {
          // Chip Erase sequence
          await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa);
          await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555);
          await gbc_direct_write(this.device, new Uint8Array([0x80]), 0xaaa);
          await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa);
          await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555);
          await gbc_direct_write(this.device, new Uint8Array([0x10]), 0xaaa); // Chip Erase

          // Wait for completion (poll for 0xff)
          let temp;
          do {
            await new Promise(resolve => setTimeout(resolve, 1000));
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
            message: `${this.t('messages.operation.eraseFailed')}: ${e}`,
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
    await gbc_direct_write(this.device, new Uint8Array([b0]), 0x2000);
    // ROM addr [22]
    await gbc_direct_write(this.device, new Uint8Array([b1]), 0x3000);

    this.log(this.t('messages.rom.bankSwitch', { bank }));
  }

  // RAM Bank 切换
  async switchRAMBank(bank: number) : Promise<void> {
    if (bank < 0) return;

    const b = bank & 0xff;
    // RAM addr [16:13]
    await gbc_direct_write(this.device, new Uint8Array([b]), 0x4000);

    this.log(this.t('messages.ram.bankSwitch', { bank }));
  }

  // 获取ROM容量信息 - 通过CFI查询
  async getROMSize() : Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number }> {
    try {
      // CFI Query
      await gbc_direct_write(this.device, new Uint8Array([0x98]), 0xaa);

      // 读取设备大小 (0x4e地址)
      const deviceSizeData = await gbc_read(this.device, 1, 0x4e);
      const deviceSize = Math.pow(2, deviceSizeData[0]);

      // 读取buffer写入大小 (0x56和0x54地址)
      const buffSizeHigh = await gbc_read(this.device, 1, 0x56);
      const buffSizeLow = await gbc_read(this.device, 1, 0x54);
      let bufferWriteBytes = (buffSizeHigh[0] << 8) | buffSizeLow[0];
      if (bufferWriteBytes === 0) {
        bufferWriteBytes = 0;
      } else {
        bufferWriteBytes = Math.pow(2, buffSizeLow[0]);
      }

      // 读取扇区信息
      const sectorCountHigh = await gbc_read(this.device, 1, 0x5c);
      const sectorCountLow = await gbc_read(this.device, 1, 0x5a);
      const sectorCount = ((sectorCountHigh[0] << 8) | sectorCountLow[0]) + 1;

      const sectorSizeHigh = await gbc_read(this.device, 1, 0x60);
      const sectorSizeLow = await gbc_read(this.device, 1, 0x5e);
      const sectorSize = ((sectorSizeHigh[0] << 8) | sectorSizeLow[0]) * 256;

      // Reset
      await gbc_direct_write(this.device, new Uint8Array([0xf0]), 0x00);

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
      };
    } catch (error) {
      this.log(`${this.t('messages.operation.romSizeQueryFailed')}: ${error}`);
      throw error;
    }
  }

  /**
   * 扇区擦除
   * @param addrFrom - 起始地址
   * @param addrTo - 结束地址
   * @param sectorSize - 扇区大小
   * @returns - 包含成功状态和消息的对象
   */
  async eraseSectors(addrFrom: number, addrTo: number, sectorSize: number) : Promise<CommandResult> {
    const sectorMask = sectorSize - 1;
    addrTo &= ~sectorMask;

    this.log(this.t('messages.operation.eraseSector', {
      from: addrFrom.toString(16).toUpperCase().padStart(8, '0'),
      to: addrTo.toString(16).toUpperCase().padStart(8, '0'),
    }));

    try {
      const totalSectors = Math.floor((addrTo - addrFrom) / sectorSize) + 1;
      let erasedSectors = 0;
      const startTime = Date.now();

      for (let sa = addrTo; sa >= addrFrom; sa -= sectorSize) {
        this.log(`    0x${sa.toString(16).toUpperCase().padStart(8, '0')}`);

        const bank = sa >> 14;
        await this.switchROMBank(bank);

        let sectorAddr;
        if (bank === 0) {
          sectorAddr = 0x0000 + (sa & 0x3fff);
        } else {
          sectorAddr = 0x4000 + (sa & 0x3fff);
        }

        // Sector Erase sequence
        await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa);
        await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555);
        await gbc_direct_write(this.device, new Uint8Array([0x80]), 0xaaa);
        await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa);
        await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555);
        await gbc_direct_write(this.device, new Uint8Array([0x30]), sectorAddr); // Sector Erase

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? ((erasedSectors + 1) / elapsed).toFixed(1) : '0';
        this.updateProgress((erasedSectors + 1) / totalSectors * 100, `擦除速度: ${speed} 扇区/秒`);

        // Wait for completion
        let temp;
        do {
          await new Promise(resolve => setTimeout(resolve, 20));
          temp = await gbc_read(this.device, 1, sectorAddr);
        } while (temp[0] !== 0xff);

        erasedSectors++;
      }

      return {
        success: true,
        message: this.t('messages.operation.eraseSuccess'),
      };
    } catch (error) {
      this.log(this.t('messages.operation.eraseFailed'));
      return {
        success: false,
        message: `${this.t('messages.operation.eraseFailed')}: ${error}`,
      };
    }
  }

  /**
   * 写入ROM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 包含成功状态和消息的对象
   */
  async writeROM(fileData: Uint8Array, options: CommandOptions = {}) : Promise<CommandResult> {
    return PerformanceTracker.trackProgressOperation(
      'mbc5.writeROM',
      async (progressCallback) => {
        const baseAddress = options.baseAddress || 0;
        // const romSize = options.romSize || null;

        const isBlank = await this.isBlank(baseAddress);
        if (!isBlank) {
          this.log(this.t('messages.rom.eraseBeforeWrite'));
          const sizeInfo = await this.getROMSize();
          await this.eraseSectors(0, fileData.length - 1, sizeInfo.sectorSize);
        }

        try {
          const { sectorSize, bufferWriteBytes } = await this.getROMSize();

          this.log(`Sector Size: ${sectorSize}`);
          this.log(`Buffer Write Bytes: ${bufferWriteBytes}`);
          this.log(this.t('messages.rom.writing', fileData.length));

          const startTime = Date.now();
          let currentBank = -123;
          let writtenCount = 0;
          let maxSpeed = 0;

          while (writtenCount < fileData.length) {
            // 分包处理
            let chunkSize = fileData.length - writtenCount;
            chunkSize = Math.min(chunkSize, 4096);

            const chunk = fileData.slice(writtenCount, writtenCount + chunkSize);
            const romAddress = baseAddress + writtenCount;

            // 计算bank和地址
            const bank = romAddress >> 14;
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank);
            }

            const cartAddress = bank === 0 ?
              0x0000 + (romAddress & 0x3fff) :
              0x4000 + (romAddress & 0x3fff);

            // 写入数据
            await gbc_rom_program(this.device, chunk, cartAddress);

            writtenCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (writtenCount / 1024) / elapsed : 0;
            maxSpeed = Math.max(maxSpeed, currentSpeed);

            const progress = (writtenCount / fileData.length) * 100;
            this.updateProgress(progress, this.t('messages.progress.writeSpeed', { speed: currentSpeed.toFixed(1) }));
            progressCallback?.(progress);
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = totalTime > 0 ? (fileData.length / 1024) / totalTime : 0;

          // Log comprehensive summary
          this.log(this.t('messages.rom.writeSummary', {
            totalTime: totalTime.toFixed(2),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: fileData.length,
          }));

          const message = this.t('messages.rom.writeComplete', { time: totalTime.toFixed(3) });
          this.log(message);

          return {
            success: true,
            message: message,
          };
        } catch (error) {
          const message = `${this.t('messages.rom.writeFailed')}: ${error}`;
          this.log(message);
          return {
            success: false,
            message: message,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'write_rom',
      },
      {
        fileSize: fileData.length,
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
      },
    );
  }

  /**
   * 读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, baseAddress = 0) : Promise<CommandResult> {
    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readROM',
      async () => {
        try {
          this.log(this.t('messages.rom.reading'));

          const result = new Uint8Array(size);
          const startTime = Date.now();
          let currentBank = -123;
          let readCount = 0;
          let maxSpeed = 0;

          while (readCount < size) {
            // 分包处理
            let chunkSize = size - readCount;
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

            // 读取数据
            const chunk = await gbc_read(this.device, chunkSize, cartAddress);
            result.set(chunk, readCount);

            readCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (readCount / 1024) / elapsed : 0;
            maxSpeed = Math.max(maxSpeed, currentSpeed);
            this.updateProgress(readCount / size * 100, this.t('messages.progress.readSpeed', { speed: currentSpeed.toFixed(1) }));
          }

          const totalTime = (Date.now() - startTime) / 1000;
          const avgSpeed = totalTime > 0 ? (size / 1024) / totalTime : 0;

          // Log comprehensive summary
          this.log(this.t('messages.rom.readSummary', {
            totalTime: totalTime.toFixed(2),
            avgSpeed: avgSpeed.toFixed(1),
            maxSpeed: maxSpeed.toFixed(1),
            totalSize: size,
          }));

          const message = this.t('messages.rom.readSuccess', { time: totalTime.toFixed(3) });
          this.log(message);

          return {
            success: true,
            data: result,
            message: message,
          };
        } catch (error) {
          const message = `${this.t('messages.rom.readFailed')}: ${error}`;
          this.log(message);
          return {
            success: false,
            message: message,
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
        devicePortLabel: this.device.port?.getInfo?.()?.usbProductId || 'unknown',
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
        try {
          this.log(this.t('messages.rom.verifying'));

          const startTime = Date.now();
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
            this.updateProgress(readCount / fileData.length * 100, `校验速度: ${speed} KB/s`);
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
        } catch (error) {
          const message = `${this.t('messages.rom.verifyFailed')}: ${error}`;
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
          await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000);

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
            await gbc_direct_write(this.device, chunk, cartAddress);

            writtenCount += chunkSize;
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (writtenCount / 1024) / elapsed : 0;
            maxSpeed = Math.max(maxSpeed, currentSpeed);
            this.updateProgress(writtenCount / fileData.length * 100, this.t('messages.progress.writeSpeed', { speed: currentSpeed.toFixed(1) }));
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
        } catch (error) {
          const message = `${this.t('messages.ram.writeFailed')}: ${error}`;
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
          await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000);

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
            this.updateProgress(readCount / size * 100, this.t('messages.progress.readSpeed', { speed: currentSpeed.toFixed(1) }));
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
        } catch (error) {
          const message = `${this.t('messages.ram.readFailed')}: ${error}`;
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
          await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000);

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
            this.updateProgress(readCount / fileData.length * 100, `校验速度: ${speed} KB/s`);
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
        } catch (error) {
          const message = `${this.t('messages.ram.verifyFailed')}: ${error}`;
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
