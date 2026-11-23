import { DateTime } from 'luxon';

import {
  boost_enter_mode,
  boost_gba_rtc_read,
  ensureDefaultProtocol,
  rom_read,
  rom_write,
  toLittleEndian,
} from '@/protocol';

import { BaseRTC, RTCCleanupError, type RTCWriteReference } from './base-rtc';

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
 * GBA RTC操作
 */
export interface GBARTCOptions {
  /**
   * `beggar-stm-boost` resolves `runtimeFeatures.boostTransport`; the native RTC commands
   * only exist on that transport, so the session feature is the only source.
   */
  readonly boostTransport?: boolean;
}

export class GBARTC extends BaseRTC {
  private readonly boostTransport: boolean;

  constructor(transport: ConstructorParameters<typeof BaseRTC>[0], options: GBARTCOptions = {}) {
    super(transport);
    this.boostTransport = options.boostTransport ?? false;
  }

  /**
   * 使用 Beggar Boost 固件原生 0xca 命令一次读取 8 字节 RTC 状态与时间。
   */
  private async readTimeNative(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
    await boost_enter_mode(this.transport, 'agb');
    const raw = await boost_gba_rtc_read(this.transport);
    const status = raw[0];
    if ((status & 0x80) !== 0) {
      return { status: false, error: 'RTC power loss detected' };
    }

    const year = this.compressedBCDToInt(raw[1]);
    const month = this.compressedBCDToInt(raw[2] & 0x1f);
    const date = this.compressedBCDToInt(raw[3] & 0x3f);
    const hour = this.compressedBCDToInt(raw[5] & 0x3f);
    const minute = this.compressedBCDToInt(raw[6] & 0x7f);
    const second = this.compressedBCDToInt(raw[7] & 0x7f);

    const time = DateTime.fromObject({
      year: 2000 + year,
      month,
      day: date,
      hour,
      minute,
      second,
    });
    if (!time.isValid) {
      return { status: false, error: `Invalid date/time values: ${time.invalidReason}` };
    }
    return { status: true, time };
  }
  /**
   * GBA RTC GPIO 写字节操作
   */
  private async s3511_writeByte(value: number): Promise<void> {
    // SIO为输出
    await rom_write(this.transport, toLittleEndian(0x07, 2), 0xc6 >> 1); // sio out

    for (let i = 0; i < 8; i++) {
      const bit = (value & 0x01) !== 0 ? 0x02 : 0x00;
      value >>= 1;

      await rom_write(this.transport, toLittleEndian(0x04 | bit, 2), 0xc4 >> 1); // cs 1, sck 0
      await rom_write(this.transport, toLittleEndian(0x05 | bit, 2), 0xc4 >> 1); // cs 1, sck 1
    }
  }

  /**
   * GBA RTC GPIO 读字节操作
   */
  private async s3511_readByte(): Promise<number> {
    let value = 0;

    // SIO为输入
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
   * 初始化GPIO
   */
  private async initializeGPIO(): Promise<void> {
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(this.transport, toLittleEndian(0x07, 2), 0xc6 >> 1); // cs sio sck output
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  }

  /**
   * GPIO状态
   */
  private async cleanupGPIO(): Promise<void> {
    const errors: unknown[] = [];
    for (const step of [
      () => rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1), // cs 0, sck 1
      () => rom_write(this.transport, toLittleEndian(0x00, 2), 0xc8 >> 1), // disable gpio
    ]) {
      try {
        await step();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new RTCCleanupError(errors);
    }
  }

  /**
   * 读取RTC状态并处理电池没电的情况
   */
  private async checkAndResetIfNeeded(normalize24Hour = false): Promise<number> {
    // 读取RTC状态
    await this.s3511_writeByte(0xc6);
    const status = await this.s3511_readByte();
    await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

    // 如果电池没电，重置RTC
    if ((status & 0x80) !== 0) {
      await this.s3511_writeByte(0x06); // reset
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

      await this.s3511_writeByte(0x46); // write status
      await this.s3511_writeByte(0x40); // 24 hour mode
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
    }

    if (normalize24Hour && (status & 0xc0) === 0) {
      await this.s3511_writeByte(0x46);
      await this.s3511_writeByte((status & 0x2a) | 0x40);
      await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1);
    }
    return status;
  }

  /**
   * 验证写入时间（在已初始化 GPIO 状态下进行）
   */
  private async verifyWrittenTime(target: GBARTCData, reference: RTCWriteReference): Promise<void> {
    const epoch = DateTime.utc(2000, 1, 1).toSeconds();
    const cycle = DateTime.utc(2100, 1, 1).toSeconds() - epoch;
    const targetTime = DateTime.utc(2000 + target.year, target.month, target.date, target.hour, target.minute, target.second);
    await this.verifyWrittenSnapshot(reference, async () => {
      const status = await this.withCleanup(async () => {
        await this.s3511_writeByte(0xc6);
        return this.s3511_readByte();
      }, [() => rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1)]);
      return this.withCleanup(async () => {
        await this.s3511_writeByte(0xa6);
        const observedAt = performance.now();
        const bytes: number[] = [];
        for (let i = 0; i < 7; i++) bytes.push(await this.s3511_readByte());
        return { value: { status, bytes }, observedAt };
      }, [() => rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1)]);
    }, ({ status, bytes }, minimum, maximum) => {
      // POWER, unsupported status bits and 12-hour mode are not a valid written state.
      if (!Number.isInteger(status) || status < 0 || status > 255 || (status & 0x40) === 0 || (status & ~0x6a) !== 0) return false;
      const masks = [0xff, 0x1f, 0x3f, 0x07, 0x7f, 0x7f, 0x7f];
      if (bytes.some((byte, i) => !Number.isInteger(byte) || byte < 0 || byte > 255 || (byte & ~masks[i]) !== 0)) return false;
      // Hour bit 6 is the AM/PM flag, ignored in 24-hour mode; second bit 7 is TEST.
      const bcd = bytes.map((byte, i) => i === 4 ? byte & 0x3f : byte);
      if (bcd.some(byte => (byte & 0x0f) > 9 || (byte >> 4) > 9)) return false;
      const [year, month, date, day, hour, minute, second] = bcd.map(byte => this.compressedBCDToInt(byte));
      if (month < 1 || month > 12 || date < 1 || date > 31 || day > 6 || hour > 23 || minute > 59 || second > 59
        || !BaseRTC.isValidDateTime(2000 + year, month, date, hour, minute, second)) return false;
      const actual = DateTime.utc(2000 + year, month, date, hour, minute, second);
      const elapsed = this.elapsedCounterSeconds(actual.toSeconds() - targetTime.toSeconds(), cycle, minimum, maximum);
      if (elapsed === undefined) return false;
      const targetSeconds = targetTime.toSeconds() - epoch;
      const days = Math.floor((targetSeconds + elapsed) / 86400) - Math.floor(targetSeconds / 86400);
      return day === (target.day + days) % 7;
    });
  }
  async checkCapability(): Promise<boolean> {
    try {
      if (this.boostTransport) {
        await ensureDefaultProtocol(this.transport);
      }
      return await this.withCleanup(async () => {
        // 检测GPIO
        const read1 = await rom_read(this.transport, 6, 0xc4);
        await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
        const read2 = await rom_read(this.transport, 6, 0xc4);

        // 检查是否有GPIO
        for (let i = 0; i < 6; i++) {
          if (read1[i] !== read2[i]) {
            return true;
          }
        }
        return false;
      }, [() => this.cleanupGPIO()]);
    } catch (error) {
      console.error('检查 GBA GPIO 功能时出错', error);
      return false;
    }
  }

  /**
   * 设置GBA RTC时间
   */
  async setTime(timeData: unknown): Promise<void> {
    const rtcData: GBARTCData = BaseRTC.snapshotTimeFields(timeData, ['year', 'month', 'date', 'day', 'hour', 'minute', 'second']);
    if (
      rtcData.year < 0 || rtcData.year > 99
      || rtcData.month < 1 || rtcData.month > 12
      || rtcData.day < 0 || rtcData.day > 6
      || rtcData.hour < 0 || rtcData.hour > 23
      || rtcData.minute < 0 || rtcData.minute > 59
      || rtcData.second < 0 || rtcData.second > 59
      || !BaseRTC.isValidDateTime(
        rtcData.year + 2000,
        rtcData.month,
        rtcData.date,
        rtcData.hour,
        rtcData.minute,
        rtcData.second,
      )
    ) {
      throw new Error('Invalid date/time provided');
    }

    try {
      if (this.boostTransport) {
        await ensureDefaultProtocol(this.transport);
      }
      if (!(await this.checkCapability())) {
        throw new Error('Cartridge does not have GPIO functionality');
      }

      await this.withCleanup(async () => {
        await this.initializeGPIO();
        await this.checkAndResetIfNeeded(true);

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
        const started = performance.now();
        await this.s3511_writeByte(second);
        await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1
        const completed = performance.now();

        // 等待写入完成
        await this.delay(1000);

        // 验证写入（使用专门的验证方法，不重新初始化 GPIO）
        await this.verifyWrittenTime(rtcData, { started, completed });

      }, [() => this.cleanupGPIO()]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 从特定时区的DateTime设置RTC时间
   */
  async setTimeFromDateTime(dt: DateTime): Promise<void> {
    if (!DateTime.isDateTime(dt) || !dt.isValid) {
      throw new Error('Invalid date/time provided');
    }
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
      if (this.boostTransport) {
        const nativeResult = await this.readTimeNative();
        if (nativeResult.status) {
          return nativeResult;
        }
        // 若原生读取检测到掉电状态，继续走标准 GPIO 流程以执行电池掉电重置
      }

      if (!(await this.checkCapability())) {
        return { status: false, error: 'Cartridge does not have GPIO functionality' };
      }

      return await this.withCleanup(async () => {
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

        await rom_write(this.transport, toLittleEndian(0x01, 2), 0xc4 >> 1); // cs 0, sck 1

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

        return { status: true, time };
      }, [() => this.cleanupGPIO()]);
    } catch (error) {
      console.error('读取GBA RTC时出错:', error);
      return { status: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }
}
