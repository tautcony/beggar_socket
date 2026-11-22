import { createConnectionOrchestrationUseCase } from '@/features/burner/adapters';
import type {
  BurnerConnectionHandle,
  BurnerConnectionSelection,
  ConnectionFailure,
  ConnectionOperationResult,
  ConnectionOperationToken,
} from '@/features/burner/application';
import { isTauriRuntime } from '@/platform/runtime';
import type { DeviceHandle } from '@/platform/serial';
import {
  boost_probe,
  boost_reset_to_default,
  type FlashgbxFirmwareInfo,
  performFlashgbxDisconnect,
  performFlashgbxHandshake,
} from '@/protocol';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { DeviceInfo } from '@/types/device-info';
import {
  attachFirmwareProfile,
  type FirmwareProfile,
  FLASHGBX_FIRMWARE_PROFILE,
  getFirmwareProfileById,
  inferFirmwareProfileFromPort,
  withBeggarBoostProfile,
} from '@/types/firmware-profile';
import type { SerialPortInfo } from '@/types/serial';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { type PortFilter, PortFilters } from '@/utils/port-filter';

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

  private toDeviceInfo(handle: BurnerConnectionHandle, generation?: number): DeviceInfo {
    const ctx = handle.context;
    if (!this.isDeviceHandle(ctx)) {
      throw new Error('Invalid connection handle: context is not a valid DeviceHandle');
    }
    const resolvedProfile = getFirmwareProfileById(AdvancedSettings.firmwareProfile);
    ctx.firmwareProfile = resolvedProfile;
    return attachFirmwareProfile({
      port: ctx.port,
      connection: null,
      transport: ctx.transport,
      serialHandle: ctx,
      portInfo: ctx.portInfo,
      firmwareProfile: resolvedProfile,
      connectionGeneration: generation,
      connectionId: handle.id,
    }, resolvedProfile);
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

  private logFirmwareProfile(device: DeviceInfo, source: string): void {
    const profile = device.firmwareProfile;
    const inferredProfile = inferFirmwareProfileFromPort(device.portInfo);
    console.info('[DeviceConnectionManager] firmware profile detected', {
      source,
      profile: profile?.id ?? 'unknown',
      label: profile?.label ?? 'Unknown',
      configuredProfile: AdvancedSettings.firmwareProfile,
      inferredProfile: inferredProfile.id,
      inferredLabel: inferredProfile.label,
      capabilities: profile?.capabilities,
      port: device.portInfo
        ? {
          path: device.portInfo.path,
          vendorId: device.portInfo.vendorId,
          productId: device.portInfo.productId,
          manufacturer: device.portInfo.manufacturer,
          product: device.portInfo.product,
          serialNumber: device.portInfo.serialNumber,
        }
        : null,
    });
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
      isTauri: isTauriRuntime(),
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
    const isFlashgbx = AdvancedSettings.firmwareProfile === 'flashgbx';
    const effectiveFilter = _filter ?? (isFlashgbx ? PortFilters.presets.flashgbx() : undefined);

    if (isTauriRuntime() && effectiveFilter) {
      const availablePorts = await this.listAvailablePorts(effectiveFilter);
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

    const initialBaudRate = isFlashgbx ? this.resolveInitialFlashgbxBaudRate() : undefined;
    const result = await this.connectionUseCase.prepareConnection({
      filter: effectiveFilter,
      ...(isFlashgbx ? { baudRate: initialBaudRate, skipSignalInit: true } : {}),
    });
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
    if (effectiveFilter && selectedPortInfo && !effectiveFilter(selectedPortInfo)) {
      console.warn('[DeviceConnectionManager] selected port rejected by filter', this.describePort(selectedPortInfo));
      await this.connectionUseCase.disconnect();
      throw this.asError({
        stage: 'select',
        code: 'select_failed',
        message: 'Selected device does not match requested filter',
      });
    }

    const device = this.toDeviceInfo(result.context.handle, result.context.generation);
    if (isFlashgbx) {
      await this.initializeFlashgbxConnection(device, initialBaudRate ?? 2_000_000);
    } else {
      await this.detectBoostCapabilities(device);
    }
    this.logFirmwareProfile(device, 'requestDevice');
    return device;
  }

  /**
   * 使用指定的串口连接设备
   */
  async connectWithSelectedPort(selectedPort: SerialPortInfo): Promise<DeviceInfo> {
    if (!isTauriRuntime()) {
      throw new Error('This method is only available in Tauri environment');
    }

    const isFlashgbx = AdvancedSettings.firmwareProfile === 'flashgbx';
    const initialBaudRate = isFlashgbx ? this.resolveInitialFlashgbxBaudRate(selectedPort) : undefined;

    try {
      console.info('[DeviceConnectionManager] connectWithSelectedPort', this.describePort(selectedPort));

      const selection: BurnerConnectionSelection = {
        portInfo: selectedPort,
        context: isFlashgbx
          ? { portInfo: selectedPort, baudRate: initialBaudRate, skipSignalInit: true }
          : { portInfo: selectedPort },
      };

      const result = await this.connectionUseCase.reconnectWithSelection(selection);
      if (!result.success || !result.context.handle) {
        console.error('[DeviceConnectionManager] reconnectWithSelection failed', {
          selectedPort: this.describePort(selectedPort),
          failure: result.failure,
        });
        throw this.asError(result.failure ?? {
          stage: 'connect',
          code: 'connect_failed',
          message: 'Failed to connect to selected port',
        });
      }

      const device = this.withPortInfo(
        this.toDeviceInfo(result.context.handle, result.context.generation),
        selectedPort,
      );
      if (isFlashgbx) {
        await this.initializeFlashgbxConnection(device, initialBaudRate ?? 2_000_000);
      } else {
        await this.detectBoostCapabilities(device);
      }
      this.logFirmwareProfile(device, 'connectWithSelectedPort');
      return device;
    } catch (error) {
      console.error('[DeviceConnectionManager] failed to connect to selected port', {
        selectedPort: this.describePort(selectedPort),
        error,
      });
      throw error;
    }
  }

  get isOperationBusy(): boolean {
    return this.connectionUseCase.operationCoordinator.isBusy;
  }

  subscribeOperationBusy(listener: (busy: boolean) => void): () => void {
    return this.connectionUseCase.operationCoordinator.subscribe(listener);
  }

  async runConnectionOperation<T>(options: {
    token?: ConnectionOperationToken;
    expectedGeneration?: number;
    requireConnected?: boolean;
    fn: (token: ConnectionOperationToken) => Promise<T>;
  }): Promise<ConnectionOperationResult<T>> {
    return this.connectionUseCase.operationCoordinator.runExclusive({
      token: options.token,
      expectedGeneration: options.expectedGeneration,
      currentGeneration: () => this.connectionUseCase.snapshot.context.generation,
      isConnected: options.requireConnected === false
        ? undefined
        : () => {
          const snapshot = this.connectionUseCase.snapshot;
          return snapshot.state === 'connected' && Boolean(snapshot.context.handle);
        },
      fn: options.fn,
    });
  }

  /**
   * 初始化串口状态（设置 DTR/RTS 信号）
   */
  async initializeDevice(device: DeviceInfo): Promise<void> {
    const opResult = await this.runConnectionOperation({
      requireConnected: false,
      fn: async () => {
        const ensureResult = await this.connectionUseCase.reinitializeConnection();
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

        const latestDevice = this.toDeviceInfo(ensureResult.context.handle, ensureResult.context.generation);
        device.connection = latestDevice.connection;
        device.port = latestDevice.port;
        device.transport = latestDevice.transport;
        device.serialHandle = latestDevice.serialHandle;
        device.portInfo = latestDevice.portInfo;
        device.firmwareProfile = latestDevice.firmwareProfile;
        device.connectionGeneration = latestDevice.connectionGeneration;
        device.connectionId = latestDevice.connectionId;
        await this.detectBoostCapabilities(device);
      },
    });

    if (!opResult.ok) {
      if (opResult.reason === 'busy') {
        throw Object.assign(new Error(opResult.message), { code: 'busy' });
      }
      throw opResult.error instanceof Error ? opResult.error : new Error(opResult.message);
    }
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
    const opResult = await this.runConnectionOperation({
      requireConnected: false,
      fn: async () => {
        try {
          if (device.firmwareProfile?.id === 'flashgbx' && device.transport) {
            await performFlashgbxDisconnect(device.transport, device.flashgbxInfo);
          }
          const result = await this.connectionUseCase.disconnect();
          if (!result.success) {
            throw this.asError(result.failure ?? {
              stage: 'disconnect',
              code: 'disconnect_failed',
              message: 'Failed to disconnect device',
            });
          }
        } finally {
          device.connection = null;
          device.port = null;
          device.transport = null;
          device.serialHandle = null;
          device.flashgbxInfo = undefined;
          device.connectionGeneration = undefined;
          device.connectionId = undefined;
        }
      },
    });

    if (!opResult.ok) {
      if (opResult.reason === 'busy') {
        throw Object.assign(new Error(opResult.message), { code: 'busy' });
      }
      throw opResult.error instanceof Error ? opResult.error : new Error(opResult.message);
    }
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

  private withPortInfo(device: DeviceInfo, portInfo?: SerialPortInfo): DeviceInfo {
    if (device.serialHandle) {
      device.serialHandle.portInfo = portInfo;
    }
    device.portInfo = portInfo;
    return device;
  }

  /**
   * 当设备配置为丐中丐 (stm) 且启用了 Boost 增强选项时，
   * 探测固件是否支持 Boost 扩展指令，识别到则附加增强能力并复位回默认协议。
   */
  private async detectBoostCapabilities(device: DeviceInfo): Promise<void> {
    if (
      device.firmwareProfile?.id !== 'stm'
      || !AdvancedSettings.stmBoost
      || device.serialHandle?.platform === 'simulated'
      || !device.transport
    ) {
      return;
    }

    try {
      const probe = await boost_probe(device.transport, 250);
      if (probe.supported) {
        // 识别到 Boost 固件后保持在 Boost 模式中，避免无意义的模式切换开销
        attachFirmwareProfile(
          device,
          withBeggarBoostProfile(device.firmwareProfile, probe.banner),
        );
      } else {
        await boost_reset_to_default(device.transport);
      }
    } catch (error) {
      console.debug('[DeviceConnectionManager] Beggar Boost probe skipped:', error);
    }
  }

  private resolveInitialFlashgbxBaudRate(_portInfo?: SerialPortInfo | null): number {
    const configured = AdvancedSettings.flashgbxBaudRate;
    if (configured !== 'auto') {
      return configured;
    }
    return 2_000_000;
  }

  private buildFlashgbxRuntimeProfile(info: FlashgbxFirmwareInfo): FirmwareProfile {
    return {
      ...FLASHGBX_FIRMWARE_PROFILE,
      label: info.pcbName,
      firmwareVersion: `${info.cfwId}${info.fwVer}`,
      capabilities: {
        ...FLASHGBX_FIRMWARE_PROFILE.capabilities,
        nativeFlashgbxProtocol: true,
        cartPowerControl: info.cartPowerCtrl,
        audioWePin: info.audioWePin,
      },
    };
  }

  private async initializeFlashgbxConnection(device: DeviceInfo, initialBaudRate: number): Promise<void> {
    if (!device.transport) {
      throw new Error('Device transport is not initialized');
    }

    let fwInfo: FlashgbxFirmwareInfo;
    try {
      fwInfo = await performFlashgbxHandshake(device.transport, {
        portInfo: device.portInfo,
        baudRate: initialBaudRate,
      });
    } catch (error) {
      try {
        await device.transport.flushInput?.();
        await device.transport.flushOutput?.();
      } catch {
        // Ignore cleanup errors before closing
      }
      await this.connectionUseCase.disconnect().catch(() => undefined);
      throw error;
    }

    const runtimeProfile = this.buildFlashgbxRuntimeProfile(fwInfo);
    device.flashgbxInfo = fwInfo;
    attachFirmwareProfile(device, runtimeProfile);
    if (device.serialHandle) {
      device.serialHandle.firmwareProfile = runtimeProfile;
    }
  }
}

export { PortSelectionRequiredError };
