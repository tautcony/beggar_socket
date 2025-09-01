import { DeviceInfo } from '@/types/device-info';

import { BaseRTC } from './base-rtc';
import { GBARTC, GBARTCData } from './gba-rtc';
import { MBC3RTC, MBC3RTCData } from './mbc3-rtc';

export type RTCType = 'gba' | 'mbc3';
export type RTCData = GBARTCData | MBC3RTCData;

/**
 * RTC工厂类 - 用于创建不同类型的RTC实例
 */
export class RTCFactory {
  /**
   * 创建RTC实例
   */
  static createRTC(type: RTCType, device: DeviceInfo): BaseRTC {
    switch (type) {
      case 'gba':
        return new GBARTC(device);
      case 'mbc3':
        return new MBC3RTC(device);
      default:
        throw new Error(`Unsupported RTC type: ${type}`);
    }
  }
}

/**
 * 通用RTC操作接口 - 提供统一的RTC操作方法
 */
export class RTCManager {
  private rtc: BaseRTC;

  constructor(type: RTCType, device: DeviceInfo) {
    this.rtc = RTCFactory.createRTC(type, device);
  }

  /**
   * 检查RTC功能是否可用
   */
  async checkCapability(): Promise<boolean> {
    return await this.rtc.checkCapability();
  }

  /**
   * 设置RTC时间
   */
  async setTime(timeData: RTCData): Promise<void> {
    await this.rtc.setTime(timeData);
  }

  /**
   * 读取RTC时间
   */
  async readTime(): Promise<{ status: boolean; time?: Date; error?: string }> {
    return await this.rtc.readTime();
  }
}

// 导出类型和接口
export { BaseRTC } from './base-rtc';
export { GBARTC, type GBARTCData } from './gba-rtc';
export { MBC3RTC, type MBC3RTCData } from './mbc3-rtc';
