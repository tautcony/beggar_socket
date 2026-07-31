import { DateTime } from 'luxon';

import { rom_read, rom_write, toLittleEndian } from '@/protocol';

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
 * GBA RTC鎿嶄綔绫?
 */
export class GBARTC extends BaseRTC {
  /**
   * GBA RTC GPIO 鍐欏瓧鑺傛搷浣?
   */
  private async s3511_writeByte(value: number): Promise<void> {
    // 璁剧疆SIO涓鸿緭鍑?
    await rom_write(this.transport, toLittleEndian(0x07, 2), 0xc6 >> 1); // sio out

    for (let i = 0; i < 8; i++) {
      const bit = (value & 0x01) !== 0 ? 0x02 : 0x00;
      value >>= 1;

      await rom_write(this.transport, toLittleEndian(0x04 | bit, 2), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.transport, toLittleEndian(0x05 | bit, 2), 0xc4 >> 1); // cs 1, sck 1
    }
  }

  /**
   * GBA RTC GPIO 璇诲瓧鑺傛搷浣?
   */
  private async s3511_readByte(): Promise<number> {
    let value = 0;

    // 璁剧疆SIO涓鸿緭鍏?
    await rom_write(this.transport, toLittleEndian(0x05, 2), 0xc6 >> 1); // sio in

    for (let i = 0; i < 8; i++) {
      await rom_write(this.transport, toLittleEndian(0x04, 2), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.transport, toLittleEndian(0x05, 2), 0xc4 >> 1); // cs 1, sck 1

      const data = await rom_read(this.transport, 0x02, 0xc4);

      // lsb in
      value >>= 1;
      if ((data[0] & 0x02) !== 0) {
        value |= 0x80;
      }
    }

    return value;
  }

  /**
   * 鍒濆鍖朑PIO
   */
  private async initializeGPIO(): Promise<void> {
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(this.transport, toLittleEndian(0x07, 2), 0xc6 >> 1); // cs sio sck output
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  }

  /**
   * 娓呯悊GPIO鐘舵€?
   */
  private async cleanupGPIO(): Promise<void> {
    await rom_write(this.transport, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio
  }

  /**
   * 璇诲彇RTC鐘舵€佸苟澶勭悊鐢垫睜娌＄數鐨勬儏鍐?
   */
  private async checkAndResetIfNeeded(): Promise<number> {
    // 璇诲彇RTC鐘舵€?
    await this.s3511_writeByte(0xc6);
    const status = await this.s3511_readByte();
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

    // 濡傛灉鐢垫睜娌＄數锛岄噸缃甊TC
    if ((status & 0x80) !== 0) {
      await this.s3511_writeByte(0x06); // reset
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      await this.s3511_writeByte(0x46); // write status
      await this.s3511_writeByte(0x40); // 24 hour mode
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    }

    return status;
  }

  /**
   * 楠岃瘉鍐欏叆鏃堕棿锛堝湪宸插垵濮嬪寲鐨凣PIO鐘舵€佷笅杩涜锛?
   */
  private async verifyWrittenTime(attempts = 5): Promise<void> {
    for (let i = attempts; i > 0; i--) {
      // 閲嶆柊鍚敤GPIO锛堝叧閿楠わ級
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio

      // 璇诲彇鏃堕棿楠岃瘉
      await this.s3511_writeByte(0xa6);
      const verifyYear = this.compressedBCDToInt(await this.s3511_readByte());
      const verifyMonth = this.compressedBCDToInt(await this.s3511_readByte() & 0x1f);
      const verifyDate = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const verifyDay = this.compressedBCDToInt(await this.s3511_readByte() & 0x07);
      const verifyHour = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const verifyMinute = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);
      const verifySecond = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);

      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
      await rom_write(this.transport, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio

      console.log(`楠岃瘉 ${i}: ${2000 + verifyYear}-${verifyMonth.toString().padStart(2, '0')}-${verifyDate.toString().padStart(2, '0')} ${verifyHour.toString().padStart(2, '0')}:${verifyMinute.toString().padStart(2, '0')}:${verifySecond.toString().padStart(2, '0')} WK${verifyDay}`);

      await this.delay(1000);
    }
  }
  async checkCapability(): Promise<boolean> {
    try {
      // 妫€娴婫PIO鍔熻兘
      const read1 = await rom_read(this.transport, 6, 0xc4);
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
      const read2 = await rom_read(this.transport, 6, 0xc4);
      await rom_write(this.transport, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio

      // 妫€鏌ユ槸鍚︽湁GPIO鍔熻兘
      for (let i = 0; i < 6; i++) {
        if (read1[i] !== read2[i]) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('妫€鏌BA GPIO鍔熻兘鏃跺嚭閿?', error);
      return false;
    }
  }

  /**
   * 璁剧疆GBA RTC鏃堕棿
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData = timeData as GBARTCData;

    try {
      if (!(await this.checkCapability())) {
        throw new Error('Cartridge does not have GPIO functionality');
      }

      // 浣跨敤luxon楠岃瘉杈撳叆鐨勬棩鏈熸椂闂存槸鍚︽湁鏁?
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

      // 璁剧疆鏃堕棿
      const year = this.intToCompressedBCD(rtcData.year % 100); // 鍙彇鍚庝袱浣?
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
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      // 绛夊緟鍐欏叆瀹屾垚
      await this.delay(1000);

      // 楠岃瘉鍐欏叆锛堜娇鐢ㄤ笓闂ㄧ殑楠岃瘉鏂规硶锛屼笉閲嶆柊鍒濆鍖朑PIO锛?
      await this.verifyWrittenTime(5);

      await this.cleanupGPIO();
    } catch (error) {
      // 纭繚鍦ㄥ嚭閿欐椂涔熸竻鐞咷PIO鐘舵€?
      try {
        await this.cleanupGPIO();
      } catch (cleanupError) {
        console.error('娓呯悊GPIO鐘舵€佹椂鍑洪敊:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 浠庣壒瀹氭椂鍖虹殑DateTime璁剧疆RTC鏃堕棿
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
   * 璁剧疆褰撳墠鏃堕棿鍒癛TC
   */
  async setCurrentTime(timezone?: string): Promise<void> {
    const now = timezone ? DateTime.now().setZone(timezone) : DateTime.now();
    await this.setTimeFromDateTime(now);
  }

  /**
   * 璇诲彇GBA RTC鏃堕棿
   */
  async readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
    try {
      if (!(await this.checkCapability())) {
        return { status: false, error: 'Cartridge does not have GPIO functionality' };
      }

      await this.initializeGPIO();
      const status = await this.checkAndResetIfNeeded();

      console.log(`RTC Status: 0x${status.toString(16)}`);

      // 璇诲彇鏃堕棿鏁版嵁
      await this.s3511_writeByte(0xa6); // read time command
      const year = this.compressedBCDToInt(await this.s3511_readByte());
      const month = this.compressedBCDToInt(await this.s3511_readByte() & 0x1f);
      const date = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const day = this.compressedBCDToInt(await this.s3511_readByte() & 0x07);
      const hour = this.compressedBCDToInt(await this.s3511_readByte() & 0x3f);
      const minute = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);
      const second = this.compressedBCDToInt(await this.s3511_readByte() & 0x7f);

      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      // 浣跨敤luxon鍒涘缓DateTime瀵硅薄
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
      console.error('璇诲彇GBA RTC鏃跺嚭閿?', error);
      // 纭繚鍦ㄥ嚭閿欐椂涔熸竻鐞咷PIO鐘舵€?
      try {
        await this.cleanupGPIO();
      } catch (cleanupError) {
        console.error('娓呯悊GPIO鐘舵€佹椂鍑洪敊:', cleanupError);
      }
      return { status: false, error: error instanceof Error ? error.message : '鏈煡閿欒' };
    }
  }
}
