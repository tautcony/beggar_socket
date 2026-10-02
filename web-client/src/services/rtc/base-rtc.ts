import { DateTime } from 'luxon';

import type { Transport } from '@/platform/serial';
import { DeviceInfo } from '@/types/device-info';

export class RTCCleanupError extends Error {
  constructor(readonly errors: readonly unknown[]) {
    super('RTC cleanup failed');
    this.name = 'RTCCleanupError';
  }
}

/**
 * RTC操作的基础抽象类
 */
export abstract class BaseRTC {
  protected device: DeviceInfo;

  constructor(device: DeviceInfo) {
    this.device = device;
  }

  protected get transport(): Transport {
    const transport = this.device.transport ?? this.device.serialHandle?.transport;
    if (!transport) {
      throw new Error('Device transport is not initialized');
    }
    return transport;
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

  /** Run independent cleanup steps even when the operation or earlier cleanup fails. */
  protected async withCleanup<T>(operation: () => Promise<T>, cleanup: readonly (() => Promise<void>)[]): Promise<T> {
    let failed = false;
    let cause: unknown;
    try {
      return await operation();
    } catch (error) {
      failed = true;
      cause = error;
      throw error;
    } finally {
      const cleanupErrors: unknown[] = [];
      for (const step of cleanup) {
        try {
          await step();
        } catch (error) {
          cleanupErrors.push(...(error instanceof RTCCleanupError ? error.errors : [error]));
        }
      }
      if (cleanupErrors.length > 0) {
        console.error('RTC cleanup failed', { cause, cleanupErrors });
        if (!failed) {
          throw new RTCCleanupError(cleanupErrors);
        }
      }
    }
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
    if (![year, month, day, hour, minute, second].every(value => Number.isFinite(value) && Number.isInteger(value))) {
      return false;
    }
    const dt = DateTime.fromObject({ year, month, day, hour, minute, second });
    return dt.isValid;
  }

  protected static snapshotTimeFields<K extends string>(timeData: unknown, fields: readonly K[]): Record<K, number> {
    if (typeof timeData !== 'object' || timeData === null || Array.isArray(timeData)) {
      throw new Error('Invalid RTC time data');
    }

    const input = timeData as Record<string, unknown>;
    const snapshot = {} as Record<K, number>;
    for (const field of fields) {
      const value = input[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`Invalid RTC ${field}: must be a finite integer`);
      }
      snapshot[field] = value;
    }
    return snapshot;
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
