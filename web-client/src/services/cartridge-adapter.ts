/* eslint-disable @typescript-eslint/require-await */
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo, SectorProgressInfo } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import NotImplementedError from '@/utils/errors/NotImplementedError';
import { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { createSectorProgressInfo } from '@/utils/sector-utils';

// 定义日志和进度回调函数类型
export type LogCallback = (message: string, type: 'info' | 'success' | 'warn' | 'error' ) => void;

export type ProgressCallback = (progressInfo: ProgressInfo) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslateFunction = (key: string, params?: any) => string;

/**
 * 烧录器适配器接口
 * 定义所有适配器必须实现的方法
 */
export class CartridgeAdapter {
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
  async eraseChip(signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 擦除ROM扇区
   * @param sectorInfo - 扇区信息数组
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  async eraseSectors(
    sectorInfo: SectorBlock[],
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
   * @param size - 读取大小
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @param showProgress - 是否显示读取进度面板，默认为true
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress = true): Promise<CommandResult> {
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

  /**
   * 获取卡带信息
   */
  async getCartInfo(): Promise<CFIInfo | false> {
    throw new NotImplementedError();
  }

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
      sectors: SectorProgressInfo[];
      totalSectors: number;
      completedSectors: number;
      currentSectorIndex: number;
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
      builder.sectors(
        sectorProgress.sectors,
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
      state: 'pending' as const,
    }));
  }

  async resetCommandBuffer(): Promise<void> {
    await this.device.port?.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(200);
    await this.device.port?.setSignals({ dataTerminalReady: true, requestToSend: true });
  }
}

export default CartridgeAdapter;
