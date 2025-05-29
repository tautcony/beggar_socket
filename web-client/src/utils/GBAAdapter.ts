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
} from './Protocol.ts';
import { DeviceInfo } from '../types/DeviceInfo.ts';
import { CartridgeAdapter, AdapterResult, LogCallback, ProgressCallback, TranslateFunction, CartridgeAdapterOptions } from './CartridgeAdapter.ts';

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
   * @returns {Promise<AdapterResult & { idStr?: string }>} - ID字符串
   */
  async readID(): Promise<AdapterResult & { idStr?: string }> {
    try {
      this.log(this.t('messages.operation.readId'));
      const id = await rom_readID(this.device);
      this.idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
      this.log(`${this.t('messages.operation.readIdSuccess')}: ${this.idStr}`);
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
  async eraseChip() : Promise<AdapterResult> {
    try {
      this.log(this.t('messages.operation.eraseChip'));
      await rom_eraseChip(this.device);
      this.log(this.t('messages.operation.eraseSuccess'));
      return {
        success: true,
        message: this.t('messages.operation.eraseSuccess')
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
  async eraseSectors(startAddress = 0, endAddress: number, sectorSize = 0x10000) : Promise<AdapterResult> {
    try {
      this.log(this.t('messages.operation.eraseSector', { address: startAddress.toString(16) }) + ' - ' + 
               this.t('messages.operation.eraseSector', { address: endAddress.toString(16) }));

      // 确保扇区对齐
      const sectorMask = sectorSize - 1;
      const alignedEndAddress = endAddress & ~sectorMask;

      let eraseCount = 0;
      const totalSectors = Math.floor((alignedEndAddress - startAddress) / sectorSize) + 1;

      // 从高地址向低地址擦除
      for (let addr = alignedEndAddress; addr >= startAddress; addr -= sectorSize) {
        this.log(this.t('messages.operation.eraseSector', { address: addr.toString(16) }));
        await rom_sector_erase(this.device, addr);

        eraseCount++;
        this.updateProgress(eraseCount / totalSectors * 100, this.t('messages.progress.erasing', { erased: eraseCount, total: totalSectors }));
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
  async writeROM(fileData: Uint8Array, options: CartridgeAdapterOptions = {useDirectWrite: true}) {
    try {
      this.log(this.t('messages.rom.writing', { size: fileData.length }));

      const total = fileData.length;
      let written = 0;
      const pageSize = 256;

      // 选择写入函数
      const writeFunction = options.useDirectWrite ? rom_direct_write : rom_program;

      // 分块写入并更新进度
      for (let addr = 0; addr < total; addr += pageSize) {
        const chunk = fileData.slice(addr, Math.min(addr + pageSize, total));
        await writeFunction(this.device, chunk, addr);

        written += chunk.length;
        const progress = Math.floor((written / total) * 100);
        this.updateProgress(progress, this.t('messages.progress.writing', { written, total }));

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
   * 读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @returns - 操作结果，包含读取的数据
   */
  async readROM(size = 0x200000, baseAddress = 0) : Promise<AdapterResult> {
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
  async verifyROM(fileData: Uint8Array, baseAddress = 0) : Promise<AdapterResult> {
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
  async switchSRAMBank(bank: number) {
    bank = bank === 0 ? 0 : 1;
    this.log(this.t('messages.gba.bankSwitchSram', { bank }));
    await ram_write(this.device, new Uint8Array([bank]), 0x800000);
  }

  /**
   * 切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number) {
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
  async writeRAM(fileData: Uint8Array, options: CartridgeAdapterOptions = {ramType: "SRAM"}): Promise<AdapterResult> {
    try {
      this.log(this.t('messages.ram.writing', { size: fileData.length }));

      const total = fileData.length;
      let written = 0;
      const pageSize = 256;        // 如果是FLASH类型，先擦除
        if (options.ramType === "FLASH") {
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
              this.updateProgress(0, this.t('messages.gba.eraseComplete'));
              erased = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
      }

      // 开始写入
      while (written < total) {
        // 切bank
        if (written === 0x00000) {
          if (options.ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (written === 0x10000) {
          if (options.ramType === "FLASH") {
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
        if (options.ramType === "FLASH") {
          await ram_write_to_flash(this.device, chunk, baseAddr);
        } else {
          await ram_write(this.device, chunk, baseAddr);
        }

        written += chunkSize;
        const progress = Math.floor((written / total) * 100);
        this.updateProgress(progress, this.t('messages.progress.writing', { written, total }));

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
  async readRAM(size = 0x8000, options: CartridgeAdapterOptions = {ramType: "SRAM"}) {
    try {
      this.log(this.t('messages.ram.reading'));

      const result = new Uint8Array(size);
      let read = 0;
      const pageSize = 256;

      while (read < size) {
        // 切bank
        if (read === 0x00000) {
          if (options.ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (read === 0x10000) {
          if (options.ramType === "FLASH") {
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
        this.updateProgress(progress, this.t('messages.progress.reading', { read, total: size }));
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
  async verifyRAM(fileData: Uint8Array, options: CartridgeAdapterOptions = {ramType: "SRAM"}) {
    try {
      this.log(this.t('messages.ram.verifying'));

      const total = fileData.length;
      let verified = 0;
      const pageSize = 256;
      let success = true;

      while (verified < total) {
        // 切bank
        if (verified === 0x00000) {
          if (options.ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (verified === 0x10000) {
          if (options.ramType === "FLASH") {
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
        this.updateProgress(progress, `校验进度: ${verified}/${total} 字节`);
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
}

// 默认导出
export default GBAAdapter;
