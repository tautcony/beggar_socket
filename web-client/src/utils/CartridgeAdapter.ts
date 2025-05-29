import { DeviceInfo } from '@/types/DeviceInfo.ts';
import { CommandResult } from '@/types/CommandResult.ts';
import { CommandOptions } from '@/types/CommandOptions.ts';

// 定义日志和进度回调函数类型
export type LogCallback = (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void;
export type ProgressCallback = (progress: number, message?: string) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslateFunction = (key: string, params?: any) => string;

/**
 * 烧录器适配器接口
 * 定义所有适配器必须实现的方法
 */
export class CartridgeAdapter {
  public idStr: string = '';

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
    translateFunc: TranslateFunction | null = null
  ) {
    this.device = device;
    this.log = logCallback || (() => {});
    this.updateProgress = progressCallback || (() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.t = translateFunc || ((key: string, params?: any) => key);
  }

  /**
   * 读取ROM芯片IDx
   * @returns {Promise<CommandResult & { idStr?: string }>} - 包含成功状态、ID字符串和消息的对象
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
    throw new Error('未实现的方法: readID');
  }

  /**
   * 擦除整个芯片
   * @returns - 包含成功状态和消息的对象
   */
  async eraseChip(): Promise<CommandResult> {
    throw new Error('未实现的方法: eraseChip');
  }

  /**
   * 擦除ROM扇区
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小
   * @returns - 包含成功状态和消息的对象
   */
  async eraseSectors(startAddress: number, endAddress: number, sectorSize: number): Promise<CommandResult> {
    throw new Error('未实现的方法: eraseSectors');
  }

  /**
   * 写入ROM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 包含成功状态和消息的对象
   */
  async writeROM(fileData: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    throw new Error('未实现的方法: writeROM');
  }

  /**
   * 读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, baseAddress: number = 0): Promise<CommandResult> {
    throw new Error('未实现的方法: readROM');
  }

  /**
   * 校验ROM
   * @param fileData - 文件数据
   * @param baseAddress - 基础地址
   * @returns - 包含成功状态和消息的对象
   */
  async verifyROM(fileData: Uint8Array, baseAddress: number = 0): Promise<CommandResult> {
    throw new Error('未实现的方法: verifyROM');
  }

  /**
   * 写入RAM
   * @param fileData - 文件数据
   * @param options - RAM类型或选项对象
   * @returns - 包含成功状态和消息的对象
   */
  async writeRAM(fileData: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    throw new Error('未实现的方法: writeRAM');
  }

  /**
   * 读取RAM
   * @param size - 读取大小
   * @param ramType - RAM类型
   * @returns - 包含成功状态、数据和消息的对象
   */
  async readRAM(size: number, options?: CommandOptions): Promise<CommandResult> {
    throw new Error('未实现的方法: readRAM');
  }

  /**
   * 校验RAM
   * @param fileData - 文件数据
   * @param options - RAM类型或选项对象
   * @returns - 包含成功状态和消息的对象
   */
  async verifyRAM(fileData: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    throw new Error('未实现的方法: verifyRAM');
  }
}

export default CartridgeAdapter;
