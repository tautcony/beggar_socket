/* eslint-disable @typescript-eslint/require-await */
import type { Transport } from '@/platform/serial';
import { getOptimalPacketLimits } from '@/platform/serial/platform-packet-policy';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { type FirmwareProfile, getFirmwareProfile } from '@/types/firmware-profile';
import { ProgressInfo, SectorProgressInfo, type SectorSizeClass } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { type BurnerLogInput, errorToBurnerLog, formatBurnerLogMessage } from '@/utils/burner-log';
import NotImplementedError from '@/utils/errors/NotImplementedError';
import { formatHex } from '@/utils/formatter-utils';
import { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { createSectorProgressInfo } from '@/utils/sector-utils';
import { floorPowerOfTwo } from '@/utils/transfer-plan';

import type { PlatformOps } from './platform-ops';

// 定义日志和进度回调函数类型
export type LogCallback = (message: BurnerLogInput, type: 'info' | 'success' | 'warn' | 'error' ) => void;

export type ProgressCallback = (progressInfo: ProgressInfo) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslateFunction = (key: string, params?: any) => string;

/**
 * 烧录器适配器接口
 * 定义所有适配器必须实现的方法
 */
export class CartridgeAdapter {
  private static readonly COMMAND_RESET_PULSE_MS = 50;
  private static readonly COMMAND_RESET_SETTLE_MS = 250;
  private static readonly SIMULATED_TRANSFER_CHUNK_SIZE = 0xfffd;

  // 子类共享时序常量
  protected static readonly ROM_READ_START_SETTLE_MS = 100;
  protected static readonly ROM_READ_RETRY_RESET_MS = 120;
  protected static readonly ROM_ERASE_RETRY_RESET_MS = 150;
  protected static readonly RAM_READ_START_SETTLE_MS = 150;
  protected static readonly RAM_READ_RETRY_RESET_MS = 150;

  protected device: DeviceInfo;
  protected log: LogCallback;
  protected updateProgress: ProgressCallback;
  protected t: TranslateFunction;
  protected currentSectorProgress: SectorProgressInfo[] = [];
  protected lastCartInfoError?: string;

  getLastCartInfoError(): string | undefined {
    return this.lastCartInfoError;
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
  async getCartInfo(enable5V?: boolean): Promise<CFIInfo | false> {
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
  async writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param ramType - RAM类型
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readRAM(size: number, options?: CommandOptions): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 校验RAM
   * @param data - 文件数据
   * @param options - RAM类型或选项对象
   * @returns - 包含成功状态和消息的对象
   */
  async verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
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
  }

  protected async stabilizeCommandChannel(settleMs = 100): Promise<void> {
    await this.resetCommandBuffer();
    await timeout(settleMs);
  }

  protected isSimulatedDevice(): boolean {
    return this.device.serialHandle?.platform === 'simulated';
  }

  protected resolveRomPageSize(requestedPageSize?: number): number {
    const profileKey = this.firmwareProfile.id === 'stc' ? 'stc' : 'stm';
    const profileSizes = AdvancedSettings.getProfileSizes(profileKey);
    const configuredPageSize = floorPowerOfTwo(
      Math.min(requestedPageSize ?? profileSizes.romPageSize, profileSizes.romPageSize),
      1,
    );
    if (this.isSimulatedDevice()) {
      // Simulated transports already execute the full protocol path. Use larger logical chunks so
      // async command overhead does not dwarf the configured throughput controls in debug mode.
      return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    const limits = getOptimalPacketLimits(this.firmwareProfile.id);
    return Math.min(requestedPageSize ?? profileSizes.romPageSize, configuredPageSize === profileSizes.romPageSize ? profileSizes.romPageSize : configuredPageSize, limits.romWrite);
  }

  protected resolveRomReadPageSize(requestedPageSize?: number): number {
    const profileKey = this.firmwareProfile.id === 'stc' ? 'stc' : 'stm';
    const profileSizes = AdvancedSettings.getProfileSizes(profileKey);
    const limits = getOptimalPacketLimits(this.firmwareProfile.id);
    const maxAllowed = this.firmwareProfile.id === 'stc'
      ? this.firmwareProfile.maxReadChunk
      : Math.min(this.firmwareProfile.maxReadChunk, limits.romRead);
    const rawTarget = Math.min(
      requestedPageSize ?? profileSizes.romReadPageSize,
      profileSizes.romReadPageSize,
      maxAllowed,
    );
    if (this.isSimulatedDevice()) {
      return Math.max(floorPowerOfTwo(rawTarget, 1), CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    // 保留 3072B (0x0c00) 作为平台最佳非2的幂步长，其它情况向下对齐到 2 的幂
    return rawTarget === 0x0c00 ? rawTarget : floorPowerOfTwo(rawTarget, 1);
  }

  protected resolveRamPageSize(requestedPageSize?: number): number {
    const profileKey = this.firmwareProfile.id === 'stc' ? 'stc' : 'stm';
    const profileSizes = AdvancedSettings.getProfileSizes(profileKey);
    const configuredPageSize = Math.min(requestedPageSize ?? profileSizes.ramPageSize, profileSizes.ramPageSize);
    if (this.isSimulatedDevice()) {
      return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
    }
    const limits = getOptimalPacketLimits(this.firmwareProfile.id);
    return Math.min(configuredPageSize, limits.ramPage);
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

  protected get firmwareProfile(): FirmwareProfile {
    return getFirmwareProfile(this.device);
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
    const retries = AdvancedSettings.romReadRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.romReadRetryDelayMs;
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
  ): Promise<{ attemptsUsed: number; retriesPerformed: number }> {
    const retries = AdvancedSettings.romWriteRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.romWriteRetryDelayMs;
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
        if (attempt < attempts && retryDelayMs > 0) {
          await timeout(retryDelayMs * attempt);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

export default CartridgeAdapter;
