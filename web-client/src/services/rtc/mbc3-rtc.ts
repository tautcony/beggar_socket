import { DateTime } from 'luxon';

import { gbc_read, gbc_write } from '@/protocol';

import { BaseRTC, type RTCWriteReference } from './base-rtc';

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
  /** Restore the defined idle mapping; the original bank/access state is unavailable. */
  private idleCleanup(): (() => Promise<void>)[] {
    return [
      () => this.unlatchTime(),
      () => gbc_write(this.transport, new Uint8Array([0x00]), 0x4000),
      () => gbc_write(this.transport, new Uint8Array([0x00]), 0x0000),
    ];
  }

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
  private async stopTimer(originalHigh: number): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.writeRTCRegister(0x0c, originalHigh | 0x40); // Bit 6: Halt
  }

  /**
   * 鍚姩RTC璁℃椂鍣?
   */
  private async startTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.delay(100);
    await this.unlatchTime();
    await this.delay(100);
  }

  /**
   * 楠岃瘉鍐欏叆鏃堕棿锛堝湪宸插惎鐢≧AM鐨勭姸鎬佷笅杩涜锛?
   */
  private async verifyWrittenTime(target: MBC3RTCData, reference: RTCWriteReference): Promise<void> {
    const cycle = 512 * 86400;
    const targetSeconds = target.day * 86400 + target.hour * 3600 + target.minute * 60 + target.second;
    await this.verifyWrittenSnapshot(reference, () => this.withCleanup(async () => {
      await this.unlatchTime();
      await this.latchTime();
      const observedAt = performance.now();
      const value: number[] = [];
      for (let register = 0x08; register <= 0x0c; register++) value.push(await this.readRTCRegister(register));
      return { value, observedAt };
    }, [() => this.unlatchTime()]), (bytes, minimum, maximum) => {
      const [second, minute, hour, low, high] = bytes;
      if (bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)
        || second > 59 || minute > 59 || hour > 23 || (high & 0x40) !== 0) return false;
      // Undefined DH bits are ignored; Halt and sticky day carry are checked explicitly.
      const day = low | ((high & 1) << 8);
      const actual = day * 86400 + hour * 3600 + minute * 60 + second;
      const elapsed = this.elapsedCounterSeconds(actual - targetSeconds, cycle, minimum, maximum);
      return elapsed !== undefined && ((high & 0x80) !== 0) === (targetSeconds + elapsed >= cycle);
    });
  }

  /**
   * 妫€鏌BC3 RTC鍔熻兘鏄惁鍙敤
   */
  async checkCapability(): Promise<boolean> {
    try {
      return await this.withCleanup(async () => {
        await this.enableRAMAccess();
        await this.latchTime();

        // 灏濊瘯璇诲彇涓€涓猂TC瀵勫瓨鍣ㄦ潵妫€鏌ュ姛鑳?
        const second = await this.readRTCRegister(0x08);
        await this.unlatchTime();

        // 濡傛灉鑳芥垚鍔熻鍙栦笖鍊煎悎鐞嗭紝璁や负RTC鍔熻兘鍙敤
        return second >= 0 && second <= 59;
      }, this.idleCleanup());
    } catch (error) {
      console.error('妫€鏌BC3 RTC鍔熻兘鏃跺嚭閿?', error);
      return false;
    }
  }

  /**
   * 璁剧疆MBC3 RTC鏃堕棿
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData: MBC3RTCData = BaseRTC.snapshotTimeFields(timeData, ['day', 'hour', 'minute', 'second']);

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

    let originalHigh: number | undefined;
    let haltAttempted = false;
    let completed = false;
    try {
      await this.withCleanup(async () => {
        await this.enableRAMAccess();

        // 璇诲彇褰撳墠鏃堕棿浠ラ獙璇佸姛鑳?
        await this.latchTime();
        const buffer: number[] = [];
        for (let i = 0x08; i <= 0x0d; i++) {
          buffer.push(await this.readRTCRegister(i));
        }
        originalHigh = buffer[4];
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
        haltAttempted = true;
        await this.stopTimer(originalHigh);

        // 鍐欏叆鏂版椂闂?
        for (let i = 0x08; i < 0x0c; i++) {
          await this.writeRTCRegister(i, timeDataArray[i - 0x08]);
        }
        const started = performance.now();
        await this.writeRTCRegister(0x0c, timeDataArray[4]);
        const writeCompletedAt = performance.now();

        // 閲嶅惎璁℃椂鍣?
        await this.startTimer();

        // 楠岃瘉璁剧疆锛堜娇鐢ㄤ笓闂ㄧ殑楠岃瘉鏂规硶锛屼笉閲嶆柊鍚敤RAM锛?
        await this.verifyWrittenTime(rtcData, { started, completed: writeCompletedAt });
        completed = true;
      }, [
        async () => {
          if (haltAttempted && !completed && originalHigh !== undefined) {
            // Restore control only: the other time registers may be partially written.
            await this.writeRTCRegister(0x0c, originalHigh);
          }
        },
        ...this.idleCleanup(),
      ]);
    } catch (error) {
      console.error('璁剧疆MBC3 RTC鏃堕棿澶辫触:', error);
      throw error;
    }
  }

  /**
   * 浠嶥ateTime璁剧疆MBC3 RTC鏃堕棿
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
    if (!DateTime.isDateTime(dt) || !dt.isValid) {
      throw new Error('Invalid date/time provided');
    }
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
      return await this.withCleanup(async () => {
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
      }, this.idleCleanup());
    } catch (error) {
      console.error('璇诲彇MBC3 RTC鏃跺嚭閿?', error);
      return { status: false, error: error instanceof Error ? error.message : '鏈煡閿欒' };
    }
  }

}
