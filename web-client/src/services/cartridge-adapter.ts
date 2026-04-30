/* eslint-disable @typescript-eslint/require-await */
import { getFlashName } from '@/protocol';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo, SectorProgressInfo, type SectorSizeClass } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { type BurnerLogInput, errorToBurnerLog, formatBurnerLogMessage } from '@/utils/burner-log';
import NotImplementedError from '@/utils/errors/NotImplementedError';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { PerformanceTracker } from '@/utils/monitoring/sentry-tracker';
import { CFIInfo, parseCFI, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';
import { createSectorProgressInfo } from '@/utils/sector-utils';

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
  private static readonly COMMAND_RESET_PULSE_MS = 10;
  private static readonly COMMAND_RESET_SETTLE_MS = 200;
  private static readonly SIMULATED_TRANSFER_CHUNK_SIZE = 0xfffd;

  // 子类共享时序常量
  protected static readonly ROM_READ_START_SETTLE_MS = 100;
  protected static readonly ROM_READ_RETRY_RESET_MS = 120;
  protected static readonly ROM_WRITE_RETRY_RESET_MS = 150;
  protected static readonly ROM_ERASE_RETRY_RESET_MS = 150;
  protected static readonly ROM_WRITE_SAMPLE_COUNT = 4;
  protected static readonly ROM_WRITE_SAMPLE_BYTES = 4;
  protected static readonly RAM_READ_START_SETTLE_MS = 150;
  protected static readonly RAM_READ_RETRY_RESET_MS = 150;

  protected device: DeviceInfo;
  protected log: LogCallback;
  protected updateProgress: ProgressCallback;
  protected t: TranslateFunction;
  protected currentSectorProgress: SectorProgressInfo[] = [];

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
   * 擦除整个芯片
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async eraseChip(options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
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

  // readROM: see template implementation below

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
    const transport = this.device.transport ?? null;

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
    await transport?.flushInput?.();
  }

  protected async stabilizeCommandChannel(settleMs = 100): Promise<void> {
    await this.resetCommandBuffer();
    await timeout(settleMs);
  }

  protected isSimulatedDevice(): boolean {
    return this.device.serialHandle?.platform === 'simulated';
  }

  protected resolveRomPageSize(requestedPageSize?: number): number {
    const configuredPageSize = Math.min(requestedPageSize ?? AdvancedSettings.romPageSize, AdvancedSettings.romPageSize);
    if (!this.isSimulatedDevice()) {
      return configuredPageSize;
    }

    // Simulated transports already execute the full protocol path. Use larger logical chunks so
    // async command overhead does not dwarf the configured throughput controls in debug mode.
    return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
  }

  protected resolveRamPageSize(requestedPageSize?: number): number {
    const configuredPageSize = Math.min(requestedPageSize ?? AdvancedSettings.ramPageSize, AdvancedSettings.ramPageSize);
    if (!this.isSimulatedDevice()) {
      return configuredPageSize;
    }

    return Math.max(configuredPageSize, CartridgeAdapter.SIMULATED_TRANSFER_CHUNK_SIZE);
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

  protected async withPowerConfig<T>(_enable5V: boolean, fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  // --- Shared helper methods ---

  protected async readROMChunkWithRetry(
    chunkSize: number,
    logicalAddress: number,
    cartAddress: number,
    _chunkIndex: number,
    _bank: number,
    restoreState?: () => Promise<void>,
  ): Promise<Uint8Array> {
    const retries = AdvancedSettings.romReadRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.romReadRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.ops.flashCmdSet.read(this.device, chunkSize, cartAddress);
      } catch (error) {
        lastError = error;
        this.log(
          errorToBurnerLog(
            `ROM read retry ${attempt}/${attempts} @ ${formatHex(logicalAddress, 4)} (${chunkSize}B)`,
            error,
          ),
          'warn',
        );
        if (attempt < attempts) {
          await this.stabilizeCommandChannel(CartridgeAdapter.ROM_READ_RETRY_RESET_MS);
          if (restoreState) await restoreState();
          if (retryDelayMs > 0) await timeout(retryDelayMs * attempt);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  // --- Template methods ---

  async readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress = true): Promise<CommandResult> {
    const ops = this.ops;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const readThrottleMs = AdvancedSettings.romReadThrottleMs;

    this.log(this.t('messages.operation.startReadROM', { size, baseAddress: formatHex(baseAddress, 4) }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      `${ops.platformId}.readROM`,
      async () => {
        try {
          if (signal?.aborted) {
            const pr = new ProgressReporter('read', size, (pi) => { this.updateProgress(pi); }, (k, p) => this.t(k, p), showProgress);
            pr.reportError(this.t('messages.operation.cancelled'));
            return { success: false, message: this.t('messages.operation.cancelled') };
          }

          return await this.withPowerConfig(options.enable5V ?? false, async () => {
            await this.stabilizeCommandChannel(CartridgeAdapter.ROM_READ_START_SETTLE_MS);
            this.log(this.t('messages.rom.reading'), 'info');

            const data = new Uint8Array(size);
            const speedCalculator = new SpeedCalculator();
            const progressReporter = new ProgressReporter('read', size, (pi) => { this.updateProgress(pi); }, (k, p) => this.t(k, p), showProgress);
            progressReporter.reportStart(this.t('messages.rom.reading'));

            let totalRead = 0;
            let lastLoggedProgress = -1;
            let chunkCount = 0;
            let currentBank = -1;
            const needsBankSwitch = ops.needsRomBankSwitch(options.cfiInfo);

            while (totalRead < size) {
              if (signal?.aborted) {
                progressReporter.reportError(this.t('messages.operation.cancelled'));
                return { success: false, message: this.t('messages.operation.cancelled') };
              }

              const chunkSize = Math.min(pageSize, size - totalRead);
              const currentAddress = baseAddress + totalRead;
              const { bank, cartAddress } = ops.toRomBank(currentAddress, options);

              if (needsBankSwitch && bank !== currentBank) {
                currentBank = bank;
                await ops.switchRomBank(this.device, bank, options);
              }

              const restoreState = needsBankSwitch
                ? async () => { await ops.switchRomBank(this.device, bank, options); }
                : undefined;
              const chunk = await this.readROMChunkWithRetry(chunkSize, currentAddress, cartAddress, Math.floor(totalRead / pageSize) + 1, bank, restoreState);
              const chunkEndTime = Date.now();
              data.set(chunk, totalRead);
              totalRead += chunkSize;
              chunkCount++;

              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              if (chunkCount % 10 === 0 || totalRead >= size) {
                const currentSpeed = speedCalculator.getCurrentSpeed();
                progressReporter.reportProgress(totalRead, currentSpeed, this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }));
              }

              const progress = Math.floor((totalRead / size) * 100);
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.rom.readingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
              }

              if (totalRead < size && readThrottleMs > 0) {
                await timeout(readThrottleMs);
              }
            }

            const totalTime = speedCalculator.getTotalTime();
            const avgSpeed = speedCalculator.getAverageSpeed();
            const maxSpeed = speedCalculator.getMaxSpeed();

            this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
            this.log(this.t('messages.rom.readSummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(size),
            }), 'info');

            progressReporter.reportCompleted(this.t('messages.rom.readSuccess', { size: data.length }), avgSpeed);
            return { success: true, data, message: this.t('messages.rom.readSuccess', { size: data.length }) };
          });
        } catch (e) {
          const pr = new ProgressReporter('read', size, (pi) => { this.updateProgress(pi); }, (k, p) => this.t(k, p), showProgress);
          pr.reportError(this.t('messages.rom.readFailed'));
          this.log(errorToBurnerLog(this.t('messages.rom.readFailed'), e), 'error');
          return { success: false, message: this.t('messages.rom.readFailed') };
        }
      },
      { adapter_type: ops.platformId, operation_type: 'read_rom' },
      { dataSize: size, baseAddress },
    );
  }

  async getCartInfo(enable5V?: boolean): Promise<CFIInfo | false> {
    const ops = this.ops;
    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      `${ops.platformId}.getCartInfo`,
      async () => {
        try {
          return await this.withPowerConfig(enable5V ?? false, async () => {
            await ops.flashCmdSet.write(this.device, ops.flashCmdSet.encodeByte(0x98), ops.cfiEntryAddress);
            const cfiData = await ops.flashCmdSet.read(this.device, 0x100, 0x00);
            await ops.flashCmdSet.write(this.device, ops.flashCmdSet.encodeByte(0xf0), 0x00);

            const cfiInfo = parseCFI(cfiData);

            if (!cfiInfo) {
              this.log(this.t('messages.operation.cfiParseFailed'), 'error');
              return false;
            }

            try {
              const flashId = await ops.cfiGetId(this.device);
              cfiInfo.flashId = flashId;
              const idStr = Array.from(flashId).map(x => x.toString(16).padStart(2, '0')).join(' ');
              const flashName = getFlashName([...flashId]);
              this.log(`Flash ID: ${idStr} (${flashName})`, 'info');
            } catch (e) {
              this.log(errorToBurnerLog(this.t('messages.operation.readIdFailed'), e), 'warn');
            }

            this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
            this.log(cfiInfo.info, 'info');
            return cfiInfo;
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.operation.romSizeQueryFailed'), e), 'error');
          return false;
        }
      },
      { adapter_type: ops.platformId, operation_type: 'get_cart_info' },
    );
  }
}

export default CartridgeAdapter;
