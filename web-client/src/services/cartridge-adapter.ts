/* eslint-disable @typescript-eslint/require-await */
import type { CapabilityKey } from '@/device/capabilities';
import { firmwareProfileFromSession } from '@/device/compat/firmware-profile';
import { displayTextToString } from '@/device/display';
import type { ParameterStore, ParameterValue } from '@/device/parameters';
import type { SessionProfile } from '@/device/session';
import type { Transport } from '@/platform/serial';
import { getOptimalPacketLimits } from '@/platform/serial/platform-packet-policy';
import {
  boost_crc_rom,
  boost_enter_mode,
  BOOST_MAX_CRC_CHUNK,
  boost_read_rom,
  type BoostMode,
  ensureDefaultProtocol,
  markBoostModeInactive,
} from '@/protocol';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { namespaceForVariant } from '@/settings/advanced-settings-v2';
import { CommandOptions, type MbcType } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import type { FirmwareProfile } from '@/types/firmware-profile';
import { ProgressInfo, SectorProgressInfo, type SectorSizeClass } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { type BurnerLogInput, errorToBurnerLog, formatBurnerLogMessage } from '@/utils/burner-log';
import { crc32 } from '@/utils/crc-utils';
import NotImplementedError from '@/utils/errors/NotImplementedError';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { bindPackageTimeouts, releasePackageTimeouts } from '@/utils/io-timeouts';
import { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { type ProgressReporter } from '@/utils/progress/progress-reporter';
import { type SpeedCalculator } from '@/utils/progress/speed-calculator';
import { createSectorProgressInfo } from '@/utils/sector-utils';
import { floorPowerOfTwo } from '@/utils/transfer-plan';

import { planBankChunk } from './bank-chunk-planner';
import type { PlatformOps } from './platform-ops';

// 定义日志和进度回调函数类型
export type LogCallback = (message: BurnerLogInput, type: 'info' | 'success' | 'warn' | 'error' ) => void;

export type ProgressCallback = (progressInfo: ProgressInfo) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslateFunction = (key: string, params?: any) => string;

/**
 * Values an operation needs, flattened from the global and namespace parameter snapshots.
 * Defaults come from the same descriptors the settings UI uses.
 */
export interface ResolvedOperationSettings {
  romPageSize: number;
  romReadPageSize: number;
  ramPageSize: number;
  romReadThrottleMs: number;
  ramReadThrottleMs: number;
  romReadRetryCount: number;
  ramReadRetryCount: number;
  romReadRetryDelayMs: number;
  ramReadRetryDelayMs: number;
  romEraseRetryCount: number;
  romEraseRetryDelayMs: number;
  romWriteRetryCount: number;
  romWriteRetryDelayMs: number;
  defaultTimeout: number;
  packageSendTimeout: number;
  packageReceiveTimeout: number;
  operationTimeout: number;
}

const LEGACY_CAPABILITY_READERS: Partial<Record<CapabilityKey, (capabilities: FirmwareProfile['capabilities']) => boolean>> = {
  'rom.erase.sector': capabilities => capabilities.gbaSectorErase,
  'ram.fram.gba': capabilities => capabilities.gbaFramRam,
  'ram.fram.gbc': capabilities => capabilities.gbcFramRam,
  'cart.powerControl': capabilities => capabilities.cartPowerControl,
  'cart.audioWePin': capabilities => capabilities.audioWePin,
};

const OPERATION_SETTING_DEFAULTS: ResolvedOperationSettings = {
  romPageSize: 0x1000,
  romReadPageSize: 0x1000,
  ramPageSize: 0x1000,
  romReadThrottleMs: 0,
  ramReadThrottleMs: 0,
  romReadRetryCount: 1,
  ramReadRetryCount: 1,
  romReadRetryDelayMs: 0,
  ramReadRetryDelayMs: 0,
  romEraseRetryCount: 1,
  romEraseRetryDelayMs: 0,
  romWriteRetryCount: 1,
  romWriteRetryDelayMs: 0,
  defaultTimeout: 3000,
  packageSendTimeout: 3000,
  packageReceiveTimeout: 3000,
  operationTimeout: 30000,
};

function toOperationSettings(values: Readonly<Record<string, ParameterValue>>): ResolvedOperationSettings {
  const settings = { ...OPERATION_SETTING_DEFAULTS };
  for (const key of Object.keys(settings) as (keyof ResolvedOperationSettings)[]) {
    const value = values[key];
    if (typeof value === 'number') {
      settings[key] = value;
    }
  }
  return settings;
}

/**
 * 烧录器适配器接口
 * 定义所有适配器必须实现的方法
 */
export class CartridgeAdapter {
  private static readonly COMMAND_RESET_PULSE_MS = 50;
  private static readonly COMMAND_RESET_SETTLE_MS = 250;
  // Aligned chunks fit the smallest cartridge bank window (MBC5 RAM: 8 KiB)
  // and leave room for every command's header and CRC trailer.
  private static readonly SIMULATED_TRANSFER_CHUNK_SIZE = 0x2000;

  // 子类共享时序常量
  protected static readonly ROM_READ_START_SETTLE_MS = 100;
  protected static readonly ROM_READ_RETRY_RESET_MS = 120;
  protected static readonly ROM_WRITE_RETRY_RESET_MS = 120;
  protected static readonly ROM_ERASE_RETRY_RESET_MS = 150;
  protected static readonly RAM_READ_START_SETTLE_MS = 150;
  protected static readonly RAM_READ_RETRY_RESET_MS = 150;

  protected device: DeviceInfo;
  protected log: LogCallback;
  protected updateProgress: ProgressCallback;
  protected t: TranslateFunction;
  protected currentSectorProgress: SectorProgressInfo[] = [];
  protected lastCartInfoError?: string;
  protected lastCartInfoErrorCode?: string;
  protected lastCartInfoErrorDetails?: unknown;
  private channelRecentlyReset = false;
  private activeRomBankKey: string | null = null;
  private sessionProfile?: SessionProfile;
  private parameterStore?: ParameterStore;
  private operationSettings?: ResolvedOperationSettings;

  getLastCartInfoError(): string | undefined {
    return this.lastCartInfoError;
  }

  getLastCartInfoErrorCode(): string | undefined {
    return this.lastCartInfoErrorCode;
  }

  getLastCartInfoErrorDetails(): unknown {
    return this.lastCartInfoErrorDetails;
  }

  /**
   * 构造函数
   * @param device - 设备对象
   * @param logCallback - 日志回调函数
   * @param progressCallback - 进度回调函数
   * @param translateFunc - 国际化翻译函数
   */
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
  ) {
    this.device = device;
    this.log = logCallback ?? (() => { });
    this.updateProgress = progressCallback ?? (() => { });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.t = translateFunc ?? ((key: string, params?: any) => key);
  }

  /**
   * Binds the adapters of one connection to the resolved session.
   *
   * Transfer limits then come from the resolved profile (binding packet limits for the
   * detected host) instead of re-deriving them from a legacy profile id, while the
   * chunking algorithm itself is unchanged.
   */
  applySessionProfile(profile?: SessionProfile): this {
    this.sessionProfile = profile;
    return this;
  }

  /** Binds the parameter store the session reads its operation settings from. */
  bindParameters(store?: ParameterStore): this {
    this.parameterStore = store;
    return this;
  }

  /**
   * Session the adapter acts for.
   *
   * The factory binds it explicitly; an adapter built directly still inherits the committed
   * session of its device, so both paths answer capability questions the same way.
   */
  protected effectiveSession(): SessionProfile | undefined {
    return this.sessionProfile ?? this.device.session;
  }

  /**
   * Capability query of the committed session. Direct adapter use (no session) falls back
   * to the legacy profile, except for an unknown device, which is no longer treated as
   * capable of everything.
   */
  protected supports(capability: CapabilityKey): boolean {
    const session = this.effectiveSession();
    if (session) {
      return session.capabilities.has(capability);
    }
    const profile = this.device.firmwareProfile;
    if (!profile || profile.id === 'unknown') {
      return false;
    }
    const reader = LEGACY_CAPABILITY_READERS[capability];
    return reader ? reader(profile.capabilities) : false;
  }

  /** Namespace of the committed session, or of the persisted selection without one. */
  protected parameterNamespace(): string {
    const session = this.effectiveSession();
    if (session?.parameterNamespace) {
      return session.parameterNamespace;
    }
    if (session?.variantId) {
      return namespaceForVariant(session.variantId);
    }
    // Direct adapter use (tests, tools): the legacy profile is the only identity available.
    switch (this.device.firmwareProfile?.id) {
      case 'stc':
        return 'beggar.stc';
      case 'gbflash':
        return 'gbflash.cfw';
      default:
        return 'beggar.stm';
    }
  }

  /**
   * Settings snapshot of the running operation. Page sizes, throttles, retries and
   * timeouts are read once when an operation starts, so a value edited mid-transfer can
   * never change the chunking of the transfer already in flight.
   */
  protected get settings(): ResolvedOperationSettings {
    this.operationSettings ??= this.readOperationSettings();
    return this.operationSettings;
  }

  /**
   * Starts a new operation boundary and re-reads the persisted settings.
   *
   * The package timeouts of the snapshot are bound to the transport here, so the protocol
   * layer uses this operation's values for every frame instead of re-reading the persisted
   * settings mid-transfer.
   */
  beginOperation(): void {
    this.operationSettings = this.readOperationSettings();
    this.bindTransportTimeouts();
  }

  /** Releases the bound snapshot so direct protocol use falls back to the settings. */
  endOperation(): void {
    const transport = this.device.transport ?? this.device.serialHandle?.transport;
    if (transport) {
      releasePackageTimeouts(transport);
    }
  }

  private bindTransportTimeouts(): void {
    const settings = this.operationSettings;
    const transport = this.device.transport ?? this.device.serialHandle?.transport;
    if (!settings || !transport) {
      // Direct adapter use without a transport: protocol calls fall back to the settings.
      return;
    }
    bindPackageTimeouts(transport, {
      send: settings.packageSendTimeout,
      receive: settings.packageReceiveTimeout,
    });
  }

  protected readOperationSettings(): ResolvedOperationSettings {
    const store = this.parameterStore;
    const namespace = store ? this.parameterNamespace() : undefined;
    if (store && namespace) {
      return toOperationSettings(store.operationSnapshot(namespace).values);
    }
    // No session/store (direct adapter use in tests): the persisted settings still are
    // the only source, so the compatibility facade supplies the same values.
    return toOperationSettings({
      ...AdvancedSettings.getGlobalParameters(),
      ...AdvancedSettings.getNamespaceSizes(this.parameterNamespace()),
    });
  }

  /** Host-resolved packet limits: the session value first, legacy lookup otherwise. */
  protected resolvePacketLimits(): { romWrite: number; romRead: number; ramPage: number } {
    const resolved = this.effectiveSession()?.transport;
    if (resolved) {
      return resolved.packetLimits[resolved.platform];
    }
    return getOptimalPacketLimits(this.firmwareProfile.id);
  }

  protected resolveMaxReadChunk(): number {
    return this.effectiveSession()?.transport.maxReadChunk ?? this.firmwareProfile.maxReadChunk;
  }

  /**
   * 擦除ROM扇区
   * @param sectorInfo - 扇区信息数组
   * @param options - 命令选项
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 写入ROM
   * @param data - 文件数据
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async writeROM(data: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 读取ROM
   */
  async readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress = true): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 获取卡带信息
   */
  async getCartInfo(enable5V?: boolean, _options?: Partial<CommandOptions>): Promise<CFIInfo | false> {
    throw new NotImplementedError();
  }

  /**
   * 校验ROM
   * @param data - 文件数据
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async verifyROM(data: Uint8Array, options: CommandOptions, signal: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 写入RAM
   * @param data - 文件数据
   * @param options - 选项对象
   * @returns - 包含成功状态和消息的对象
   */
  async writeRAM(data: Uint8Array, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param ramType - RAM类型
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readRAM(size: number, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 校验RAM
   * @param data - 文件数据
   * @param options - RAM类型或选项对象
   * @returns - 包含成功状态和消息的对象
   */
  async verifyRAM(data: Uint8Array, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  // getCartInfo: see template implementation below

  /**
   * 创建进度信息对象的辅助方法
   * @param progress - 进度百分比
   * @param detail - 详细信息
   * @param totalBytes - 总字节数
   * @param transferredBytes - 已传输字节数
   * @param startTime - 开始时间
   * @param currentSpeed - 当前速度 (KiB/s)
   * @param allowCancel - 是否允许取消
   * @param sectorProgress - 扇区级别的进度信息（可选）
   * @returns 进度信息对象
   */
  protected createProgressInfo(
    type: 'erase' | 'write' | 'read' | 'verify' | 'other',
    progress: number,
    detail: string,
    totalBytes: number,
    transferredBytes: number,
    startTime: number,
    currentSpeed: number,
    allowCancel: boolean,
    state: 'idle' | 'running' | 'paused' | 'completed' | 'error' = 'running',
    sectorProgress?: {
      totalSectors: number;
      completedSectors: number;
      currentSectorIndex: number;
      addresses: number[];
      sizes: number[];
      sizeClasses: SectorSizeClass[];
      stateBuffer: Uint8Array;
    },
  ) {
    const builder = ProgressInfoBuilder.create()
      .type(type)
      .progress(progress)
      .detail(detail)
      .bytes(transferredBytes, totalBytes)
      .startTime(startTime)
      .speed(currentSpeed)
      .cancellable(allowCancel)
      .state(state);

    if (sectorProgress) {
      builder.sectorProgress(
        {
          addresses: sectorProgress.addresses,
          sizes: sectorProgress.sizes,
          sizeClasses: sectorProgress.sizeClasses,
          stateBuffer: sectorProgress.stateBuffer,
        },
        sectorProgress.completedSectors,
        sectorProgress.currentSectorIndex,
      );
    }

    return builder.build();
  }

  protected createErrorProgressInfo(type: 'erase' | 'write' | 'read' | 'verify' | 'other', detail: string): ProgressInfo {
    return ProgressInfoBuilder.error(type, detail).build();
  }

  /**
   * 初始化扇区进度信息（用于擦除操作的可视化）
   * @param sectorInfo - 扇区信息数组
   * @returns 初始的扇区进度信息
   */
  protected initializeSectorProgress(sectorInfo: SectorBlock[]): SectorProgressInfo[] {
    // 使用 utils 函数创建扇区进度信息
    this.currentSectorProgress = createSectorProgressInfo(sectorInfo);
    return this.currentSectorProgress;
  }

  /**
   * 重置所有扇区状态为pending
   */
  protected resetSectorsState(): void {
    this.currentSectorProgress = this.currentSectorProgress.map(sector => ({
      ...sector,
      state: 'pending_erase' as const,
    }));
  }

  async resetCommandBuffer(): Promise<void> {
    this.activeRomBankKey = null;
    const transport = this.device.transport ?? this.device.serialHandle?.transport ?? null;

    await transport?.flushInput?.();
    await transport?.setSignals({ dataTerminalReady: false, requestToSend: false });
    if (!transport) {
      await this.device.port?.setSignals({ dataTerminalReady: false, requestToSend: false });
    }
    await timeout(CartridgeAdapter.COMMAND_RESET_PULSE_MS);

    await transport?.setSignals({ dataTerminalReady: true, requestToSend: true });
    if (!transport) {
      await this.device.port?.setSignals({ dataTerminalReady: true, requestToSend: true });
    }
    await timeout(CartridgeAdapter.COMMAND_RESET_PULSE_MS);

    await transport?.setSignals({ dataTerminalReady: false, requestToSend: false });
    if (!transport) {
      await this.device.port?.setSignals({ dataTerminalReady: false, requestToSend: false });
    }
    await timeout(CartridgeAdapter.COMMAND_RESET_SETTLE_MS);
    // flushInput 只能清掉快照时刻已缓冲的数据；被超时抛弃的命令的迟到响应可能
    // 仍在 OS/USB 栈途中，需要持续排空到线路静默，否则下一条命令的响应会错位。
    if (transport?.drainInput) {
      await transport.drainInput();
    } else {
      await transport?.flushInput?.();
    }
    if (transport) {
      markBoostModeInactive(transport);
    }
    this.channelRecentlyReset = true;
  }

  /**
   * 仅当设备当前处于 Boost 扩展模式时，按需复位回默认串口协议。
   */
  protected async ensureDefaultProtocolMode(): Promise<void> {
    await ensureDefaultProtocol(this.transport);
  }

  protected async stabilizeCommandChannel(settleMs = 100, force = false): Promise<void> {
    if (!force && this.channelRecentlyReset) {
      this.channelRecentlyReset = false;
      return;
    }
    this.channelRecentlyReset = false;
    await this.resetCommandBuffer();
    this.channelRecentlyReset = false;
    await timeout(settleMs);
  }

  protected markChannelBusy(): void {
    this.channelRecentlyReset = false;
  }

  protected get isBoostMode(): boolean {
    return this.effectiveSession()?.runtimeFeatures.boostTransport
      ?? this.firmwareProfile.capabilities.boostMode;
  }

  protected async stabilizeReadChannel(
    options: Pick<CommandOptions, 'skipChannelStabilize'>,
    settleMs: number,
  ): Promise<void> {
    if (options.skipChannelStabilize || this.isBoostMode) {
      this.markChannelBusy();
      return;
    }
    await this.stabilizeCommandChannel(settleMs);
  }

  protected setActiveRomBankKey(bankKey: string): void {
    this.activeRomBankKey = bankKey;
  }

  protected async ensureRomBank(
    bankKey: string,
    switchBank: () => Promise<void>,
  ): Promise<void> {
    if (this.activeRomBankKey === bankKey) {
      return;
    }
    await switchBank();
    this.activeRomBankKey = bankKey;
  }

  protected isSimulatedDevice(): boolean {
    return this.device.serialHandle?.platform === 'simulated';
  }

  protected resolveRomPageSize(requestedPageSize?: number): number {
    const configured = this.settings.romPageSize;
    const configuredPageSize = floorPowerOfTwo(Math.min(requestedPageSize ?? configured, configured), 1);
    if (this.isSimulatedDevice()) {
      // Simulated transports already execute the full protocol path. Use larger logical chunks so
      // async command overhead does not dwarf the configured throughput controls in debug mode.
      return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    const limits = this.resolvePacketLimits();
    return Math.min(requestedPageSize ?? configured, configuredPageSize === configured ? configured : configuredPageSize, limits.romWrite);
  }

  protected resolveRomReadPageSize(requestedPageSize?: number): number {
    const configured = this.settings.romReadPageSize;
    const limits = this.resolvePacketLimits();
    const maxReadChunk = this.resolveMaxReadChunk();
    // STC8 streams short read replies, so its ceiling is the firmware read chunk itself.
    const maxAllowed = this.parameterNamespace() === 'beggar.stc'
      ? maxReadChunk
      : Math.min(maxReadChunk, limits.romRead);
    const rawTarget = Math.min(
      requestedPageSize ?? configured,
      this.isBoostMode ? maxAllowed : configured,
      maxAllowed,
    );
    if (this.isSimulatedDevice()) {
      return Math.max(floorPowerOfTwo(rawTarget, 1), CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    // 保留 3072B (0x0c00) 作为平台最佳非2的幂步长，其它情况向下对齐到 2 的幂
    return rawTarget === 0x0c00 ? rawTarget : floorPowerOfTwo(rawTarget, 1);
  }

  protected resolveRamPageSize(requestedPageSize?: number): number {
    const configured = this.settings.ramPageSize;
    const configuredPageSize = Math.min(requestedPageSize ?? configured, configured);
    if (this.isSimulatedDevice()) {
      return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    return Math.min(configuredPageSize, this.resolvePacketLimits().ramPage);
  }

  protected summarizeLogMessage(message: BurnerLogInput): string {
    return typeof message === 'string' ? message : formatBurnerLogMessage(message);
  }

  // --- PlatformOps infrastructure ---

  private _ops?: PlatformOps;

  protected get ops(): PlatformOps {
    this._ops ??= this.createPlatformOps();
    return this._ops;
  }

  protected createPlatformOps(): PlatformOps {
    throw new NotImplementedError();
  }

  /**
   * Legacy projection of the session profile.
   *
   * Direct adapter use without a committed session still needs an explicit profile: the app
   * never guesses one from port strings, so an unknown device stays unknown instead of
   * inheriting permissive capabilities.
   */
  protected get firmwareProfile(): FirmwareProfile {
    const session = this.effectiveSession();
    if (session) {
      return firmwareProfileFromSession(session);
    }
    const legacy = this.device.firmwareProfile ?? this.device.serialHandle?.firmwareProfile;
    if (!legacy) {
      throw new Error('Device firmware profile is unknown: bind a session or set DeviceInfo.firmwareProfile');
    }
    return legacy;
  }

  /** Display label of the connected device/firmware, used by operation messages. */
  protected deviceLabel(): string {
    const session = this.effectiveSession();
    if (session) {
      return displayTextToString(session.display.title);
    }
    return this.device.firmwareProfile?.label ?? 'Unknown device';
  }

  protected get transport(): Transport {
    const transport = this.device.transport ?? this.device.serialHandle?.transport;
    if (!transport) {
      throw new Error('Device transport is not initialized');
    }
    return transport;
  }

  // --- Shared helper methods ---

  private static isReadTimeoutError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout|incomplete package read/i.test(message);
  }

  private static createAbortError(): Error {
    const error = new Error('Operation cancelled');
    error.name = 'AbortError';
    return error;
  }

  protected async readROMChunkWithRetry(
    chunkSize: number,
    logicalAddress: number,
    cartAddress: number,
    _chunkIndex: number,
    _bank: number,
    restoreState?: () => Promise<void>,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const retries = this.settings.romReadRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = this.settings.romReadRetryDelayMs;
    let lastError: unknown;
    let subChunkSplitDepth = 0;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (signal?.aborted) {
        throw CartridgeAdapter.createAbortError();
      }
      try {
        if (subChunkSplitDepth === 0 || chunkSize <= 512) {
          return await this.ops.flashCmdSet.read(this.transport, chunkSize, cartAddress);
        }

        // 遇到读包超时/丢字节时，将大块拆分为更小的子块（如 4096B -> 2048B -> 1024B），
        // 避免 macOS USB CDC / tty 内核缓冲区在 >4KB 突发传输时再次溢出丢字节。
        const subChunkSize = Math.max(512, (chunkSize >> subChunkSplitDepth) & ~1);
        const combined = new Uint8Array(chunkSize);
        let offset = 0;
        while (offset < chunkSize) {
          if (signal?.aborted) {
            throw CartridgeAdapter.createAbortError();
          }
          const subSize = Math.min(subChunkSize, chunkSize - offset);
          const part = await this.ops.flashCmdSet.read(this.transport, subSize, cartAddress + offset);
          combined.set(part, offset);
          offset += subSize;
        }
        return combined;
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw CartridgeAdapter.createAbortError();
        }
        lastError = error;
        if (CartridgeAdapter.isReadTimeoutError(error)) {
          subChunkSplitDepth += 1;
        }
        this.log(
          errorToBurnerLog(
            `ROM read retry ${attempt}/${attempts} @ ${formatHex(logicalAddress, 4)} (${chunkSize}B)`,
            error,
          ),
          'warn',
        );
        if (attempt < attempts) {
          await this.stabilizeCommandChannel(CartridgeAdapter.ROM_READ_RETRY_RESET_MS);
          if (signal?.aborted) {
            throw CartridgeAdapter.createAbortError();
          }
          if (this.isBoostMode) {
            await boost_enter_mode(this.transport, this.ops.platformId === 'gba' ? 'agb' : 'dmg');
          }
          if (restoreState) await restoreState();
          if (retryDelayMs > 0) await timeout(retryDelayMs * attempt);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Direct command retry for ROM programming: retries the program call itself
   * without re-erasing the sector.
   */
  protected async programRomChunkWithRetry(
    programFn: () => Promise<void>,
    logicalAddress: number,
    signal?: AbortSignal,
    onRetryReset?: () => Promise<void>,
  ): Promise<{ attemptsUsed: number; retriesPerformed: number }> {
    const retries = this.settings.romWriteRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = this.settings.romWriteRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (signal?.aborted) {
        throw CartridgeAdapter.createAbortError();
      }
      try {
        await programFn();
        return { attemptsUsed: attempt, retriesPerformed: attempt - 1 };
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw CartridgeAdapter.createAbortError();
        }
        lastError = error;
        this.log(
          errorToBurnerLog(
            `ROM write retry ${attempt}/${attempts} @ ${formatHex(logicalAddress, 4)}`,
            error,
          ),
          'warn',
        );
        if (attempt < attempts) {
          await this.stabilizeCommandChannel(CartridgeAdapter.ROM_WRITE_RETRY_RESET_MS);
          if (signal?.aborted) {
            throw CartridgeAdapter.createAbortError();
          }
          if (onRetryReset) {
            await onRetryReset();
          }
          if (retryDelayMs > 0) {
            await timeout(retryDelayMs * attempt);
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * 使用 Beggar Boost 固件硬件 CRC32 (0xd5) 快速校验 ROM；仅在 CRC 不匹配时分段回读定位首个错字节。
   */
  protected async verifyROMWithBoostCrc32(params: {
    mode: BoostMode;
    image: Uint8Array;
    baseAddress: number;
    total: number;
    readChunkSize: number;
    mbcType?: MbcType;
    isMultiBank: boolean;
    switchBankInBoostMode: (bank: number) => Promise<void>;
    progressReporter: ProgressReporter;
    speedCalculator: SpeedCalculator;
    signal?: AbortSignal;
  }): Promise<CommandResult> {
    const {
      mode,
      image,
      baseAddress,
      total,
      readChunkSize,
      mbcType,
      isMultiBank,
      switchBankInBoostMode,
      progressReporter,
      speedCalculator,
      signal,
    } = params;

    let verified = 0;
    let chunkCount = 0;
    let lastLoggedProgress = -1;
    let currentBank = -1;
    let success = true;
    let mismatchMessage = '';

    await boost_enter_mode(this.transport, mode);
    try {
      while (verified < total && success) {
        if (signal?.aborted) {
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }

        const currentAddress = baseAddress + verified;
        const plan = planBankChunk(
          currentAddress,
          total - verified,
          BOOST_MAX_CRC_CHUNK,
          mode === 'agb'
            ? { platform: 'gba', memory: 'rom' }
            : { platform: 'mbc', memory: 'rom', mbcType: mbcType ?? 'MBC5' },
        );

        if (isMultiBank && plan.bank !== currentBank) {
          currentBank = plan.bank;
          await switchBankInBoostMode(plan.bank);
        }

        const expectedSlice = image.subarray(verified, verified + plan.chunkSize);
        const expectedCrc = crc32(expectedSlice);
        const actualCrc = await boost_crc_rom(this.transport, mode, plan.cartAddress, plan.chunkSize);
        const chunkEndTime = Date.now();
        chunkCount += 1;

        if (actualCrc !== expectedCrc) {
          // 仅在 CRC32 不匹配时回读该窗口，精确定位第一个不匹配字节
          let windowOffset = 0;
          const stepSize = Math.max(64, Math.min(readChunkSize, 0x1000));
          while (windowOffset < plan.chunkSize && success) {
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }
            const subLen = Math.min(stepSize, plan.chunkSize - windowOffset);
            const actualChunk = await boost_read_rom(this.transport, mode, subLen, plan.cartAddress + windowOffset);
            for (let i = 0; i < subLen; i += 1) {
              const expectedByte = expectedSlice[windowOffset + i];
              const actualByte = actualChunk[i];
              if (expectedByte !== actualByte) {
                success = false;
                const failedAddress = currentAddress + windowOffset + i;
                mismatchMessage = this.t('messages.rom.verifyFailedAt', {
                  address: formatHex(failedAddress, 4),
                  expected: formatHex(expectedByte, 1),
                  actual: formatHex(actualByte, 1),
                });
                this.log(mismatchMessage, 'error');
                break;
              }
            }
            windowOffset += subLen;
          }

          if (success) {
            success = false;
            mismatchMessage = this.t('messages.rom.verifyFailed');
            this.log(mismatchMessage, 'error');
          }
          break;
        }

        verified += plan.chunkSize;
        speedCalculator.addDataPoint(plan.chunkSize, chunkEndTime);
        const currentSpeed = speedCalculator.getCurrentSpeed();
        progressReporter.reportProgress(
          verified,
          currentSpeed,
          this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
        );

        const progress = Math.floor((verified / total) * 100);
        if (progress % 5 === 0 && progress !== lastLoggedProgress) {
          this.log(this.t('messages.rom.verifyingAt', {
            address: formatHex(currentAddress, 4),
            progress,
          }), 'info');
          lastLoggedProgress = progress;
        }
      }
    } catch (error) {
      // 异常中断时复位模式，避免残留半包影响后续操作
      await ensureDefaultProtocol(this.transport).catch(() => {});
      throw error;
    }

    const totalTime = speedCalculator.getTotalTime();
    const avgSpeed = totalTime > 0 ? total / totalTime : speedCalculator.getAverageSpeed();
    const maxSpeed = speedCalculator.getMaxSpeed();
    if (success) {
      this.log(this.t('messages.rom.verifySuccess'), 'success');
      this.log(this.t('messages.rom.verifySummary', {
        totalTime: formatTimeDuration(totalTime),
        avgSpeed: formatSpeed(avgSpeed),
        maxSpeed: formatSpeed(maxSpeed),
        totalSize: formatBytes(total),
        requestCount: chunkCount,
      }), 'info');
      progressReporter.reportCompleted(this.t('messages.rom.verifySuccess'), avgSpeed);
      return {
        success: true,
        message: this.t('messages.rom.verifySuccess'),
      };
    }

    const failureMessage = mismatchMessage || this.t('messages.rom.verifyFailed');
    progressReporter.reportError(failureMessage);
    return {
      success: false,
      message: failureMessage,
    };
  }
}

export default CartridgeAdapter;
