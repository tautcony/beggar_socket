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
 * MBC3 RTC操作
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
   * 启用RAM访问
   */
  private async enableRAMAccess(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);
  }

  /**
   * 锁存时间
   */
  private async latchTime(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x01]), 0x6000);
  }

  /**
   * 解锁时间
   */
  private async unlatchTime(): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([0x00]), 0x6000);
  }

  /**
   * 读取RTC寄存器
   */
  private async readRTCRegister(register: number): Promise<number> {
    await gbc_write(this.transport, new Uint8Array([register]), 0x4000);
    const data = await gbc_read(this.transport, 1, 0xa000);
    return data[0];
  }

  /**
   * 写入RTC寄存器
   */
  private async writeRTCRegister(register: number, value: number): Promise<void> {
    await gbc_write(this.transport, new Uint8Array([register]), 0x4000);
    await gbc_write(this.transport, new Uint8Array([value]), 0xa000);
  }

  /**
   * 停止RTC计时
   */
  private async stopTimer(originalHigh: number): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.writeRTCRegister(0x0c, originalHigh | 0x40); // Bit 6: Halt
  }

  /**
   * 重启RTC计时
   */
  private async startTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.delay(100);
    await this.unlatchTime();
    await this.delay(100);
  }

  /**
   * 验证写入时间（在已启用 RAM 的状态下进行）
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
   * 检查 MBC3 RTC 是否可用
   */
  async checkCapability(): Promise<boolean> {
    try {
      return await this.withCleanup(async () => {
        await this.enableRAMAccess();
        await this.latchTime();

        // 尝试读取一个RTC寄存器来检查功能
        const second = await this.readRTCRegister(0x08);
        await this.unlatchTime();

        // 如果能成功读取且值合理，认为RTC功能可用
        return second >= 0 && second <= 59;
      }, this.idleCleanup());
    } catch (error) {
      console.error('检查 MBC3 RTC 功能时出错', error);
      return false;
    }
  }

  /**
   * 设置MBC3 RTC时间
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData: MBC3RTCData = BaseRTC.snapshotTimeFields(timeData, ['day', 'hour', 'minute', 'second']);

    // 使用luxon验证输入的时间是否有效
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

        // 读取当前时间以验证功能
        await this.latchTime();
        const buffer: number[] = [];
        for (let i = 0x08; i <= 0x0d; i++) {
          buffer.push(await this.readRTCRegister(i));
        }
        originalHigh = buffer[4];
        await this.unlatchTime();

        // 准备新的时间数据
        const timeDataArray = [
          rtcData.second,
          rtcData.minute,
          rtcData.hour,
          rtcData.day & 0xff,
          (rtcData.day & 0x100) >> 8, // 修正日期高位计算
        ];

        // 停止计时器
        haltAttempted = true;
        await this.stopTimer(originalHigh);

        // 写入新时间
        for (let i = 0x08; i < 0x0c; i++) {
          await this.writeRTCRegister(i, timeDataArray[i - 0x08]);
        }
        const started = performance.now();
        await this.writeRTCRegister(0x0c, timeDataArray[4]);
        const writeCompletedAt = performance.now();

        // 重启计时
        await this.startTimer();

        // 验证设置（使用专门的验证方法，不重新启用 RAM）
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
      console.error('设置MBC3 RTC时间失败:', error);
      throw error;
    }
  }

  /**
   * 从DateTime设置MBC3 RTC时间
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
    if (!DateTime.isDateTime(dt) || !dt.isValid) {
      throw new Error('Invalid date/time provided');
    }
    const rtcData: MBC3RTCData = {
      day: dt.ordinal, // luxon直接提供年中天数
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
   * 读取MBC3 RTC时间
   */
  async readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
    try {
      return await this.withCleanup(async () => {
        await this.enableRAMAccess();

        // 锁存当前时间
        await this.unlatchTime();
        await this.latchTime();

        // 读取时间寄存器
        const second = (await this.readRTCRegister(0x08)) & 0x3f;
        const minute = (await this.readRTCRegister(0x09)) & 0x3f;
        const hour = (await this.readRTCRegister(0x0a)) & 0x1f;
        const dayLow = await this.readRTCRegister(0x0b);
        const dayHigh = (await this.readRTCRegister(0x0c)) & 0x01;

        const day = dayLow | (dayHigh << 8);

        // MBC3没有年月信息，使用当前年份的开始，然后加上天数
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
      console.error('读取MBC3 RTC时出错:', error);
      return { status: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

}
