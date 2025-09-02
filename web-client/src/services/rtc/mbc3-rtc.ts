import { DateTime } from 'luxon';

import { gbc_read, gbc_write } from '@/protocol/beggar_socket/protocol';

import { BaseRTC } from './base-rtc';

export interface MBC3RTCData {
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * MBC3 RTC操作类
 */
export class MBC3RTC extends BaseRTC {
  /**
   * 启用RAM访问
   */
  private async enableRAMAccess(): Promise<void> {
    await gbc_write(this.device, new Uint8Array([0x0a]), 0x0000);
  }

  /**
   * 锁存时间
   */
  private async latchTime(): Promise<void> {
    await gbc_write(this.device, new Uint8Array([0x01]), 0x6000);
  }

  /**
   * 解锁时间
   */
  private async unlatchTime(): Promise<void> {
    await gbc_write(this.device, new Uint8Array([0x00]), 0x6000);
  }

  /**
   * 读取RTC寄存器
   */
  private async readRTCRegister(register: number): Promise<number> {
    await gbc_write(this.device, new Uint8Array([register]), 0x4000);
    const data = await gbc_read(this.device, 1, 0xa000);
    return data[0];
  }

  /**
   * 写入RTC寄存器
   */
  private async writeRTCRegister(register: number, value: number): Promise<void> {
    await gbc_write(this.device, new Uint8Array([register]), 0x4000);
    await gbc_write(this.device, new Uint8Array([value]), 0xa000);
  }

  /**
   * 停止RTC计时器
   */
  private async stopTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await this.writeRTCRegister(0x0c, 0x40); // Bit 6: Halt
  }

  /**
   * 启动RTC计时器
   */
  private async startTimer(): Promise<void> {
    await this.unlatchTime();
    await this.latchTime();
    await gbc_write(this.device, new Uint8Array([0x00]), 0x4000);
    await gbc_write(this.device, new Uint8Array([0x00]), 0x0000);
    await this.delay(100);
    await this.unlatchTime();
    await this.delay(100);
  }

  /**
   * 验证写入时间（在已启用RAM的状态下进行）
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

      // 使用luxon格式化输出
      const currentYear = DateTime.now().year;
      const dt = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
        .plus({ days: verifyDay - 1 })
        .set({ hour: verifyHour, minute: verifyMinute, second: verifySecond });

      if (dt.isValid) {
        console.log(`验证 ${ii}: ${dt.toFormat('yyyy-MM-dd HH:mm:ss')} (第${verifyDay}天)`);
      } else {
        console.log(`验证 ${ii}: ${verifyDay}日 ${verifyHour}:${verifyMinute}:${verifySecond} (无效日期)`);
      }
      await this.delay(1000);
    }
  }

  /**
   * 检查MBC3 RTC功能是否可用
   */
  async checkCapability(): Promise<boolean> {
    try {
      await this.enableRAMAccess();
      await this.latchTime();

      // 尝试读取一个RTC寄存器来检查功能
      const second = await this.readRTCRegister(0x08);
      await this.unlatchTime();

      // 如果能成功读取且值合理，认为RTC功能可用
      return second >= 0 && second <= 59;
    } catch (error) {
      console.error('检查MBC3 RTC功能时出错:', error);
      return false;
    }
  }

  /**
   * 设置MBC3 RTC时间
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData = timeData as MBC3RTCData;

    try {
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

      await this.enableRAMAccess();

      // 读取当前时间以验证功能
      await this.latchTime();
      const buffer: number[] = [];
      for (let i = 0x08; i <= 0x0d; i++) {
        buffer.push(await this.readRTCRegister(i));
      }
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
      await this.stopTimer();

      // 写入新时间
      for (let i = 0x08; i <= 0x0c; i++) {
        await this.writeRTCRegister(i, timeDataArray[i - 0x08]);
      }

      // 重启计时器
      await this.startTimer();

      // 验证设置（使用专门的验证方法，不重新启用RAM）
      await this.verifyWrittenTime(5);
    } catch (error) {
      console.error('设置MBC3 RTC时间失败:', error);
      throw error;
    }
  }

  /**
   * 从DateTime设置MBC3 RTC时间
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
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
    } catch (error) {
      console.error('读取MBC3 RTC时出错:', error);
      return { status: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /**
   * MBC3特有的验证时间设置方法
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

      // 使用luxon格式化输出
      const currentYear = DateTime.now().year;
      const dt = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
        .plus({ days: verifyDay - 1 })
        .set({ hour: verifyHour, minute: verifyMinute, second: verifySecond });

      if (dt.isValid) {
        console.log(`验证 ${ii}: ${dt.toFormat('yyyy-MM-dd HH:mm:ss')} (第${verifyDay}天)`);
      } else {
        console.log(`验证 ${ii}: ${verifyDay}日 ${verifyHour}:${verifyMinute}:${verifySecond} (无效日期)`);
      }
      await this.delay(1000);
    }
  }
}
