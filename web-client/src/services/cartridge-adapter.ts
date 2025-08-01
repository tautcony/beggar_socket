/* eslint-disable @typescript-eslint/require-await */
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo, SectorInfo } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { CFIInfo } from '@/utils/cfi-parser';
import NotImplementedError from '@/utils/errors/NotImplementedError';

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
  protected currentSectorProgress: SectorInfo[] = [];

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
   * 读取ROM芯片ID
   * @returns {Promise<CommandResult & { id?: number[] }>} - 包含成功状态、ID字符串和消息的对象
   */
  async readID(): Promise<CommandResult & { id?: number[] }> {
    throw new NotImplementedError();
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
    sectorInfo: { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[],
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
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
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
    type: 'erase' | 'write' | 'read' | 'other',
    progress?: number,
    detail?: string,
    totalBytes?: number,
    transferredBytes?: number,
    startTime?: number,
    currentSpeed?: number,
    allowCancel = true,
    state: 'idle' | 'running' | 'paused' | 'completed' | 'error' = 'running',
    sectorProgress?: {
      sectors: SectorInfo[]
      totalSectors: number
      completedSectors: number
      currentSectorIndex: number
    },
  ): ProgressInfo {
    return {
      type,
      progress,
      detail,
      totalBytes,
      transferredBytes,
      startTime,
      currentSpeed,
      allowCancel,
      state,
      sectorProgress,
    };
  }

  protected createErrorProgressInfo(type: 'erase' | 'write' | 'read' | 'other', detail: string): ProgressInfo {
    return this.createProgressInfo(
      type,
      undefined,
      detail,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      'error',
    );
  }

  /**
   * 创建扇区级别的进度信息对象（用于擦除操作的可视化）
   * @param sectorInfo - 扇区信息数组
   * @returns 初始的扇区进度信息
   */
  protected createSectorProgressInfo(sectorInfo: { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[]): SectorInfo[] {
    const sectors: SectorInfo[] = [];

    // 按照从高地址到低地址的顺序创建扇区信息（与擦除顺序一致）
    for (const { startAddress, endAddress, sectorSize } of sectorInfo.reverse()) {
      const sectorMask = sectorSize - 1;
      const alignedEndAddress = endAddress & ~sectorMask;

      // 从高地址向低地址创建当前段的扇区信息
      for (let address = alignedEndAddress; address >= startAddress; address -= sectorSize) {
        sectors.push({
          address,
          size: sectorSize,
          state: 'pending',
        });
      }
    }

    // 存储到当前实例中
    this.currentSectorProgress = sectors;
    return sectors;
  }

  /**
   * 更新扇区进度信息
   * @param currentAddress - 当前处理的地址
   * @param state - 扇区状态
   * @returns 当前扇区索引
   */
  protected updateSectorProgress(currentAddress: number, state: SectorInfo['state']): number {
    let currentIndex = -1;
    this.currentSectorProgress = this.currentSectorProgress.map((sector, index) => {
      if (sector.address === currentAddress) {
        currentIndex = index;
        return { ...sector, state };
      }
      return sector;
    });
    return currentIndex;
  }

  async resetCommandBuffer(): Promise<void> {
    await this.device.port?.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(200);
    await this.device.port?.setSignals({ dataTerminalReady: true, requestToSend: true });
  }
}

export default CartridgeAdapter;
