/* eslint-disable @typescript-eslint/require-await */
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo } from '@/types/progress-info';
import NotImplementedError from '@/utils/errors/NotImplementedError';

// 定义日志和进度回调函数类型
export type LogCallback = (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void;

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
    this.log = logCallback || (() => {});
    this.updateProgress = progressCallback || (() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.t = translateFunc || ((key: string, params?: any) => key);
  }

  /**
   * 读取ROM芯片ID
   * @returns {Promise<CommandResult & { idStr?: string }>} - 包含成功状态、ID字符串和消息的对象
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
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
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小
   * @returns - 包含成功状态和消息的对象
   */
  async eraseSectors(startAddress: number, endAddress: number, sectorSize: number, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 写入ROM
   * @param data - 文件数据
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async writeROM(data: Uint8Array, options: CommandOptions = {}, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 读取ROM
   * @param size - 读取大小
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, options: CommandOptions = {}, signal?: AbortSignal): Promise<CommandResult> {
    throw new NotImplementedError();
  }

  /**
   * 校验ROM
   * @param data - 文件数据
   * @param options - 选项对象
   * @param signal - 取消信号，用于中止操作
   * @returns - 包含成功状态和消息的对象
   */
  async verifyROM(data: Uint8Array, options: CommandOptions = {}, signal: AbortSignal): Promise<CommandResult> {
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
  async getCartInfo(): Promise<{ deviceSize: number, sectorCount: number, sectorSize: number, bufferWriteBytes: number }> {
    throw new NotImplementedError();
  }

  /**
   * 创建进度信息对象的辅助方法
   * @param progress - 进度百分比
   * @param detail - 详细信息
   * @param totalBytes - 总字节数
   * @param transferredBytes - 已传输字节数
   * @param startTime - 开始时间
   * @param currentSpeed - 当前速度 (KB/s)
   * @param allowCancel - 是否允许取消
   * @returns 进度信息对象
   */
  protected createProgressInfo(
    progress?: number,
    detail?: string,
    totalBytes?: number,
    transferredBytes?: number,
    startTime?: number,
    currentSpeed?: number,
    allowCancel: boolean = true,
    state: 'idle' | 'running' | 'paused' | 'completed' | 'error' = 'running',
  ): ProgressInfo {
    return {
      progress,
      detail,
      totalBytes,
      transferredBytes,
      startTime,
      currentSpeed,
      allowCancel,
      state,
    };
  }

  protected createErrorProgressInfo(detail: string) : ProgressInfo {
    return this.createProgressInfo(
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
}

export default CartridgeAdapter;
