import { SerialService } from '@/services/SerialService';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo } from '@/types/device-info';
import { timeout } from '@/utils/async-utils';
import { isElectron } from '@/utils/electron';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';

// 导出错误类供外部使用
export { PortSelectionRequiredError };

/**
 * 设备连接管理器
 * 统一处理 Web Serial API 和 Electron 原生串口的设备连接
 */
export class DeviceConnectionManager {
  private static instance: DeviceConnectionManager;
  private serialService = SerialService.getInstance();

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
  async requestDevice(): Promise<DeviceInfo> {
    // 调试模式
    if (DebugSettings.debugMode) {
      await timeout(1000);
      const mockPort = {
        readable: new ReadableStream({ start() { } }),
        writable: new WritableStream({ write() { } }),
        open: async () => { },
        close: async () => { },
        getInfo: () => ({ usbVendorId: 0x0483, usbProductId: 0x0721 }),
      };
      return {
        port: mockPort as unknown as SerialPort,
        connection: null,
      };
    }

    // Electron 环境：使用原生串口
    if (isElectron()) {
      return this.requestElectronDevice();
    }

    // Web 环境：使用 Web Serial API
    return this.requestWebDevice();
  }

  /**
   * 使用指定的串口连接设备（Electron 环境专用）
   */
  async connectWithSelectedPort(selectedPort: import('@/services/SerialService').SerialPortInfo): Promise<DeviceInfo> {
    if (!isElectron()) {
      throw new Error('This method is only available in Electron environment');
    }

    try {
      console.log('Connecting with selected port:', selectedPort);

      // 打开串口连接
      const connection = await this.serialService.openPort(selectedPort.path, {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });

      return {
        port: null, // Electron 环境下不需要 Web Serial Port
        connection,
      };
    } catch (error) {
      console.error('Failed to connect to selected port:', error);
      throw error;
    }
  }

  /**
   * Electron 环境下的设备连接
   */
  private async requestElectronDevice(): Promise<DeviceInfo> {
    try {
      // 获取串口信息
      const portResult = await this.serialService.requestPort();

      if (!portResult) {
        throw new Error('No serial port selected');
      }

      // 如果需要用户选择（返回的是端口列表），抛出特殊错误让上层处理
      if (Array.isArray(portResult)) {
        throw new PortSelectionRequiredError(portResult);
      }

      console.log('Selected port:', portResult);

      // 打开串口连接
      const connection = await this.serialService.openPort(portResult.path, {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });

      return {
        port: null, // Electron 环境下不需要 Web Serial Port
        connection,
      };
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
   * Web 环境下的设备连接
   */
  private async requestWebDevice(): Promise<DeviceInfo> {
    try {
      const filters = [
        { usbVendorId: 0x0483, usbProductId: 0x0721 },
      ];

      if (!navigator.serial) {
        throw new Error('Web Serial API is not supported in this browser');
      }

      const port = await navigator.serial.requestPort({ filters });
      if (!port) {
        throw new Error('No serial port selected');
      }

      await port.open({
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: 'none',
      });

      return {
        port,
        connection: null,
      };
    } catch (error) {
      console.error('Failed to connect to Web device:', error);
      throw error;
    }
  }

  /**
   * 初始化串口状态（设置 DTR/RTS 信号）
   */
  async initializeDevice(device: DeviceInfo): Promise<void> {
    if (device.port) {
      // Web Serial API 环境
      await device.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await timeout(200);
      await device.port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } else if (device.connection) {
      // Electron 环境 - 使用统一的 setSignals 方法
      await device.connection.setSignals({ dataTerminalReady: false, requestToSend: false });
      await timeout(200);
      await device.connection.setSignals({ dataTerminalReady: true, requestToSend: true });
    }
  }

  /**
   * 断开设备连接
   */
  async disconnectDevice(device: DeviceInfo): Promise<void> {
    if (device.connection) {
      try {
        await device.connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      } finally {
        device.connection = null;
      }
    }

    if (device.port) {
      try {
        await device.port.close();
      } catch (error) {
        console.error('Error closing port:', error);
      } finally {
        device.port = null;
      }
    }
  }

  /**
   * 检查设备是否已连接
   */
  isDeviceConnected(device: DeviceInfo): boolean {
    return !!(device.connection ?? device.port);
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo(device: DeviceInfo): { type: string; [key: string]: unknown } | null {
    if (device.connection?.id) {
      return { type: 'native-serial', id: device.connection.id };
    }

    if (device.port) {
      return { type: 'web-serial', ...device.port.getInfo?.() };
    }

    return null;
  }
}

// 导出单例实例
export const deviceConnectionManager = DeviceConnectionManager.getInstance();
