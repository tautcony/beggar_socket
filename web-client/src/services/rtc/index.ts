import { DateTime } from 'luxon';

import { DeviceInfo } from '@/types/device-info';

import { BaseRTC } from './base-rtc';
import { GBARTC, GBARTCData } from './gba-rtc';
import { MBC3RTC, MBC3RTCData } from './mbc3-rtc';

export type RTCType = 'GBA' | 'MBC3';

/**
 * Boost transport is a session feature. The legacy profile is only consulted for adapters
 * that were built without a committed session (direct tool use in tests).
 */
function boostTransportOf(device: DeviceInfo): boolean {
  return device.session?.runtimeFeatures.boostTransport
    ?? device.firmwareProfile?.capabilities.boostMode
    ?? false;
}
export type RTCData = GBARTCData | MBC3RTCData;

function createRTC(type: RTCType, device: DeviceInfo): BaseRTC {
  switch (type) {
    case 'GBA':
      return new GBARTC(device, { boostTransport: boostTransportOf(device) });
    case 'MBC3':
      return new MBC3RTC(device);
    default:
      throw new Error(`Unsupported RTC type: ${type}`);
  }
}

/**
 * 通用RTC操作接口 - 提供统一的RTC操作方法
 */
export class RTCManager {
  private rtc: BaseRTC;

  constructor(type: RTCType, device: DeviceInfo) {
    this.rtc = createRTC(type, device);
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
  async readTime(): Promise<{ status: boolean; time?: DateTime; error?: string }> {
    return await this.rtc.readTime();
  }
}

// 导出类型和接口
export { BaseRTC } from './base-rtc';
export { GBARTC, type GBARTCData } from './gba-rtc';
export { MBC3RTC, type MBC3RTCData } from './mbc3-rtc';
