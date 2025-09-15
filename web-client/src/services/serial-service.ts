/**
 * 统一的串口服务，自动适配 Web Serial API 和 Electron 原生串口
 */
import { DeviceInfo } from '@/types';
import { isElectron } from '@/utils/electron';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface SerialConnection {
  id: string;
  isOpen: boolean;
  write: (data: Uint8Array | number[]) => Promise<void>;
  close: () => Promise<void>;
  setSignals: (signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) => Promise<void>;
  onData: (callback: (data: Uint8Array) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onClose: (callback: () => void) => void;
  removeDataListener: (callback: (data: Uint8Array) => void) => void;
  removeErrorListener: (callback: (error: string) => void) => void;
  removeCloseListener: (callback: () => void) => void;
}

export class SerialService {
  private static instance: SerialService;
  private connections = new Map<string, SerialConnection>();
  private dataListeners = new Map<string, (data: Uint8Array) => void>();
  private errorListeners = new Map<string, (error: string) => void>();
  private closeListeners = new Map<string, () => void>();

  private constructor() {
    // 如果是 Electron 环境，设置监听器
    if (isElectron()) {
      this.setupElectronListeners();
    }
  }

  static getInstance(): SerialService {
    if (!SerialService.instance) {
      SerialService.instance = new SerialService();
    }
    return SerialService.instance;
  }

  /**
   * 列出可用的串口
   */
  async listPorts(filter?: (port: SerialPortInfo) => boolean): Promise<SerialPortInfo[]> {
    if (isElectron()) {
      try {
        const ports = await window.electronAPI.serial.listPorts();
        return filter ? ports.filter(filter) : ports;
      } catch (error) {
        console.error('Failed to list ports in Electron:', error);
        throw error;
      }
    } else {
      // Web Serial API 不支持列出端口，需要用户手动选择
      throw new Error('Web Serial API does not support listing ports. Use requestPort() instead.');
    }
  }

  /**
   * 获取串口选择信息（包含是否需要用户选择的状态）
   */
  async getPortSelectionInfo(filter?: (port: SerialPortInfo) => boolean): Promise<{ ports: SerialPortInfo[]; needsSelection: boolean } | null> {
    if (isElectron()) {
      try {
        const result = await window.electronAPI.selectSerialPort();
        if (!result) return null;

        // 如果提供了过滤器，应用过滤
        const filteredPorts = filter ? result.ports.filter(filter) : result.ports;

        console.log(result, filteredPorts);

        return {
          ports: filteredPorts,
          needsSelection: filteredPorts.length > 1,
        };
      } catch (error) {
        console.error('Failed to get port selection info:', error);
        return null;
      }
    } else {
      // Web Serial API 总是需要用户选择
      return { ports: [], needsSelection: true };
    }
  }

  /**
   * 打开串口连接
   */
  async openPort(portPath: string, options: SerialOptions): Promise<DeviceInfo> {
    if (isElectron()) {
      return {
        port: null,
        connection: await this.openElectronPort(portPath, options),
      };
    }
    return {
      port: await this.openWebPort(options),
      connection: null,
    };
  }

  /**
   * Electron 环境下打开串口
   */
  private async openElectronPort(portPath: string, options: SerialOptions): Promise<SerialConnection> {
    try {
      // 只传递可序列化的选项
      const serializedOptions = {
        baudRate: options.baudRate ?? 9600,
        dataBits: options.dataBits ?? 8,
        stopBits: options.stopBits ?? 1,
        parity: options.parity ?? 'none',
      };

      const portId = await window.electronAPI.serial.open(portPath, serializedOptions);

      const connection: SerialConnection = {
        id: portId,
        isOpen: true,
        write: async (data: Uint8Array | number[]) => {
          const dataArray = data instanceof Uint8Array ? Array.from(data) : data;
          await window.electronAPI.serial.write(portId, dataArray);
        },
        close: async () => {
          await window.electronAPI.serial.close(portId);
          this.connections.delete(portId);
          this.dataListeners.delete(portId);
          this.errorListeners.delete(portId);
          this.closeListeners.delete(portId);
        },
        setSignals: async (signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) => {
          await window.electronAPI.serial.setSignals(portId, signals);
        },
        onData: (callback: (data: Uint8Array) => void) => {
          this.dataListeners.set(portId, callback);
        },
        onError: (callback: (error: string) => void) => {
          this.errorListeners.set(portId, callback);
        },
        onClose: (callback: () => void) => {
          this.closeListeners.set(portId, callback);
        },
        removeDataListener: (_callback: (data: Uint8Array) => void) => {
          this.dataListeners.delete(portId);
        },
        removeErrorListener: (_callback: (error: string) => void) => {
          this.errorListeners.delete(portId);
        },
        removeCloseListener: (_callback: () => void) => {
          this.closeListeners.delete(portId);
        },
      };

      this.connections.set(portId, connection);
      return connection;
    } catch (error) {
      console.error('Failed to open Electron serial port:', error);
      throw error;
    }
  }

  /**
   * Web 环境下打开串口
   */
  private async openWebPort(options: SerialOptions): Promise<SerialPort> {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported');
      }

      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: options.baudRate ?? 9600,
        dataBits: options.dataBits ?? 8,
        stopBits: options.stopBits ?? 1,
        parity: options.parity ?? 'none',
      });

      return port;
    } catch (error) {
      console.error('Failed to open web serial port:', error);
      throw error;
    }
  }

  /**
   * 设置 Electron 监听器
   */
  private setupElectronListeners() {
    window.electronAPI.serial.onData((portId: string, data: Uint8Array) => {
      this.triggerDataListener(portId, data);
    });

    window.electronAPI.serial.onError((portId: string, error: string) => {
      this.triggerErrorListener(portId, error);
    });

    window.electronAPI.serial.onClose((portId: string) => {
      this.connections.delete(portId);
      this.triggerCloseListener(portId);
    });
  }

  /**
   * Web Serial 数据读取
   */
  private async startWebReading(portId: string, reader: ReadableStreamDefaultReader<Uint8Array>) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        this.triggerDataListener(portId, value);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.triggerErrorListener(portId, error.message);
      }
    }
  }

  /**
   * 设置数据监听器
   */
  onData(portId: string, callback: (data: Uint8Array) => void) {
    this.dataListeners.set(portId, callback);
  }

  /**
   * 设置错误监听器
   */
  onError(portId: string, callback: (error: string) => void) {
    this.errorListeners.set(portId, callback);
  }

  /**
   * 设置关闭监听器
   */
  onClose(portId: string, callback: () => void) {
    this.closeListeners.set(portId, callback);
  }

  /**
   * 移除监听器
   */
  removeListeners(portId: string) {
    if (!portId) {
      console.warn('removeListeners called with invalid portId:', portId);
      return;
    }

    this.dataListeners.delete(portId);
    this.errorListeners.delete(portId);
    this.closeListeners.delete(portId);
  }

  /**
   * 触发数据监听器
   */
  private triggerDataListener(portId: string, data: Uint8Array) {
    const listener = this.dataListeners.get(portId);
    if (listener) {
      listener(data);
    }
  }

  /**
   * 触发错误监听器
   */
  private triggerErrorListener(portId: string, error: string) {
    const listener = this.errorListeners.get(portId);
    if (listener) {
      listener(error);
    }
  }

  /**
   * 触发关闭监听器
   */
  private triggerCloseListener(portId: string) {
    const listener = this.closeListeners.get(portId);
    if (listener) {
      listener();
    }
  }

  /**
   * 获取连接
   */
  getConnection(portId: string): SerialConnection | undefined {
    return this.connections.get(portId);
  }

  /**
   * 关闭所有连接
   */
  async closeAllConnections() {
    const promises = Array.from(this.connections.values()).map(conn => conn.close());
    await Promise.all(promises);
    this.connections.clear();
    this.dataListeners.clear();
    this.errorListeners.clear();
    this.closeListeners.clear();
  }
}

// 导出单例实例
export const serialService = SerialService.getInstance();
