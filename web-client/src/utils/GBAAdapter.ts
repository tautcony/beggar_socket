import {
  rom_readID,
  rom_eraseChip,
  rom_sector_erase,
  rom_program,
  rom_direct_write,
  rom_read,
  rom_verify,
  ram_write,
  ram_read,
  // ram_verify,
  ram_write_to_flash,
  ROM_PAGE_SIZE,
  RAM_PAGE_SIZE,
} from '@/utils/Protocol.ts';
import { DeviceInfo } from '@/types/DeviceInfo.ts';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/utils/CartridgeAdapter.ts';
import { CommandResult } from '@/types/CommandResult.ts';
import { CommandOptions } from '@/types/CommandOptions.ts';
import { getFlashId } from '@/utils/ProtocolUtils';

/**
 * GBA Adapter - 封装GBA卡带的协议操作
 */
export class GBAAdapter extends CartridgeAdapter {
  public idStr: string;

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
    translateFunc: TranslateFunction | null = null
  ) {
    super(device, logCallback, progressCallback, translateFunc);
    this.idStr = '';
  }

  /**
   * 读取ROM芯片ID
   * @returns - ID字符串
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
    try {
      this.log(this.t('messages.operation.readId'));
      const id = await rom_readID(this.device);

      this.idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
      const flashId = getFlashId(id);
      if (flashId === null) {
        this.log(this.t('messages.operation.unknownFlashId'));
      } else {
        this.log(`${this.t('messages.operation.readIdSuccess')}: ${this.idStr} (${flashId})`);
      }

      await this.getROMSize();

      return {
        success: true,
        idStr: this.idStr,
        message: this.t('messages.operation.readIdSuccess')
      };
    } catch (e) {
      this.log(`${this.t('messages.operation.readIdFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.operation.readIdFailed')
      };
    }
  }

  /**
   * 擦除整个芯片
   * @returns - 操作结果
   */
  async eraseChip() : Promise<CommandResult> {
    try {
      this.log(this.t('messages.operation.eraseChip'));
      await rom_eraseChip(this.device);

      // 验证擦除是否完成
      while (true) {
        const eraseComplete = await this.isBlank(0x00, 0x100);
        if (eraseComplete) {
          this.log(this.t('messages.operation.eraseComplete'));
          break;
        } else {
          this.log(this.t('messages.operation.eraseInProgress'));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        success: true,
        message: this.t('messages.operation.eraseComplete')
      };
    } catch (e) {
      this.log(`${this.t('messages.operation.eraseFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.operation.eraseFailed')
      };
    }
  }

  /**
   * 擦除ROM扇区
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小（默认64KB）
   * @returns - 操作结果
   */
  async eraseSectors(startAddress: number = 0, endAddress: number, sectorSize = 0x10000) : Promise<CommandResult> {
    try {
      this.log(this.t('messages.operation.eraseSector', { address: startAddress.toString(16) }) + ' - ' +
               this.t('messages.operation.eraseSector', { address: endAddress.toString(16) }));

      // 确保扇区对齐
      const sectorMask = sectorSize - 1;
      const alignedEndAddress = endAddress & ~sectorMask;

      let eraseCount = 0;
      const totalSectors = Math.floor((alignedEndAddress - startAddress) / sectorSize) + 1;
      const startTime = Date.now();

      // 从高地址向低地址擦除
      for (let addr = alignedEndAddress; addr >= startAddress; addr -= sectorSize) {
        this.log(this.t('messages.operation.eraseSector', { address: addr.toString(16) }));
        await rom_sector_erase(this.device, addr);

        eraseCount++;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (eraseCount / elapsed).toFixed(1) : '0';
        this.updateProgress(eraseCount / totalSectors * 100, this.t('messages.progress.eraseSpeed', { speed }));
      }

      this.log(this.t('messages.operation.eraseSuccess'));
      return {
        success: true,
        message: this.t('messages.operation.eraseSuccess')
      };
    } catch (e) {
      this.log(this.t('messages.operation.eraseSectorFailed') + ': ' + e);
      return {
        success: false,
        message: this.t('messages.operation.eraseSectorFailed') + ': ' + e
      };
    }
  }

  /**
   * 写入ROM
   * @param fileData - 文件数据
    * @param options - 写入选项
   * @returns - 操作结果
   */
  async writeROM(fileData: Uint8Array, options: CommandOptions = {useDirectWrite: true}) : Promise<CommandResult> {
    try {
      this.log(this.t('messages.rom.writing', { size: fileData.length }));

      const total = fileData.length;
      let written = 0;
      const pageSize = ROM_PAGE_SIZE;
      const startTime = Date.now();

      // 选择写入函数
      const writeFunction = options.useDirectWrite ? rom_direct_write : rom_program;

      const romInfo = await this.getROMSize();
      const blank = await this.isBlank(0, 0x100);
      if (!blank) {
        this.eraseSectors(0, fileData.length - 1, romInfo.sectorSize);
      }

      // 分块写入并更新进度
      for (let addr = 0; addr < total; addr += pageSize) {
        const chunk = fileData.slice(addr, Math.min(addr + pageSize, total));
        await writeFunction(this.device, chunk, addr);

        written += chunk.length;
        const progress = Math.floor((written / total) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? ((written / 1024) / elapsed).toFixed(1) : '0';
        this.updateProgress(progress, this.t('messages.progress.writeSpeed', { speed }));

        if (written % (pageSize * 16) === 0) {
          this.log(this.t('messages.rom.written', { written }));
        }
      }

      this.log(this.t('messages.rom.writeComplete'));
      return {
        success: true,
        message: this.t('messages.rom.writeSuccess')
      };
    } catch (e) {
      this.log(`${this.t('messages.rom.writeFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.rom.writeFailed')
      };
    }
  }

  /**
   * 获取ROM容量信息 - 通过CFI查询
   * @returns ROM容量相关信息
   */
  async getROMSize(): Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number }> {
    try {
      this.log(this.t('messages.operation.queryingRomSize'));

      // CFI Query - 向地址0x55写入0x98命令
      await rom_direct_write(this.device, new Uint8Array([0x98, 0x00]), 0x55);

      // 读取CFI数据 (20字节) - 从地址0x4E (0x27 << 1)开始读取
      const cfiData = await rom_read(this.device, 20, 0x4E);

      // Reset - 向地址0x00写入0xf0命令
      await rom_direct_write(this.device, new Uint8Array([0xf0, 0x00]), 0x00);

      // 解析CFI数据
      // 设备容量 (地址0x27h对应索引0)
      const deviceSizeExponent = (cfiData[1] << 8) | cfiData[0]; // 16位小端序
      const deviceSize = Math.pow(2, deviceSizeExponent);

      // Buffer写入字节数 (地址0x2Ah对应索引6)
      const bufferSizeExponent = (cfiData[7] << 8) | cfiData[6]; // 16位小端序
      let bufferWriteBytes;
      if (bufferSizeExponent === 0) {
        bufferWriteBytes = 0;
      } else {
        bufferWriteBytes = Math.pow(2, bufferSizeExponent);
      }

      // 扇区数量 (地址0x2Dh和0x2Eh对应索引12和14)
      const sectorCountLow = (cfiData[13] << 8) | cfiData[12]; // 16位小端序
      const sectorCountHigh = (cfiData[15] << 8) | cfiData[14]; // 16位小端序
      const sectorCount = (((sectorCountHigh & 0xff) << 8) | (sectorCountLow & 0xff)) + 1;

      // 扇区大小 (地址0x2Fh和0x30h对应索引16和18)
      const sectorSizeLow = (cfiData[17] << 8) | cfiData[16]; // 16位小端序
      const sectorSizeHigh = (cfiData[19] << 8) | cfiData[18]; // 16位小端序
      const sectorSize = (((sectorSizeHigh & 0xff) << 8) | (sectorSizeLow & 0xff)) * 256;

      this.log(this.t('messages.operation.romSizeQuerySuccess', {
        deviceSize: deviceSize.toString(),
        sectorCount: sectorCount.toString(),
        sectorSize: sectorSize.toString(),
        bufferWriteBytes: bufferWriteBytes.toString()
      }));

      return {
        deviceSize,
        sectorCount,
        sectorSize,
        bufferWriteBytes
      };
    } catch (error) {
      this.log(`${this.t('messages.operation.romSizeQueryFailed')}: ${error}`);
      throw error;
    }
  }

  /**
   * 读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @returns - 操作结果，包含读取的数据
   */
  async readROM(size = 0x200000, baseAddress = 0) : Promise<CommandResult> {
    try {
      this.log(this.t('messages.rom.reading'));
      const data = await rom_read(this.device, size, baseAddress);
      this.log(this.t('messages.rom.readSuccess', { size: data.length }));
      return {
        success: true,
        data: data,
        message: this.t('messages.rom.readSuccess', { size: data.length })
      };
    } catch (e) {
      this.log(`${this.t('messages.rom.readFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.rom.readFailed')
      };
    }
  }

  /**
   * 校验ROM
   * @param fileData - 文件数据
   * @param baseAddress - 基础地址
   * @returns - 操作结果
   */
  async verifyROM(fileData: Uint8Array, baseAddress = 0) : Promise<CommandResult> {
    try {
      this.log(this.t('messages.rom.verifying'));
      const ok = await rom_verify(this.device, fileData, baseAddress);
      const message = ok ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
      this.log(`${this.t('messages.rom.verify')}: ${message}`);
      return {
        success: ok,
        message: message
      };
    } catch (e) {
      this.log(`${this.t('messages.rom.verifyFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.rom.verifyFailed')
      };
    }
  }

  /**
   * 切换SRAM的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank: number) : Promise<void> {
    bank = bank === 0 ? 0 : 1;
    this.log(this.t('messages.gba.bankSwitchSram', { bank }));
    await ram_write(this.device, new Uint8Array([bank]), 0x800000);
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

  /**
   * 写入RAM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 操作结果
   */
  async writeRAM(fileData: Uint8Array, options: CommandOptions = {ramType: 'SRAM'}): Promise<CommandResult> {
    try {
      this.log(this.t('messages.ram.writing', { size: fileData.length }));

      const total = fileData.length;
      let written = 0;
      const pageSize = RAM_PAGE_SIZE;
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
            this.updateProgress(0, this.t('messages.progress.eraseCompleteReady'));
            erased = true;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // 开始写入
      const startTime = Date.now();
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
        if (options.ramType === 'FLASH') {
          await ram_write_to_flash(this.device, chunk, baseAddr);
        } else {
          await ram_write(this.device, chunk, baseAddr);
        }

        written += chunkSize;
        const progress = Math.floor((written / total) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? ((written / 1024) / elapsed).toFixed(1) : '0';
        this.updateProgress(progress, this.t('messages.progress.writeSpeed', { speed }));

        if (written % (pageSize * 16) === 0) {
          this.log(this.t('messages.ram.written', { written }));
        }
      }

      this.log(this.t('messages.ram.writeComplete'));
      return {
        success: true,
        message: this.t('messages.ram.writeSuccess')
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.writeFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.ram.writeFailed')
      };
    }
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param options - 读取参数
   * @returns - 操作结果，包含读取的数据
   */
  async readRAM(size = 0x8000, options: CommandOptions = {ramType: 'SRAM'}) {
    try {
      this.log(this.t('messages.ram.reading'));

      const result = new Uint8Array(size);
      let read = 0;
      const pageSize = RAM_PAGE_SIZE;
      const startTime = Date.now();

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
        const chunk = await ram_read(this.device, chunkSize, baseAddr);
        result.set(chunk, read);

        read += chunkSize;
        const progress = Math.floor((read / size) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? ((read / 1024) / elapsed).toFixed(1) : '0';
        this.updateProgress(progress, this.t('messages.progress.readSpeed', { speed }));
      }

      this.log(this.t('messages.ram.readSuccess', { size: result.length }));
      return {
        success: true,
        data: result,
        message: this.t('messages.ram.readSuccess', { size: result.length })
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.readFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.ram.readFailed')
      };
    }
  }

  /**
   * 校验RAM
   * @param fileData - 文件数据
   * @param options - 选项对象
   * @returns - 操作结果
   */
  async verifyRAM(fileData: Uint8Array, options: CommandOptions = {ramType: 'SRAM'}) {
    try {
      this.log(this.t('messages.ram.verifying'));

      const total = fileData.length;
      let verified = 0;
      const pageSize = RAM_PAGE_SIZE;
      let success = true;
      const startTime = Date.now();

      while (verified < total) {
        // 切bank
        if (verified === 0x00000) {
          if (options.ramType === 'FLASH') {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (verified === 0x10000) {
          if (options.ramType === 'FLASH') {
            await this.switchFlashBank(1);
          } else {
            await this.switchSRAMBank(1);
          }
        }

        const baseAddr = verified & 0xffff;

        // 分包
        const remainingSize = total - verified;
        const chunkSize = Math.min(pageSize, remainingSize);

        // 读取数据进行比较
        const readData = await ram_read(this.device, chunkSize, baseAddr);

        // 校验数据
        for (let i = 0; i < chunkSize; i++) {
          if (fileData[verified + i] !== readData[i]) {
            this.log(this.t('messages.ram.verifyFailedDetail', {
              address: (verified + i).toString(16),
              expected: fileData[verified + i].toString(16),
              actual: readData[i].toString(16)
            }));
            success = false;
          }
        }

        verified += chunkSize;
        const progress = Math.floor((verified / total) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? ((verified / 1024) / elapsed).toFixed(1) : '0';
        this.updateProgress(progress, this.t('messages.progress.verifySpeed', { speed }));
      }

      const message = success ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');
      this.log(`${this.t('messages.ram.verify')}: ${message}`);
      return {
        success: success,
        message: message
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.verifyFailed')}: ${e}`);
      return {
        success: false,
        message: this.t('messages.ram.verifyFailed')
      };
    }
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
