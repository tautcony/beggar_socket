import { type SerialPortInfo, SerialService } from '@/services/serial-service';
import { DeviceInfo } from '@/types/device-info';
import { timeout } from '@/utils/async-utils';
import { isElectron } from '@/utils/electron';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilter } from '@/utils/port-filter';

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
  async requestDevice(filter?: PortFilter): Promise<DeviceInfo> {
    // Electron 环境：使用原生串口
    if (isElectron()) {
      return this.requestElectronDevice(filter);
    }

    // Web 环境：使用 Web Serial API
    return this.requestWebDevice(filter);
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

      // 打开串口连接
      const deviceInfo = await this.serialService.openPort(selectedPort.path, {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });

      return deviceInfo;
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
      const serialPortInfos = await this.serialService.listPorts(filter);

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
   * Web 环境下的设备连接
   */
  private async requestWebDevice(filter?: PortFilter): Promise<DeviceInfo> {
    try {
      const serialPortFilters = filter?.toWebSerialFilters ? filter?.toWebSerialFilters() : [];

      if (!navigator.serial) {
        throw new Error('Web Serial API is not supported in this browser');
      }

      const port = await navigator.serial.requestPort({ filters: serialPortFilters });
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
}

// 导出单例实例
export const deviceConnectionManager = DeviceConnectionManager.getInstance();
export { PortSelectionRequiredError };
