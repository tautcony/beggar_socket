/**
 * 烧录器适配器接口
 * 定义所有适配器必须实现的方法
 */
export class CartridgeAdapter {
  /**
   * 构造函数
   * @param {Object} device - 设备对象
   * @param {Function} logCallback - 日志回调函数
   * @param {Function} progressCallback - 进度回调函数
   * @param {Function} translateFunc - 国际化翻译函数
   */
  constructor(device, logCallback = null, progressCallback = null, translateFunc = null) {
    this.device = device;
    this.log = logCallback || (() => {});
    this.updateProgress = progressCallback || (() => {});
    this.t = translateFunc || ((key) => key);
  }

  /**
   * 读取ROM芯片IDx
   * @returns {Promise<Object>} - 包含成功状态、ID字符串和消息的对象
   */
  async readID() {
    throw new Error('未实现的方法: readID');
  }

  /**
   * 擦除整个芯片
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async eraseChip() {
    throw new Error('未实现的方法: eraseChip');
  }

  /**
   * 擦除ROM扇区
   * @param {number} startAddress - 起始地址
   * @param {number} endAddress - 结束地址
   * @param {number} sectorSize - 扇区大小
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async eraseSectors(startAddress, endAddress, sectorSize) {
    throw new Error('未实现的方法: eraseSectors');
  }

  /**
   * 写入ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {boolean|Object} options - 写入选项（可能是布尔值或对象，取决于具体实现）
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async writeROM(fileData, options) {
    throw new Error('未实现的方法: writeROM');
  }

  /**
   * 读取ROM
   * @param {number} size - 读取大小
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<Object>} - 包含成功状态、数据和消息的对象
   */
  async readROM(size, baseAddress) {
    throw new Error('未实现的方法: readROM');
  }

  /**
   * 校验ROM
   * @param {Uint8Array} fileData - 文件数据
   * @param {number} baseAddress - 基础地址
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async verifyROM(fileData, baseAddress) {
    throw new Error('未实现的方法: verifyROM');
  }

  /**
   * 写入RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {string|Object} options - RAM类型或选项对象
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async writeRAM(fileData, options) {
    throw new Error('未实现的方法: writeRAM');
  }

  /**
   * 读取RAM
   * @param {number} size - 读取大小
   * @param {string|Object} options - RAM类型或选项对象
   * @returns {Promise<Object>} - 包含成功状态、数据和消息的对象
   */
  async readRAM(size, options) {
    throw new Error('未实现的方法: readRAM');
  }

  /**
   * 校验RAM
   * @param {Uint8Array} fileData - 文件数据
   * @param {string|Object} options - RAM类型或选项对象
   * @returns {Promise<Object>} - 包含成功状态和消息的对象
   */
  async verifyRAM(fileData, options) {
    throw new Error('未实现的方法: verifyRAM');
  }
}

export default CartridgeAdapter;
