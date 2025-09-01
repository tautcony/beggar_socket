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
   * 验证时间设置 - 子类可以重写此方法来自定义验证逻辑
   */
  protected async verifyTimeSet(attempts = 5): Promise<void> {
    for (let i = attempts; i > 0; i--) {
      const result = await this.readTime();
      if (result.status && result.time) {
        console.log(`验证 ${i}: ${result.time.toLocaleString()}`);
      }
      await this.delay(500);
    }
  }

  /**
   * 设置RTC时间 - 抽象方法，由子类实现
   */
  abstract setTime(timeData: unknown): Promise<void>;

  /**
   * 读取RTC时间 - 抽象方法，由子类实现
   */
  abstract readTime(): Promise<{ status: boolean; time?: Date; error?: string }>;

  /**
   * 检查RTC功能是否可用 - 抽象方法，由子类实现
   */
  abstract checkCapability(): Promise<boolean>;
}
