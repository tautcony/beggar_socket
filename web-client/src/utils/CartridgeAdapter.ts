import { DeviceInfo } from '../types/DeviceInfo.ts';

// 定义适配器返回的结果类型
export interface AdapterResult {
  success: boolean;
  message: string;
  data?: Uint8Array;
}

export interface CartridgeAdapterOptions {
  ramType?: 'SRAM' | 'FLASH',
  baseAddress?: number,
  romSize?: number,
  useDirectWrite?: boolean,
}

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
   * @param {DeviceInfo} device - 设备对象
   * @param {LogCallback} logCallback - 日志回调函数
   * @param {ProgressCallback} progressCallback - 进度回调函数
   * @param {TranslateFunction} translateFunc - 国际化翻译函数
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
   * @returns {Promise<AdapterResult>} - 包含成功状态、ID字符串和消息的对象
   */
  async readID(): Promise<AdapterResult> {
    throw new Error('未实现的方法: readID');
  }

  /**
   * 擦除整个芯片
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async eraseChip(): Promise<AdapterResult> {
    throw new Error('未实现的方法: eraseChip');
  }

  /**
   * 擦除ROM扇区
   * @param {number} startAddress - 起始地址
   * @param {number} endAddress - 结束地址
   * @param {number} sectorSize - 扇区大小
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async eraseSectors(startAddress: number, endAddress: number, sectorSize: number): Promise<AdapterResult> {
    throw new Error('未实现的方法: eraseSectors');
  }

  /**
   * 写入ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {CartridgeAdapterOptions} options - 写入选项
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async writeROM(fileData: Uint8Array, options?: CartridgeAdapterOptions): Promise<AdapterResult> {
    throw new Error('未实现的方法: writeROM');
  }

  /**
   * 读取ROM
   * @param {number} size - 读取大小
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<AdapterResult>} - 包含成功状态、数据和消息的对象
   */
  async readROM(size: number, baseAddress: number): Promise<AdapterResult> {
    throw new Error('未实现的方法: readROM');
  }

  /**
   * 校验ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async verifyROM(fileData: Uint8Array, baseAddress: number): Promise<AdapterResult> {
    throw new Error('未实现的方法: verifyROM');
  }

  /**
   * 写入RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {CartridgeAdapterOptions} options - RAM类型或选项对象
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async writeRAM(fileData: Uint8Array, options?: CartridgeAdapterOptions): Promise<AdapterResult> {
    throw new Error('未实现的方法: writeRAM');
  }

  /**
   * 读取RAM
   * @param {number} size - 读取大小
   * @param {CartridgeAdapterOptions} options - RAM类型或选项对象
   * @returns {Promise<AdapterResult>} - 包含成功状态、数据和消息的对象
   */
  async readRAM(size: number, options?: CartridgeAdapterOptions): Promise<AdapterResult> {
    throw new Error('未实现的方法: readRAM');
  }

  /**
   * 校验RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {CartridgeAdapterOptions} options - RAM类型或选项对象
   * @returns {Promise<AdapterResult>} - 包含成功状态和消息的对象
   */
  async verifyRAM(fileData: Uint8Array, options?: CartridgeAdapterOptions): Promise<AdapterResult> {
    throw new Error('未实现的方法: verifyRAM');
  }
}

export default CartridgeAdapter;
