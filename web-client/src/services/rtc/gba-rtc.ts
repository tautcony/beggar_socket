import { DateTime } from 'luxon';

import { rom_read, rom_write } from '@/protocol/beggar_socket/protocol';
import { toLittleEndian } from '@/protocol/beggar_socket/protocol-utils';

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
    await rom_write(this.device, toLittleEndian(0x07, 2), 0xc6 >> 1); // sio out

    for (let i = 0; i < 8; i++) {
      const bit = (value & 0x01) !== 0 ? 0x02 : 0x00;
      value >>= 1;

      await rom_write(this.device, toLittleEndian(0x04 | bit, 2), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.device, toLittleEndian(0x05 | bit, 2), 0xc4 >> 1); // cs 1, sck 1
    }
  }

  /**
   * GBA RTC GPIO 读字节操作
   */
  private async s3511_readByte(): Promise<number> {
    let value = 0;

    // 设置SIO为输入
    await rom_write(this.device, toLittleEndian(0x05, 2), 0xc6 >> 1); // sio in

    for (let i = 0; i < 8; i++) {
      await rom_write(this.device, toLittleEndian(0x04, 2), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.device, toLittleEndian(0x05, 2), 0xc4 >> 1); // cs 1, sck 1

      const data = await rom_read(this.device, 0x02, 0xc4);

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
    await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(this.device, toLittleEndian(0x07, 2), 0xc6 >> 1); // cs sio sck output
    await rom_write(this.device, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  }

  /**
   * 清理GPIO状态
   */
  private async cleanupGPIO(): Promise<void> {
    await rom_write(this.device, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio
  }

  /**
   * 读取RTC状态并处理电池没电的情况
   */
  private async checkAndResetIfNeeded(): Promise<number> {
    // 读取RTC状态
    await this.s3511_writeByte(0xc6);
    const status = await this.s3511_readByte();
    await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

    // 如果电池没电，重置RTC
    if ((status & 0x80) !== 0) {
      await this.s3511_writeByte(0x06); // reset
      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      await this.s3511_writeByte(0x46); // write status
      await this.s3511_writeByte(0x40); // 24 hour mode
      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    }

    return status;
  }

  /**
   * 验证写入时间（在已初始化的GPIO状态下进行）
   */
  private async verifyWrittenTime(attempts = 5): Promise<void> {
    for (let i = attempts; i > 0; i--) {
      // 重新启用GPIO（关键步骤）
      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio

      // 读取时间验证
      await this.s3511_writeByte(0xa6);
      const verifyYear = this.compressedBCDToInt(await this.s3511_readByte());
      const verifyMonth = this.compressedBCDToInt(await this.s3511_readByte() & 0x1f);
      const verifyDate = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const verifyDay = this.compressedBCDToInt(await this.s3511_readByte() & 0x07);
      const verifyHour = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const verifyMinute = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);
      const verifySecond = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);

      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
      await rom_write(this.device, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio

      console.log(`验证 ${i}: ${2000 + verifyYear}-${verifyMonth.toString().padStart(2, '0')}-${verifyDate.toString().padStart(2, '0')} ${verifyHour.toString().padStart(2, '0')}:${verifyMinute.toString().padStart(2, '0')}:${verifySecond.toString().padStart(2, '0')} WK${verifyDay}`);

      await this.delay(1000);
    }
  }
  async checkCapability(): Promise<boolean> {
    try {
      // 检测GPIO功能
      const read1 = await rom_read(this.device, 6, 0xc4);
      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
      const read2 = await rom_read(this.device, 6, 0xc4);
      await rom_write(this.device, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio

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

      // 使用luxon验证输入的日期时间是否有效
      if (!BaseRTC.isValidDateTime(
        rtcData.year + 2000,
        rtcData.month,
        rtcData.date,
        rtcData.hour,
        rtcData.minute,
        rtcData.second,
      )) {
        throw new Error('Invalid date/time provided');
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
      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      // 等待写入完成
      await this.delay(1000);

      // 验证写入（使用专门的验证方法，不重新初始化GPIO）
      await this.verifyWrittenTime(5);

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
   * 从特定时区的DateTime设置RTC时间
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
    const rtcData: GBARTCData = {
      year: dt.year - 2000,
      month: dt.month,
      date: dt.day,
      day: dt.weekday % 7, // luxon: 1-7 (Monday-Sunday), convert to 0-6 (Sunday-Saturday)
      hour: dt.hour,
      minute: dt.minute,
      second: dt.second,
    };

    await this.setTime(rtcData);
  }

  /**
   * 设置当前时间到RTC
   */
  async setCurrentTime(timezone?: string): Promise<void> {
    const now = timezone ? DateTime.now().setZone(timezone) : DateTime.now();
    await this.setTimeFromDateTime(now);
  }

  /**
   * 读取GBA RTC时间
   */
  async readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
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

      await rom_write(this.device, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      // 使用luxon创建DateTime对象
      const time = DateTime.fromObject({
        year: 2000 + year,
        month: month,
        day: date,
        hour: hour,
        minute: minute,
        second: second,
      });

      if (!time.isValid) {
        throw new Error(`Invalid date/time values: ${time.invalidReason}`);
      }

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
