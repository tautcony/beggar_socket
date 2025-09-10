import { SerialConnection, SerialService } from '@/services/SerialService';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { type BYOBReader, type DefaultReader, type DeviceInfo } from '@/types';

const INIT_ERROR_MESSAGE = 'Serial port not properly initialized';

interface SerialPortOptions {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | undefined;
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
  xany?: boolean;
}

/**
 * 统一的串口操作适配器
 * 自动检测是否使用新的 SerialService 或传统的 Web Serial API
 */
export class ProtocolAdapter {
  private static get serialService() {
    return SerialService.getInstance();
  }

  /**
   * 发送数据包（兼容版本）
   */
  static async sendPackage(device: DeviceInfo, payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    // 优先使用新的连接对象
    if (device.connection) {
      return this.sendPackageViaConnection(device.connection, payload, timeoutMs);
    }

    // 回退到传统的 Web Serial API
    if (device.port) {
      return this.sendPackageViaWebSerial(device.port, payload, timeoutMs);
    }

    throw new Error(INIT_ERROR_MESSAGE);
  }

  /**
   * 通过 SerialConnection 发送数据
   */
  private static async sendPackageViaConnection(
    connection: SerialConnection,
    payload: Uint8Array,
    timeoutMs?: number,
  ): Promise<boolean> {
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    try {
      await Promise.race([
        connection.write(payload),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Send package timeout in ${timeout}ms`));
          }, timeout);
        }),
      ]);
      return true;
    } catch (error) {
      console.error('Failed to send package via connection:', error);
      throw error;
    }
  }

  /**
   * 通过传统 Web Serial API 发送数据
   */
  private static async sendPackageViaWebSerial(
    port: SerialPort,
    payload: Uint8Array,
    timeoutMs?: number,
  ): Promise<boolean> {
    const writer = port.writable?.getWriter();
    if (!writer) throw new Error(INIT_ERROR_MESSAGE);

    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const writePromise = writer.write(payload);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          writer.releaseLock();
          reject(new Error(`Send package timeout in ${timeout}ms`));
        }, timeout);
      });
      await Promise.race([writePromise, timeoutPromise]);
      return true;
    } finally {
      if (timer) clearTimeout(timer);
      try { writer.releaseLock(); } catch {}
    }
  }

  /**
   * 接收数据包（兼容版本）
   */
  static async getPackage(
    device: DeviceInfo,
    length: number,
    timeoutMs?: number,
    mode: 'byob' | 'default' = 'byob',
  ): Promise<{ data: Uint8Array }> {
    // 优先使用新的连接对象
    if (device.connection) {
      return this.getPackageViaConnection(device.connection, length, timeoutMs);
    }

    // 回退到传统的 Web Serial API
    if (device.port?.readable) {
      return this.getPackageViaWebSerial(device.port, length, timeoutMs, mode);
    }

    throw new Error(INIT_ERROR_MESSAGE);
  }

  /**
   * 通过 SerialConnection 接收数据
   */
  private static async getPackageViaConnection(
    connection: SerialConnection,
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined = undefined;

      const accumulatedData = new Uint8Array(length);
      let offset = 0;

      const handleData = (data: Uint8Array) => {
        const bytesToCopy = Math.min(data.byteLength, length - offset);
        accumulatedData.set(data.subarray(0, bytesToCopy), offset);
        offset += bytesToCopy;

        if (offset >= length) {
          clearTimeout(timer);
          connection.removeDataListener(handleData);
          resolve({ data: accumulatedData });
        }
      };

      timer = setTimeout(() => {
        connection.removeDataListener(handleData);
        reject(new Error(`Read package timeout in ${timeout}ms`));
      }, timeout);

      connection.onData(handleData);
    });
  }

  /**
   * 通过传统 Web Serial API 接收数据
   */
  private static async getPackageViaWebSerial(
    port: SerialPort,
    length: number,
    timeoutMs?: number,
    mode: 'byob' | 'default' = 'byob',
  ): Promise<{ data: Uint8Array }> {
    if (!port.readable) {
      throw new Error('Port readable stream is not available');
    }

    if (mode === 'byob') {
      const reader = port.readable.getReader({ mode: 'byob' });
      return this.getPackageWithBYOBReader(reader, length, timeoutMs);
    } else {
      const reader = port.readable.getReader();
      return this.getPackageWithDefaultReader(reader, length, timeoutMs);
    }
  }

  /**
   * 使用 DefaultReader 读取数据
   */
  private static async getPackageWithDefaultReader(
    reader: DefaultReader,
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    let offset = 0;
    const accumulatedData = new Uint8Array(length);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const readOperation = (async () => {
        while (offset < length) {
          const { value, done } = await reader.read();
          if (done || !value) {
            break;
          }
          const bytesToCopy = Math.min(value.byteLength, length - offset);
          accumulatedData.set(value.subarray(0, bytesToCopy), offset);
          offset += bytesToCopy;
        }
      })();

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reader.releaseLock();
          reject(new Error(`Read package timeout in ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([readOperation, timeoutPromise]);
      return { data: accumulatedData.slice(0, offset) };
    } catch (e) {
      if (offset === 0) {
        throw e;
      }
      return { data: accumulatedData.slice(0, offset) };
    } finally {
      if (timer) clearTimeout(timer);
      try { reader.releaseLock(); } catch {}
    }
  }

  /**
   * 使用 BYOBReader 读取数据
   */
  private static async getPackageWithBYOBReader(
    reader: BYOBReader,
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    let buffer = new Uint8Array(length);
    let offset = 0;
    const accumulatedData = new Uint8Array(length);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const readOperation = (async () => {
        while (offset < length) {
          const { value, done } = await reader.read(
            new Uint8Array(buffer as unknown as ArrayBufferLike, offset),
          );
          if (done) {
            break;
          }
          accumulatedData.set(value, offset);
          buffer = value.buffer as unknown as Uint8Array<ArrayBuffer>;
          offset += value.byteLength;
        }
      })();

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reader.releaseLock();
          reject(new Error(`Read package timeout in ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([readOperation, timeoutPromise]);
      return { data: new Uint8Array(buffer) };
    } catch (e) {
      if (offset === 0) {
        throw e;
      }
      return { data: accumulatedData.slice(0, offset) };
    } finally {
      if (timer) clearTimeout(timer);
      try { reader.releaseLock(); } catch {}
    }
  }

  /**
   * 获取单字节结果（兼容版本）
   */
  static async getResult(device: DeviceInfo, timeoutMs?: number): Promise<boolean> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    const result = await this.getPackage(device, 1, timeout);
    return result.data?.byteLength > 0 && result.data[0] === 0xaa;
  }

  /**
   * 设置串口信号（兼容版本）
   */
  static async setSignals(device: DeviceInfo, signals: SerialOutputSignals): Promise<void> {
    if (device.connection) {
      // 使用新的统一接口设置信号
      await device.connection.setSignals(signals);
      return;
    }

    if (device.port) {
      await device.port.setSignals(signals);
    } else {
      throw new Error(INIT_ERROR_MESSAGE);
    }
  }

  /**
   * 从串口路径创建设备连接（新方法）
   */
  static async createDeviceFromPort(portPath: string, options?: SerialPortOptions): Promise<DeviceInfo> {
    try {
      const connection = await this.serialService.openPort(portPath, options);
      return {
        port: null, // 当使用新服务时，port 可以为 null
        connection,
      };
    } catch (error) {
      console.error('Failed to create device from port:', error);
      throw error;
    }
  }

  /**
   * 从 Web Serial Port 创建设备连接（兼容方法）
   */
  static createDeviceFromWebSerial(port: SerialPort): DeviceInfo {
    return {
      port,
      connection: null,
    };
  }

  /**
   * 关闭设备连接（兼容版本）
   */
  static async closeDevice(device: DeviceInfo): Promise<void> {
    if (device.connection) {
      await device.connection.close();
      device.connection = null;
    }

    if (device.port) {
      await device.port.close();
      device.port = null;
    }
  }

  /**
   * 检查设备是否已连接
   */
  static isDeviceConnected(device: DeviceInfo): boolean {
    return !!(device.connection ?? device.port);
  }

  /**
   * 获取设备信息
   */
  static getDeviceInfo(device: DeviceInfo): { type: string; [key: string]: unknown } | null {
    if (device.connection) {
      return { type: 'native-serial', id: device.connection.id };
    }

    if (device.port) {
      return { type: 'web-serial', ...device.port.getInfo?.() };
    }

    return null;
  }
}
