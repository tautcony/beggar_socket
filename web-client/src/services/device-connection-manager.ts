import { type DeviceSelection, getDeviceGateway, toLegacyDeviceInfo, withPortInfo } from '@/platform/serial';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';
import { isElectron } from '@/utils/electron';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilter } from '@/utils/port-filter';

/**
 * 设备连接管理器
 * 统一处理 Web Serial API 和 Electron 原生串口的设备连接
 */
export class DeviceConnectionManager {
  private static instance: DeviceConnectionManager;
  private readonly gateway = getDeviceGateway();

  private constructor() {}

  static getInstance(): DeviceConnectionManager {
    if (!DeviceConnectionManager.instance) {
      DeviceConnectionManager.instance = new DeviceConnectionManager();
    }
    return DeviceConnectionManager.instance;
  }

  /**
   * 请求串口设备连接
   */
  async requestDevice(filter?: PortFilter): Promise<DeviceInfo> {
    // 调试模式：返回模拟设备
    if (DebugSettings.debugMode) {
      console.log('[DEBUG] 调试模式启用，返回模拟设备');
      return DebugSettings.createMockDeviceInfo();
    }

    // Electron 环境：使用原生串口
    if (isElectron()) {
      return this.requestElectronDevice(filter);
    }

    const selection = await this.gateway.select(filter);
    const device = await this.gateway.connect(selection);
    return toLegacyDeviceInfo(device);
  }

  /**
   * 使用指定的串口连接设备
   */
  async connectWithSelectedPort(selectedPort: SerialPortInfo): Promise<DeviceInfo> {
    if (!isElectron()) {
      throw new Error('This method is only available in Electron environment');
    }

    try {
      console.log('Connecting with selected port:', selectedPort);

      const selection: DeviceSelection = { portInfo: selectedPort };
      const device = await this.gateway.connect(selection);
      return withPortInfo(toLegacyDeviceInfo(device), selectedPort);
    } catch (error) {
      console.error('Failed to connect to selected port:', error);
      throw error;
    }
  }

  /**
   * Electron 环境下的设备连接
   */
  private async requestElectronDevice(filter?: PortFilter): Promise<DeviceInfo> {
    try {
      const serialPortInfos = await this.gateway.list(filter);

      if (serialPortInfos.length !== 1) {
        throw new PortSelectionRequiredError(serialPortInfos);
      }

      // 只有一个端口，直接使用
      const selectedPort = serialPortInfos[0];
      return await this.connectWithSelectedPort(selectedPort);
    } catch (error) {
      // 如果是 PortSelectionRequiredError，直接重新抛出，不要包装
      if (error instanceof PortSelectionRequiredError) {
        throw error;
      }

      console.error('Failed to connect to Electron device:', error);
      throw error;
    }
  }

  /**
   * 初始化串口状态（设置 DTR/RTS 信号）
   */
  async initializeDevice(device: DeviceInfo): Promise<void> {
    // 调试模式：跳过硬件初始化
    if (DebugSettings.debugMode) {
      console.log('[DEBUG] 调试模式，跳过设备初始化');
      return;
    }

    const handle = device.serialHandle;
    if (!handle) return;
    await this.gateway.init(handle);
  }

  async listAvailablePorts(filter?: PortFilter): Promise<SerialPortInfo[]> {
    return this.gateway.list(filter);
  }

  /**
   * 断开设备连接
   */
  async disconnectDevice(device: DeviceInfo): Promise<void> {
    const handle = device.serialHandle;
    if (!handle) return;
    await this.gateway.disconnect(handle);
    device.connection = null;
    device.port = null;
    device.transport = null;
  }

  /**
   * 检查设备是否已连接
   */
  isDeviceConnected(device: DeviceInfo): boolean {
    return !!(device.transport ?? device.connection ?? device.port);
  }
}

// 导出单例实例
export const deviceConnectionManager = DeviceConnectionManager.getInstance();
export { PortSelectionRequiredError };
