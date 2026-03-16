import { createConnectionOrchestrationUseCase } from '@/features/burner/adapters';
import type { BurnerConnectionHandle, BurnerConnectionSelection, ConnectionFailure } from '@/features/burner/application';
import { type DeviceHandle, toLegacyDeviceInfo, withPortInfo } from '@/platform/serial';
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
  private readonly connectionUseCase = createConnectionOrchestrationUseCase();
  private isConnecting = false;

  private constructor() {}

  static getInstance(): DeviceConnectionManager {
    if (!DeviceConnectionManager.instance) {
      DeviceConnectionManager.instance = new DeviceConnectionManager();
    }
    return DeviceConnectionManager.instance;
  }

  private asError(failure: ConnectionFailure): Error {
    const message = `[${failure.stage}/${failure.code}] ${failure.message}`;
    return new Error(message);
  }

  private toDeviceInfo(handle: BurnerConnectionHandle): DeviceInfo {
    const ctx = handle.context;
    if (!ctx || typeof ctx !== 'object' || !('platform' in ctx) || !('transport' in ctx)) {
      throw new Error('Invalid connection handle: context is not a valid DeviceHandle');
    }
    return toLegacyDeviceInfo(ctx as DeviceHandle);
  }

  private asSerialPortInfo(portInfo: BurnerConnectionHandle['portInfo']): SerialPortInfo | null {
    if (!portInfo?.path) {
      return null;
    }

    return {
      path: portInfo.path,
      vendorId: portInfo.vendorId,
      productId: portInfo.productId,
    };
  }

  /**
   * 请求串口设备连接
   */
  async requestDevice(_filter?: PortFilter): Promise<DeviceInfo> {
    // 调试模式：返回模拟设备
    if (DebugSettings.debugMode) {
      console.log('[DEBUG] 调试模式启用，返回模拟设备');
      return DebugSettings.createMockDeviceInfo();
    }

    if (this.isConnecting) {
      throw new Error('Device connection already in progress');
    }
    this.isConnecting = true;
    try {
      return await this._requestDevice(_filter);
    } finally {
      this.isConnecting = false;
    }
  }

  private async _requestDevice(_filter?: PortFilter): Promise<DeviceInfo> {
    if (isElectron() && _filter) {
      const availablePorts = await this.listAvailablePorts(_filter);
      if (availablePorts.length !== 1) {
        throw new PortSelectionRequiredError(availablePorts);
      }
      return this.connectWithSelectedPort(availablePorts[0]);
    }

    const result = await this.connectionUseCase.prepareConnection();
    if (!result.success || !result.context.handle) {
      if (result.failure?.code === 'selection_required') {
        const ports = await this.listAvailablePorts();
        throw new PortSelectionRequiredError(ports);
      }
      throw this.asError(result.failure ?? {
        stage: 'unknown',
        code: 'unknown',
        message: 'Device connection failed',
      });
    }

    const selectedPortInfo = this.asSerialPortInfo(result.context.handle.portInfo);
    if (_filter && selectedPortInfo && !_filter(selectedPortInfo)) {
      await this.connectionUseCase.disconnect();
      throw this.asError({
        stage: 'select',
        code: 'select_failed',
        message: 'Selected device does not match requested filter',
      });
    }

    return this.toDeviceInfo(result.context.handle);
  }

  /**
   * 使用指定的串口连接设备
   */
  async connectWithSelectedPort(selectedPort: SerialPortInfo): Promise<DeviceInfo> {
    if (!isElectron()) {
      throw new Error('This method is only available in Electron environment');
    }

    try {
      await this.connectionUseCase.disconnect();

      const selection: BurnerConnectionSelection = {
        portInfo: selectedPort,
        context: { portInfo: selectedPort },
      };

      const result = await this.connectionUseCase.prepareConnectionWithSelection(selection);
      if (!result.success || !result.context.handle) {
        throw this.asError(result.failure ?? {
          stage: 'connect',
          code: 'connect_failed',
          message: 'Failed to connect to selected port',
        });
      }

      return withPortInfo(this.toDeviceInfo(result.context.handle), selectedPort);
    } catch (error) {
      console.error('Failed to connect to selected port:', error);
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

    const ensureResult = await this.connectionUseCase.ensureConnected();
    if (!ensureResult.success || !ensureResult.context.handle) {
      throw this.asError(ensureResult.failure ?? {
        stage: 'init',
        code: 'init_failed',
        message: 'Failed to initialize device',
      });
    }

    const latestDevice = this.toDeviceInfo(ensureResult.context.handle);
    device.connection = latestDevice.connection;
    device.port = latestDevice.port;
    device.transport = latestDevice.transport;
    device.serialHandle = latestDevice.serialHandle;
    device.portInfo = latestDevice.portInfo;
  }

  async listAvailablePorts(filter?: PortFilter): Promise<SerialPortInfo[]> {
    const result = await this.connectionUseCase.listAvailableSelections();
    if (!result.success) {
      throw this.asError(result.failure ?? {
        stage: 'list',
        code: 'list_failed',
        message: 'Failed to list ports',
      });
    }

    const ports = (result.ports ?? [])
      .map(port => port?.portInfo)
      .filter((port): port is SerialPortInfo => Boolean(port?.path));
    return filter ? ports.filter(filter) : ports;
  }

  /**
   * 断开设备连接
   */
  async disconnectDevice(device: DeviceInfo): Promise<void> {
    const result = await this.connectionUseCase.disconnect();
    if (!result.success) {
      throw this.asError(result.failure ?? {
        stage: 'disconnect',
        code: 'disconnect_failed',
        message: 'Failed to disconnect device',
      });
    }

    device.connection = null;
    device.port = null;
    device.transport = null;
    device.serialHandle = null;
  }

  /**
   * 检查设备是否已连接
   */
  isDeviceConnected(device: DeviceInfo): boolean {
    return !!(device.transport ?? device.connection ?? device.port);
  }

  getConnectionSnapshot() {
    return this.connectionUseCase.snapshot;
  }
}

// 导出单例实例
export const deviceConnectionManager = DeviceConnectionManager.getInstance();
export { PortSelectionRequiredError };
