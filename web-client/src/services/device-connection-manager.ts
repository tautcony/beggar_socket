import { createConnectionOrchestrationUseCase } from '@/features/burner/adapters';
import type { BurnerConnectionHandle, BurnerConnectionSelection, ConnectionFailure } from '@/features/burner/application';
import { type DeviceHandle, toLegacyDeviceInfo, withPortInfo } from '@/platform/serial';
import { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilter } from '@/utils/port-filter';
import { isTauri } from '@/utils/tauri';

/**
 * 设备连接管理器
 * 统一处理 Web Serial API 和 Tauri 原生串口的设备连接
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

  private describePort(portInfo?: SerialPortInfo | null): string {
    if (!portInfo?.path) {
      return 'unknown-port';
    }

    const details = [
      portInfo.vendorId && portInfo.productId ? `${portInfo.vendorId}:${portInfo.productId}` : null,
      portInfo.manufacturer ?? null,
      portInfo.product ?? null,
    ].filter(Boolean);

    return details.length > 0
      ? `${portInfo.path} (${details.join(', ')})`
      : portInfo.path;
  }

  private summarizeCause(cause: unknown): string | null {
    if (cause instanceof Error) {
      return cause.message;
    }
    if (typeof cause === 'string') {
      return cause;
    }
    if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
      return cause.message;
    }
    return null;
  }

  private asError(failure: ConnectionFailure): Error {
    const causeMessage = this.summarizeCause(failure.cause);
    const message = causeMessage && causeMessage !== failure.message
      ? `[${failure.stage}/${failure.code}] ${failure.message}: ${causeMessage}`
      : `[${failure.stage}/${failure.code}] ${failure.message}`;
    const error = new Error(message);
    Object.assign(error, { failure });
    return error;
  }

  private isDeviceHandle(context: unknown): context is DeviceHandle {
    return Boolean(
      context
      && typeof context === 'object'
      && 'platform' in context
      && 'transport' in context,
    );
  }

  private toDeviceInfo(handle: BurnerConnectionHandle): DeviceInfo {
    const ctx = handle.context;
    if (!this.isDeviceHandle(ctx)) {
      throw new Error('Invalid connection handle: context is not a valid DeviceHandle');
    }
    return toLegacyDeviceInfo(ctx);
  }

  private asSerialPortInfo(portInfo: BurnerConnectionHandle['portInfo']): SerialPortInfo | null {
    if (!portInfo?.path) {
      return null;
    }

    return {
      path: portInfo.path,
      manufacturer: portInfo.manufacturer,
      product: portInfo.product,
      vendorId: portInfo.vendorId,
      productId: portInfo.productId,
    };
  }

  /**
   * 请求串口设备连接
   */
  async requestDevice(_filter?: PortFilter): Promise<DeviceInfo> {
    if (this.isConnecting) {
      throw new Error('Device connection already in progress');
    }
    this.isConnecting = true;
    console.info('[DeviceConnectionManager] requestDevice start', {
      isTauri: isTauri(),
      hasFilter: Boolean(_filter),
      filterConfig: _filter?.config,
    });
    try {
      return await this._requestDevice(_filter);
    } finally {
      this.isConnecting = false;
    }
  }

  private async _requestDevice(_filter?: PortFilter): Promise<DeviceInfo> {
    if (isTauri() && _filter) {
      const availablePorts = await this.listAvailablePorts(_filter);
      console.info('[DeviceConnectionManager] filtered Tauri ports', availablePorts.map(port => this.describePort(port)));
      if (availablePorts.length === 1) {
        return this.connectWithSelectedPort(availablePorts[0]);
      }

      const fallbackPorts = availablePorts.length === 0
        ? await this.listAvailablePorts()
        : availablePorts;
      console.warn('[DeviceConnectionManager] user port selection required', fallbackPorts.map(port => this.describePort(port)));

      throw new PortSelectionRequiredError(fallbackPorts);
    }

    const result = await this.connectionUseCase.prepareConnection();
    if (!result.success || !result.context.handle) {
      if (result.failure?.code === 'selection_required') {
        const ports = await this.listAvailablePorts();
        console.warn('[DeviceConnectionManager] selection required after prepareConnection', ports.map(port => this.describePort(port)));
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
      console.warn('[DeviceConnectionManager] selected port rejected by filter', this.describePort(selectedPortInfo));
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
    if (!isTauri()) {
      throw new Error('This method is only available in Tauri environment');
    }

    try {
      console.info('[DeviceConnectionManager] connectWithSelectedPort', this.describePort(selectedPort));
      await this.connectionUseCase.disconnect();

      const selection: BurnerConnectionSelection = {
        portInfo: selectedPort,
        context: { portInfo: selectedPort },
      };

      const result = await this.connectionUseCase.prepareConnectionWithSelection(selection);
      if (!result.success || !result.context.handle) {
        console.error('[DeviceConnectionManager] prepareConnectionWithSelection failed', {
          selectedPort: this.describePort(selectedPort),
          failure: result.failure,
        });
        throw this.asError(result.failure ?? {
          stage: 'connect',
          code: 'connect_failed',
          message: 'Failed to connect to selected port',
        });
      }

      return withPortInfo(this.toDeviceInfo(result.context.handle), selectedPort);
    } catch (error) {
      console.error('[DeviceConnectionManager] failed to connect to selected port', {
        selectedPort: this.describePort(selectedPort),
        error,
      });
      throw error;
    }
  }

  /**
   * 初始化串口状态（设置 DTR/RTS 信号）
   */
  async initializeDevice(device: DeviceInfo): Promise<void> {
    const ensureResult = await this.connectionUseCase.ensureConnected();
    if (!ensureResult.success || !ensureResult.context.handle) {
      console.error('[DeviceConnectionManager] initializeDevice failed', {
        device: this.describePort(device.portInfo),
        failure: ensureResult.failure,
      });
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
    const filteredPorts = filter ? ports.filter(filter) : ports;
    console.info('[DeviceConnectionManager] listAvailablePorts', {
      total: ports.length,
      filtered: filteredPorts.length,
      filterConfig: filter?.config,
      ports: filteredPorts.map(port => this.describePort(port)),
    });
    return filteredPorts;
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
