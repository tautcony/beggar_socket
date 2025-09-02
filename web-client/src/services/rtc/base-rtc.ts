import { DateTime } from 'luxon';

import { DeviceInfo } from '@/types/device-info';

/**
 * RTC操作的基础抽象类
 */
export abstract class BaseRTC {
  protected device: DeviceInfo;

  constructor(device: DeviceInfo) {
    this.device = device;
  }

  /**
   * 将整数转换为压缩BCD码
   */
  protected intToCompressedBCD(number: number): number {
    const tens = Math.floor(number / 10);
    const units = number % 10;
    return (tens << 4) | units;
  }

  /**
   * 将压缩BCD码转换为整数
   */
  protected compressedBCDToInt(bcd: number): number {
    const tens = (bcd >> 4) & 0x0f;
    const units = bcd & 0x0f;
    return tens * 10 + units;
  }

  /**
   * 延迟函数
   */
  protected async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证时间设置
   */
  protected async verifyTimeSet(attempts = 5): Promise<void> {
    for (let i = attempts; i > 0; i--) {
      const result = await this.readTime();
      if (result.status && result.time) {
        console.log(`验证 ${i}: ${result.time.toFormat('yyyy-MM-dd HH:mm:ss')}`);
      }
      await this.delay(500);
    }
  }

  /**
   * 格式化时间显示
   */
  protected formatDateTime(dateTime: DateTime, format = 'yyyy-MM-dd HH:mm:ss'): string {
    return dateTime.isValid ? dateTime.toFormat(format) : 'Invalid Date';
  }

  /**
   * 获取当前时间的DateTime对象
   */
  protected static getCurrentDateTime(timezone?: string): DateTime {
    return timezone ? DateTime.now().setZone(timezone) : DateTime.now();
  }

  /**
   * 验证日期时间是否合理
   */
  protected static isValidDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number): boolean {
    const dt = DateTime.fromObject({ year, month, day, hour, minute, second });
    return dt.isValid;
  }

  /**
   * 设置RTC时间
   */
  abstract setTime(timeData: unknown): Promise<void>;

  /**
   * 读取RTC时间
   */
  abstract readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }>;

  /**
   * 检查RTC功能是否可用
   */
  abstract checkCapability(): Promise<boolean>;
}
