import { DateTime } from 'luxon';

import { gbc_read, gbc_write } from '@/protocol';

import { BaseRTC } from './base-rtc';

export interface MBC3RTCData {
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * MBC3 RTC鎿嶄綔绫?
 */
export class MBC3RTC extends BaseRTC {
  /**
   * 鍚敤RAM璁块棶
   */
  private async enableRAMAccess(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);
  }

  /**
   * 閿佸瓨鏃堕棿
   */
  private async latchTime(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x01]), 0x6000);
  }

  /**
   * 瑙ｉ攣鏃堕棿
   */
  private async unlatchTime(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x00]), 0x6000);
  }

  /**
   * 璇诲彇RTC瀵勫瓨鍣?
   */
  private async readRTCRegister(register: number): Promise<number> {
    await gbc_write(this.transport, new Uint8Array([register]), 0x4000);
    const data = await gbc_read(this.transport, 1, 0xa000);
    return data[0];
  }

  /**
   * 鍐欏叆RTC瀵勫瓨鍣?
   */
  private async writeRTCRegister(register: number, value: number): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([register]), 0x4000);
    await gbc_write(this.transport, new Uint8Array([value]), 0xa000);
  }

  /**
   * 鍋滄RTC璁℃椂鍣?
   */
  private async stopTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.writeRTCRegister(0x0c, 0x40); // Bit 6: Halt
  }

  /**
   * 鍚姩RTC璁℃椂鍣?
   */
  private async startTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await gbc_write(this.transport, new Uint8Array([0x00]), 0x4000);
    await gbc_write(this.transport, new Uint8Array([0x00]), 0x0000);
    await this.delay(100);
    await this.unlatchTime();
    await this.delay(100);
  }

  /**
   * 楠岃瘉鍐欏叆鏃堕棿锛堝湪宸插惎鐢≧AM鐨勭姸鎬佷笅杩涜锛?
   */
  private async verifyWrittenTime(attempts = 5): Promise<void> {
    for (let ii = attempts; ii > 0; ii--) {
      const verifyBuffer: number[] = [];
      await this.latchTime();
      for (let i = 0x08; i <= 0x0c; i++) {
        verifyBuffer.push(await this.readRTCRegister(i));
      }
      await this.unlatchTime();

      const verifyDay = ((verifyBuffer[4] & 0x01) << 8) | verifyBuffer[3];
      const verifyHour = verifyBuffer[2];
      const verifyMinute = verifyBuffer[1];
      const verifySecond = verifyBuffer[0];

      // 浣跨敤luxon鏍煎紡鍖栬緭鍑?
      const currentYear = DateTime.now().year;
      const dt = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
        .plus({ days: verifyDay - 1 })
        .set({ hour: verifyHour, minute: verifyMinute, second: verifySecond });

      if (dt.isValid) {
        console.log(`楠岃瘉 ${ii}: ${dt.toFormat('yyyy-MM-dd HH:mm:ss')} (绗?{verifyDay}澶?`);
      } else {
        console.log(`楠岃瘉 ${ii}: ${verifyDay}鏃?${verifyHour}:${verifyMinute}:${verifySecond} (鏃犳晥鏃ユ湡)`);
      }
      await this.delay(1000);
    }
  }

  /**
   * 妫€鏌BC3 RTC鍔熻兘鏄惁鍙敤
   */
  async checkCapability(): Promise<boolean> {
    try {
      await this.enableRAMAccess();
      await this.latchTime();

      // 灏濊瘯璇诲彇涓€涓猂TC瀵勫瓨鍣ㄦ潵妫€鏌ュ姛鑳?
      const second = await this.readRTCRegister(0x08);
      await this.unlatchTime();

      // 濡傛灉鑳芥垚鍔熻鍙栦笖鍊煎悎鐞嗭紝璁や负RTC鍔熻兘鍙敤
      return second >= 0 && second <= 59;
    } catch (error) {
      console.error('妫€鏌BC3 RTC鍔熻兘鏃跺嚭閿?', error);
      return false;
    }
  }

  /**
   * 璁剧疆MBC3 RTC鏃堕棿
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData = timeData as MBC3RTCData;

    try {
      // 浣跨敤luxon楠岃瘉杈撳叆鐨勬椂闂存槸鍚︽湁鏁?
      const currentYear = DateTime.now().year;
      const isLeapYear = DateTime.local(currentYear).isInLeapYear;
      const maxDays = isLeapYear ? 366 : 365;

      if (rtcData.day < 1 || rtcData.day > maxDays) {
        throw new Error(`Invalid day of year: ${rtcData.day}. Must be between 1 and ${maxDays}`);
      }

      if (rtcData.hour < 0 || rtcData.hour > 23) {
        throw new Error(`Invalid hour: ${rtcData.hour}. Must be between 0 and 23`);
      }

      if (rtcData.minute < 0 || rtcData.minute > 59) {
        throw new Error(`Invalid minute: ${rtcData.minute}. Must be between 0 and 59`);
      }

      if (rtcData.second < 0 || rtcData.second > 59) {
        throw new Error(`Invalid second: ${rtcData.second}. Must be between 0 and 59`);
      }

      await this.enableRAMAccess();

      // 璇诲彇褰撳墠鏃堕棿浠ラ獙璇佸姛鑳?
      await this.latchTime();
      const buffer: number[] = [];
      for (let i = 0x08; i <= 0x0d; i++) {
        buffer.push(await this.readRTCRegister(i));
      }
      await this.unlatchTime();

      // 鍑嗗鏂扮殑鏃堕棿鏁版嵁
      const timeDataArray = [
        rtcData.second,
        rtcData.minute,
        rtcData.hour,
        rtcData.day & 0xff,
        (rtcData.day & 0x100) >> 8, // 淇鏃ユ湡楂樹綅璁＄畻
      ];

      // 鍋滄璁℃椂鍣?
      await this.stopTimer();

      // 鍐欏叆鏂版椂闂?
      for (let i = 0x08; i <= 0x0c; i++) {
        await this.writeRTCRegister(i, timeDataArray[i - 0x08]);
      }

      // 閲嶅惎璁℃椂鍣?
      await this.startTimer();

      // 楠岃瘉璁剧疆锛堜娇鐢ㄤ笓闂ㄧ殑楠岃瘉鏂规硶锛屼笉閲嶆柊鍚敤RAM锛?
      await this.verifyWrittenTime(5);
    } catch (error) {
      console.error('璁剧疆MBC3 RTC鏃堕棿澶辫触:', error);
      throw error;
    }
  }

  /**
   * 浠嶥ateTime璁剧疆MBC3 RTC鏃堕棿
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
    const rtcData: MBC3RTCData = {
      day: dt.ordinal, // luxon鐩存帴鎻愪緵骞翠腑澶╂暟
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
   * 璇诲彇MBC3 RTC鏃堕棿
   */
  async readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
    try {
      await this.enableRAMAccess();

      // 閿佸瓨褰撳墠鏃堕棿
      await this.unlatchTime();
      await this.latchTime();

      // 璇诲彇鏃堕棿瀵勫瓨鍣?
      const second = (await this.readRTCRegister(0x08)) & 0x3f;
      const minute = (await this.readRTCRegister(0x09)) & 0x3f;
      const hour = (await this.readRTCRegister(0x0a)) & 0x1f;
      const dayLow = await this.readRTCRegister(0x0b);
      const dayHigh = (await this.readRTCRegister(0x0c)) & 0x01;

      const day = dayLow | (dayHigh << 8);

      // MBC3娌℃湁骞存湀淇℃伅锛屼娇鐢ㄥ綋鍓嶅勾浠界殑寮€濮嬶紝鐒跺悗鍔犱笂澶╂暟
      const currentYear = DateTime.now().year;
      const time = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
        .plus({ days: day - 1 })
        .set({ hour: hour, minute: minute, second: second });

      if (!time.isValid) {
        throw new Error(`Invalid date/time values: ${time.invalidReason}`);
      }

      return { status: true, time };
    } catch (error) {
      console.error('璇诲彇MBC3 RTC鏃跺嚭閿?', error);
      return { status: false, error: error instanceof Error ? error.message : '鏈煡閿欒' };
    }
  }

  /**
   * MBC3鐗规湁鐨勯獙璇佹椂闂磋缃柟娉?
   */
  protected override async verifyTimeSet(attempts = 5): Promise<void> {
    await this.enableRAMAccess();

    for (let ii = attempts; ii > 0; ii--) {
      const verifyBuffer: number[] = [];
      await this.latchTime();
      for (let i = 0x08; i <= 0x0c; i++) {
        verifyBuffer.push(await this.readRTCRegister(i));
      }
      await this.unlatchTime();

      const verifyDay = ((verifyBuffer[4] & 0x01) << 8) | verifyBuffer[3];
      const verifyHour = verifyBuffer[2];
      const verifyMinute = verifyBuffer[1];
      const verifySecond = verifyBuffer[0];

      // 浣跨敤luxon鏍煎紡鍖栬緭鍑?
      const currentYear = DateTime.now().year;
      const dt = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
        .plus({ days: verifyDay - 1 })
        .set({ hour: verifyHour, minute: verifyMinute, second: verifySecond });

      if (dt.isValid) {
        console.log(`楠岃瘉 ${ii}: ${dt.toFormat('yyyy-MM-dd HH:mm:ss')} (绗?{verifyDay}澶?`);
      } else {
        console.log(`楠岃瘉 ${ii}: ${verifyDay}鏃?${verifyHour}:${verifyMinute}:${verifySecond} (鏃犳晥鏃ユ湡)`);
      }
      await this.delay(1000);
    }
  }
}
