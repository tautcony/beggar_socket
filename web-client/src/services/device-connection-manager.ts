import { firmwareProfileFromSession } from '@/device/compat/firmware-profile';
import type { DeviceDiagnostic, SessionProfile } from '@/device/session';
import type { ResolvedVariantSelection } from '@/device/types';
import { createConnectionOrchestrationUseCase } from '@/features/burner/adapters';
import type {
  BurnerConnectionHandle,
  BurnerConnectionSelection,
  ConnectionFailure,
  ConnectionOperationResult,
  ConnectionOperationToken,
  ConnectionOrchestrationUseCase,
} from '@/features/burner/application';
import { getDeviceRuntime, type DeviceRuntime } from '@/device-runtime/runtime-instance';
import { resolveConnectionBaudRate } from '@/device-runtime/session-resolver';
import type { FlashgbxFirmwareInfo } from '@/protocol';
import { isTauriRuntime } from '@/platform/runtime';
import type { DeviceHandle } from '@/platform/serial';
import { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { type PortFilter, PortFilters } from '@/utils/port-filter';

export interface DeviceConnectOptions {
  /**
   * Manual entry: offer every port the host exposes (no discovery filter). Automatic
   * discovery never opens a `mismatch` port; only this explicit choice may.
   */
  readonly allowAnyPort?: boolean;
}

/** Raised when the saved device/firmware selection cannot be resolved. */
export class DeviceSelectionError extends Error {
  readonly stage = 'select' as const;
  readonly code = 'selection_invalid' as const;

  constructor(message: string) {
    super(message);
    this.name = 'DeviceSelectionError';
  }
}

/**
 * Narrows the opaque probe facts of a committed session onto the legacy
 * `DeviceInfo.flashgbxInfo` facade.
 *
 * `EstablishedSession.probeFacts` is intentionally untyped: each runtime binding closes
 * its own facts type. The FlashGBX binding publishes `{ firmwareInfo }`, and the legacy
 * facade (FlashGBX command client) needs the bare handshake result.
 */
function flashgbxInfoFromProbeFacts(probeFacts: unknown): FlashgbxFirmwareInfo | undefined {
  if (!probeFacts || typeof probeFacts !== 'object') {
    return undefined;
  }
  const info = (probeFacts as { firmwareInfo?: FlashgbxFirmwareInfo | null }).firmwareInfo;
  return info ?? undefined;
}

/**
 * 设备连接管理器
 *
 * 连接配置由高级设置（core `SelectionProvider`）+ 注册表决定：串口枚举只影响候选顺序
 * 与诊断，不改变协议。所有连接入口（首次、指定端口、重连）都走同一条连接事务，协议
 * 握手与初始化在事务内完成。
 */
export class DeviceConnectionManager {
  private static instance: DeviceConnectionManager;
  private readonly runtime: DeviceRuntime;
  private readonly connectionUseCase: ConnectionOrchestrationUseCase;
  private isConnecting = false;

  private constructor(runtime: DeviceRuntime) {
    this.runtime = runtime;
    this.connectionUseCase = createConnectionOrchestrationUseCase(runtime);
  }

  static getInstance(): DeviceConnectionManager {
    if (!DeviceConnectionManager.instance) {
      DeviceConnectionManager.instance = new DeviceConnectionManager(getDeviceRuntime());
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

  /** Reads the saved selection and resolves it; never guesses a default. */
  private resolveVariant(): ResolvedVariantSelection {
    const snapshot = this.runtime.selection.read();
    if (!snapshot.variantId) {
      throw new DeviceSelectionError('No valid device selection. Choose a device and firmware in the advanced settings.');
    }
    try {
      return this.runtime.registry.selectVariant(snapshot.variantId);
    } catch (error) {
      throw new DeviceSelectionError(`Device selection ${snapshot.variantId} is not registered`);
    }
  }

  /** Discovery filter derived from the binding, never from a legacy profile id. */
  private discoveryFilter(variant: ResolvedVariantSelection): PortFilter | undefined {
    const devices = variant.binding.discoveryFilters
      .filter(filter => filter.vendorId !== undefined)
      .map(filter => ({ vendorId: filter.vendorId, productId: filter.productId }));
    return devices.length > 0 ? PortFilters.devices(devices) : undefined;
  }

  /** Open parameters come from the selected firmware (binding), not from the port. */
  private connectionOptions(variant: ResolvedVariantSelection): { baudRate?: number; skipSignalInit: boolean } {
    const settings = this.runtime.store.operationSnapshot(variant.parameterNamespace);
    const baudRate = resolveConnectionBaudRate(variant, settings.values);
    return {
      ...(baudRate !== undefined ? { baudRate } : {}),
      skipSignalInit: variant.transport.signalInit === 'none',
    };
  }

  private toDeviceInfo(
    handle: BurnerConnectionHandle,
    generation?: number,
    session?: { profile: SessionProfile; diagnostics: readonly DeviceDiagnostic[]; probeFacts?: unknown } | null,
  ): DeviceInfo {
    const ctx = handle.context;
    if (!this.isDeviceHandle(ctx)) {
      throw new Error('Invalid connection handle: context is not a valid DeviceHandle');
    }

    const profile = session?.profile;
    const firmwareProfile = profile ? firmwareProfileFromSession(profile) : undefined;
    const flashgbxInfo = flashgbxInfoFromProbeFacts(session?.probeFacts);

    const device: DeviceInfo = {
      port: ctx.port,
      connection: null,
      transport: ctx.transport,
      serialHandle: ctx,
      portInfo: ctx.portInfo,
      connectionGeneration: generation,
      connectionId: handle.id,
      ...(firmwareProfile ? { firmwareProfile } : {}),
      ...(profile ? { session: profile } : {}),
      ...(session ? { diagnostics: session.diagnostics } : {}),
      ...(flashgbxInfo ? { flashgbxInfo } : {}),
    };

    if (device.firmwareProfile) {
      ctx.firmwareProfile = device.firmwareProfile;
    }
    return device;
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
    const portInfo = device.portInfo;
    console.info('[DeviceConnectionManager] session established', {
      source,
      variant: device.session?.variantId ?? 'unknown',
      profile: profile?.id ?? 'unknown',
      label: profile?.label ?? 'Unknown',
      firmwareVersion: profile?.firmwareVersion,
      baudRate: device.session?.transport.baudRate,
      diagnostics: device.diagnostics?.map(diagnostic => diagnostic.code) ?? [],
      port: portInfo
        ? {
          path: portInfo.path,
          vendorId: portInfo.vendorId,
          productId: portInfo.productId,
          manufacturer: portInfo.manufacturer,
          product: portInfo.product,
        }
        : null,
    });
  }

  /**
   * 请求串口设备连接
   */
  async requestDevice(options: DeviceConnectOptions = {}): Promise<DeviceInfo> {
    if (this.isConnecting) {
      throw new Error('Device connection already in progress');
    }
    this.isConnecting = true;
    console.info('[DeviceConnectionManager] requestDevice start', {
      isTauri: isTauriRuntime(),
      allowAnyPort: Boolean(options.allowAnyPort),
    });
    try {
      return await this._requestDevice(options);
    } finally {
      this.isConnecting = false;
    }
  }

  private async _requestDevice(options: DeviceConnectOptions): Promise<DeviceInfo> {
    const variant = this.resolveVariant();
    const filter = options.allowAnyPort ? undefined : this.discoveryFilter(variant);

    if (isTauriRuntime() && filter) {
      const matchingPorts = await this.listAvailablePorts(filter);
      console.info('[DeviceConnectionManager] filtered Tauri ports', matchingPorts.map(port => this.describePort(port)));
      // Automatic selection only accepts an unambiguous `match`.
      if (matchingPorts.length === 1) {
        return this.connectWithSelectedPort(matchingPorts[0], variant);
      }

      // Multiple matches need a choice; no match offers the full list but opens nothing.
      const fallbackPorts = matchingPorts.length === 0
        ? await this.listAvailablePorts()
        : matchingPorts;
      console.warn('[DeviceConnectionManager] user port selection required', fallbackPorts.map(port => this.describePort(port)));
      throw new PortSelectionRequiredError(fallbackPorts);
    }

    const result = await this.connectionUseCase.prepareConnection({
      filter,
      ...this.connectionOptions(variant),
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

    const device = this.toDeviceInfo(
      result.context.handle,
      result.context.generation,
      result.context.session ?? null,
    );
    this.logFirmwareProfile(device, 'requestDevice');
    return device;
  }

  /**
   * 使用指定的串口连接设备
   */
  async connectWithSelectedPort(
    selectedPort: SerialPortInfo,
    variant: ResolvedVariantSelection = this.resolveVariant(),
  ): Promise<DeviceInfo> {
    if (!isTauriRuntime()) {
      throw new Error('This method is only available in Tauri environment');
    }

    try {
      console.info('[DeviceConnectionManager] connectWithSelectedPort', this.describePort(selectedPort));

      const selection: BurnerConnectionSelection = {
        portInfo: selectedPort,
        context: { portInfo: selectedPort, ...this.connectionOptions(variant) },
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

      // An explicitly selected port keeps the connection even when it does not match the
      // saved variant; the resolver already recorded the `transport` mismatch diagnostic.
      const device = this.withPortInfo(
        this.toDeviceInfo(
          result.context.handle,
          result.context.generation,
          result.context.session ?? null,
        ),
        selectedPort,
      );
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

        const latestDevice = this.toDeviceInfo(
          ensureResult.context.handle,
          ensureResult.context.generation,
          ensureResult.context.session ?? null,
        );
        device.connection = latestDevice.connection;
        device.port = latestDevice.port;
        device.transport = latestDevice.transport;
        device.serialHandle = latestDevice.serialHandle;
        device.portInfo = latestDevice.portInfo;
        device.firmwareProfile = latestDevice.firmwareProfile;
        device.connectionGeneration = latestDevice.connectionGeneration;
        device.connectionId = latestDevice.connectionId;
        device.session = latestDevice.session;
        device.diagnostics = latestDevice.diagnostics;
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
   * Ports that match the saved variant. Used to order the manual list; an empty result
   * means the user must pick from the complete list instead.
   */
  async listPortsMatchingSelection(): Promise<SerialPortInfo[]> {
    try {
      return await this.listAvailablePorts(this.discoveryFilter(this.resolveVariant()));
    } catch {
      return [];
    }
  }

  /**
   * 断开设备连接
   */
  async disconnectDevice(device: DeviceInfo): Promise<void> {
    const opResult = await this.runConnectionOperation({
      requireConnected: false,
      fn: async () => {
        try {
          // Teardown (protocol safety commands) belongs to the committed session and runs
          // inside the connection port before the transport closes.
          const result = await this.connectionUseCase.disconnect();
          const diagnostics = result.diagnostics ?? [];
          if (diagnostics.length > 0) {
            console.warn('[DeviceConnectionManager] disconnect diagnostics', diagnostics);
          }
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
          device.session = undefined;
          device.diagnostics = undefined;
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
}

export { PortSelectionRequiredError };
