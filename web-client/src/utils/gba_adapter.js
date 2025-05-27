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
  ram_verify,
  ram_write_to_flash
} from './protocol.js'

/**
 * GBA适配器类
 * 封装所有GBA操作，便于UI组件调用
 */
export class GBAAdapter {
  /**
   * 构造函数
   * @param {Object} device - 设备对象
   * @param {Function} logCallback - 日志回调函数
   * @param {Function} progressCallback - 进度回调函数
   * @param {Function} translateFunc - 国际化翻译函数
   */
  constructor(device, logCallback = null, progressCallback = null, translateFunc = null) {
    this.device = device;
    this.log = logCallback || (() => {});
    this.updateProgress = progressCallback || (() => {});
    this.t = translateFunc || ((key) => key);
    this.idStr = '';
  }

  /**
   * 读取ROM芯片ID
   * @returns {Promise<string>} - ID字符串
   */
  async readID() {
    try {
      this.log(this.t('operation.readId'));
      const id = await rom_readID(this.device);
      this.idStr = id.map(x => x.toString(16).padStart(2, '0')).join(' ');
      this.log(`${this.t('operation.readIdSuccess')}: ${this.idStr}`);
      return {
        success: true,
        idStr: this.idStr,
        message: this.t('operation.readIdSuccess')
      };
    } catch (e) {
      this.log(`${this.t('operation.readIdFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('operation.readIdFailed')}: ${e}`
      };
    }
  }

  /**
   * 擦除整个芯片
   * @returns {Promise<Object>} - 操作结果
   */
  async eraseChip() {
    try {
      this.log(this.t('operation.eraseChip'));
      await rom_eraseChip(this.device);
      this.log(this.t('operation.eraseSuccess'));
      return {
        success: true,
        message: this.t('operation.eraseSuccess')
      };
    } catch (e) {
      this.log(`${this.t('operation.eraseFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('operation.eraseFailed')}: ${e}`
      };
    }
  }

  /**
   * 擦除ROM扇区
   * @param {number} startAddress - 起始地址
   * @param {number} endAddress - 结束地址
   * @param {number} sectorSize - 扇区大小（默认64KB）
   * @returns {Promise<Object>} - 操作结果
   */
  async eraseSectors(startAddress = 0, endAddress, sectorSize = 0x10000) {
    try {
      this.log(`擦除扇区 0x${startAddress.toString(16)} - 0x${endAddress.toString(16)}`);
      
      // 确保扇区对齐
      const sectorMask = sectorSize - 1;
      const alignedEndAddress = endAddress & ~sectorMask;
      
      let eraseCount = 0;
      const totalSectors = Math.floor((alignedEndAddress - startAddress) / sectorSize) + 1;

      // 从高地址向低地址擦除
      for (let addr = alignedEndAddress; addr >= startAddress; addr -= sectorSize) {
        this.log(`    擦除扇区: 0x${addr.toString(16)}`);
        await rom_sector_erase(this.device, addr);
        
        eraseCount++;
        this.updateProgress(eraseCount / totalSectors * 100, `擦除进度: ${eraseCount}/${totalSectors} 扇区`);
      }
      
      this.log('扇区擦除完成');
      return {
        success: true,
        message: '扇区擦除成功'
      };
    } catch (e) {
      this.log(`扇区擦除失败: ${e}`);
      return {
        success: false,
        message: `扇区擦除失败: ${e}`
      };
    }
  }

  /**
   * 写入ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {boolean} useDirectWrite - 是否使用直接写入（透传）模式
   * @returns {Promise<Object>} - 操作结果
   */
  async writeROM(fileData, useDirectWrite = true) {
    try {
      this.log(this.t('rom.writing', { size: fileData.length }));
      
      const total = fileData.length;
      let written = 0;
      const pageSize = 256;
      
      // 选择写入函数
      const writeFunction = useDirectWrite ? rom_direct_write : rom_program;
      
      // 分块写入并更新进度
      for (let addr = 0; addr < total; addr += pageSize) {
        const chunk = fileData.slice(addr, Math.min(addr + pageSize, total));
        await writeFunction(this.device, chunk, addr);
        
        written += chunk.length;
        const progress = Math.floor((written / total) * 100);
        this.updateProgress(progress, this.t('progress.writing', { written, total }));
        
        if (written % (pageSize * 16) === 0) {
          this.log(this.t('rom.written', { written }));
        }
      }
      
      this.log(this.t('rom.writeComplete'));
      return {
        success: true,
        message: this.t('rom.writeSuccess')
      };
    } catch (e) {
      this.log(`${this.t('rom.writeFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('rom.writeFailed')}: ${e}`
      };
    }
  }

  /**
   * 读取ROM
   * @param {number} size - 读取大小
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<Object>} - 操作结果，包含读取的数据
   */
  async readROM(size = 0x200000, baseAddress = 0) {
    try {
      this.log(this.t('rom.reading'));
      const data = await rom_read(this.device, size, baseAddress);
      this.log(this.t('rom.readSuccess', { size: data.length }));
      return {
        success: true,
        data: data,
        message: this.t('rom.readSuccess', { size: data.length })
      };
    } catch (e) {
      this.log(`${this.t('rom.readFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('rom.readFailed')}: ${e}`
      };
    }
  }

  /**
   * 校验ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<Object>} - 操作结果
   */
  async verifyROM(fileData, baseAddress = 0) {
    try {
      this.log(this.t('rom.verifying'));
      const ok = await rom_verify(this.device, fileData, baseAddress);
      const message = ok ? this.t('rom.verifySuccess') : this.t('rom.verifyFailed');
      this.log(`${this.t('rom.verify')}: ${message}`);
      return {
        success: ok,
        message: message
      };
    } catch (e) {
      this.log(`${this.t('rom.verifyFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('rom.verifyFailed')}: ${e}`
      };
    }
  }

  /**
   * 切换SRAM的Bank
   * @param {number} bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank) {
    bank = bank === 0 ? 0 : 1;
    this.log(`切换至SRAM Bank ${bank}`);
    await ram_write(this.device, new Uint8Array([bank]), 0x800000);
  }

  /**
   * 切换Flash的Bank
   * @param {number} bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank) {
    bank = bank === 0 ? 0 : 1;
    this.log(`切换至Flash Bank ${bank}`);
    
    await ram_write(this.device, new Uint8Array([0xaa]), 0x5555);
    await ram_write(this.device, new Uint8Array([0x55]), 0x2aaa);
    await ram_write(this.device, new Uint8Array([0xb0]), 0x5555); // FLASH_COMMAND_SWITCH_BANK
    await ram_write(this.device, new Uint8Array([bank]), 0x0000);
  }

  /**
   * 写入RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {string} ramType - RAM类型 ("SRAM" 或 "FLASH")
   * @returns {Promise<Object>} - 操作结果
   */
  async writeRAM(fileData, ramType = "SRAM") {
    try {
      this.log(this.t('ram.writing', { size: fileData.length }));
      
      const total = fileData.length;
      let written = 0;
      const pageSize = 256;
      
      // 如果是FLASH类型，先擦除
      if (ramType === "FLASH") {
        this.log("擦除flash");
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
          this.log(`..... 0x${result[0].toString(16)}`);
          if (result[0] === 0xff) {
            this.log("擦除完毕");
            this.updateProgress(0, "擦除完成");
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
          if (ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (written === 0x10000) {
          if (ramType === "FLASH") {
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
        if (ramType === "FLASH") {
          await ram_write_to_flash(this.device, chunk, baseAddr);
        } else {
          await ram_write(this.device, chunk, baseAddr);
        }
        
        written += chunkSize;
        const progress = Math.floor((written / total) * 100);
        this.updateProgress(progress, this.t('progress.writing', { written, total }));
        
        if (written % (pageSize * 16) === 0) {
          this.log(this.t('ram.written', { written }));
        }
      }
      
      this.log(this.t('ram.writeComplete'));
      return {
        success: true,
        message: this.t('ram.writeSuccess')
      };
    } catch (e) {
      this.log(`${this.t('ram.writeFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('ram.writeFailed')}: ${e}`
      };
    }
  }

  /**
   * 读取RAM
   * @param {number} size - 读取大小
   * @param {string} ramType - RAM类型 ("SRAM" 或 "FLASH")
   * @returns {Promise<Object>} - 操作结果，包含读取的数据
   */
  async readRAM(size = 0x8000, ramType = "SRAM") {
    try {
      this.log(this.t('ram.reading'));
      
      const result = new Uint8Array(size);
      let read = 0;
      const pageSize = 256;
      
      while (read < size) {
        // 切bank
        if (read === 0x00000) {
          if (ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (read === 0x10000) {
          if (ramType === "FLASH") {
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
        this.updateProgress(progress, `读取进度: ${read}/${size} 字节`);
      }
      
      this.log(this.t('ram.readSuccess', { size: result.length }));
      return {
        success: true,
        data: result,
        message: this.t('ram.readSuccess', { size: result.length })
      };
    } catch (e) {
      this.log(`${this.t('ram.readFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('ram.readFailed')}: ${e}`
      };
    }
  }

  /**
   * 校验RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {string} ramType - RAM类型 ("SRAM" 或 "FLASH")
   * @returns {Promise<Object>} - 操作结果
   */
  async verifyRAM(fileData, ramType = "SRAM") {
    try {
      this.log(this.t('ram.verifying'));
      
      const total = fileData.length;
      let verified = 0;
      const pageSize = 256;
      let success = true;
      
      while (verified < total) {
        // 切bank
        if (verified === 0x00000) {
          if (ramType === "FLASH") {
            await this.switchFlashBank(0);
          } else {
            await this.switchSRAMBank(0);
          }
        } else if (verified === 0x10000) {
          if (ramType === "FLASH") {
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
            this.log(`0x${(verified + i).toString(16)}校验失败，${fileData[verified + i].toString(16)} -> ${readData[i].toString(16)}`);
            success = false;
          }
        }
        
        verified += chunkSize;
        const progress = Math.floor((verified / total) * 100);
        this.updateProgress(progress, `校验进度: ${verified}/${total} 字节`);
      }
      
      const message = success ? this.t('ram.verifySuccess') : this.t('ram.verifyFailed');
      this.log(`${this.t('ram.verify')}: ${message}`);
      return {
        success: success,
        message: message
      };
    } catch (e) {
      this.log(`${this.t('ram.verifyFailed')}: ${e}`);
      return {
        success: false,
        message: `${this.t('ram.verifyFailed')}: ${e}`
      };
    }
  }
}

// 默认导出
export default GBAAdapter;
