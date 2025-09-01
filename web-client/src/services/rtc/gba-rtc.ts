import { rom_read, rom_write } from '@/protocol/beggar_socket/protocol';

import { BaseRTC } from './base-rtc';

export interface GBARTCData {
  year: number;
  month: number;
  date: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * GBA RTC操作类
 */
export class GBARTC extends BaseRTC {
  /**
   * GBA RTC GPIO 写字节操作
   */
  private async s3511_writeByte(value: number): Promise<void> {
    // 设置SIO为输出
    await rom_write(this.device, new Uint8Array([7, 0]), 0xc6 >> 1); // sio out

    for (let i = 0; i < 8; i++) {
      const bit = (value & 0x01) !== 0 ? 0x02 : 0x00;
      value >>= 1;

      await rom_write(this.device, new Uint8Array([4 | bit, 0]), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.device, new Uint8Array([5 | bit, 0]), 0xc4 >> 1); // cs 1, sck 1
    }
  }

  /**
   * GBA RTC GPIO 读字节操作
   */
  private async s3511_readByte(): Promise<number> {
    let value = 0;

    // 设置SIO为输入
    await rom_write(this.device, new Uint8Array([5, 0]), 0xc6 >> 1); // sio in

    for (let i = 0; i < 8; i++) {
      await rom_write(this.device, new Uint8Array([4, 0]), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.device, new Uint8Array([5, 0]), 0xc4 >> 1); // cs 1, sck 1

      const data = await rom_read(this.device, 2, 0xc4);

      // lsb in
      value >>= 1;
      if ((data[0] & 0x02) !== 0) {
        value |= 0x80;
      }
    }

    return value;
  }

  /**
   * 初始化GPIO
   */
  private async initializeGPIO(): Promise<void> {
    await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(this.device, new Uint8Array([0x07, 0x00]), 0xc6 >> 1); // cs sio sck output
    await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio
  }

  /**
   * 清理GPIO状态
   */
  private async cleanupGPIO(): Promise<void> {
    await rom_write(this.device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio
  }

  /**
   * 读取RTC状态并处理电池没电的情况
   */
  private async checkAndResetIfNeeded(): Promise<number> {
    // 读取RTC状态
    await this.s3511_writeByte(0xc6);
    const status = await this.s3511_readByte();
    await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

    // 如果电池没电，重置RTC
    if ((status & 0x80) !== 0) {
      await this.s3511_writeByte(0x06); // reset
      await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

      await this.s3511_writeByte(0x46); // write status
      await this.s3511_writeByte(0x40); // 24 hour mode
      await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    }

    return status;
  }

  /**
   * 检查GPIO功能是否可用
   */
  async checkCapability(): Promise<boolean> {
    try {
      // 检测GPIO功能
      const read1 = await rom_read(this.device, 6, 0xc4);
      await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio
      const read2 = await rom_read(this.device, 6, 0xc4);
      await rom_write(this.device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio

      // 检查是否有GPIO功能
      for (let i = 0; i < 6; i++) {
        if (read1[i] !== read2[i]) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('检查GBA GPIO功能时出错:', error);
      return false;
    }
  }

  /**
   * 设置GBA RTC时间
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData = timeData as GBARTCData;

    try {
      if (!(await this.checkCapability())) {
        throw new Error('Cartridge does not have GPIO functionality');
      }

      await this.initializeGPIO();
      await this.checkAndResetIfNeeded();

      // 设置时间
      const year = this.intToCompressedBCD(rtcData.year % 100); // 只取后两位
      const month = this.intToCompressedBCD(rtcData.month);
      const date = this.intToCompressedBCD(rtcData.date);
      const day = this.intToCompressedBCD(rtcData.day);
      const hour = this.intToCompressedBCD(rtcData.hour);
      const minute = this.intToCompressedBCD(rtcData.minute);
      const second = this.intToCompressedBCD(rtcData.second);

      await this.s3511_writeByte(0x26); // write time command
      await this.s3511_writeByte(year);
      await this.s3511_writeByte(month);
      await this.s3511_writeByte(date);
      await this.s3511_writeByte(day);
      await this.s3511_writeByte(hour);
      await this.s3511_writeByte(minute);
      await this.s3511_writeByte(second);
      await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

      // 等待写入完成
      await this.delay(1000);

      // 验证写入
      await this.verifyTimeSet(4);

      await this.cleanupGPIO();
    } catch (error) {
      // 确保在出错时也清理GPIO状态
      try {
        await this.cleanupGPIO();
      } catch (cleanupError) {
        console.error('清理GPIO状态时出错:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 读取GBA RTC时间
   */
  async readTime(): Promise<{ status: boolean; time?: Date; error?: string }> {
    try {
      if (!(await this.checkCapability())) {
        return { status: false, error: 'Cartridge does not have GPIO functionality' };
      }

      await this.initializeGPIO();
      const status = await this.checkAndResetIfNeeded();

      console.log(`RTC Status: 0x${status.toString(16)}`);

      // 读取时间数据
      await this.s3511_writeByte(0xa6); // read time command
      const year = this.compressedBCDToInt(await this.s3511_readByte());
      const month = this.compressedBCDToInt(await this.s3511_readByte() & 0x1f);
      const date = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const day = this.compressedBCDToInt(await this.s3511_readByte() & 0x07);
      const hour = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const minute = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);
      const second = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);

      await rom_write(this.device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

      const time = new Date(2000 + year, month - 1, date, hour, minute, second);

      await this.cleanupGPIO();

      return { status: true, time };
    } catch (error) {
      console.error('读取GBA RTC时出错:', error);
      // 确保在出错时也清理GPIO状态
      try {
        await this.cleanupGPIO();
      } catch (cleanupError) {
        console.error('清理GPIO状态时出错:', cleanupError);
      }
      return { status: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }
}
