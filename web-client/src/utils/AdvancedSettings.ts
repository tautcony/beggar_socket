/**
 * 高级设置配置类
 * 用于管理页面大小、超时时间等可配置参数
 */
export class AdvancedSettings {
  // 页面大小设置
  private static _romPageSize = 0x1000; // 4KB for ROM operations (默认值)
  private static _ramPageSize = 0x800; // 1KB for RAM operations (默认值)

  // 超时设置（毫秒）
  private static _defaultTimeout = 6000; // 默认超时时间
  private static _packageSendTimeout = 6000; // 发送数据包超时
  private static _packageReceiveTimeout = 6000; // 接收数据包超时
  private static _operationTimeout = 100000; // 长时间操作超时（如芯片擦除）

  // 页面大小配置的有效范围
  private static readonly MIN_PAGE_SIZE = 0x100; // 256 bytes
  private static readonly MAX_PAGE_SIZE = 0x10000; // 64KB

  // 超时配置的有效范围
  private static readonly MIN_TIMEOUT = 1000; // 1秒
  private static readonly MAX_TIMEOUT = 300000; // 5分钟

  // 页面大小 getter/setter
  static get romPageSize(): number {
    return this._romPageSize;
  }

  static set romPageSize(value: number) {
    this._romPageSize = this.validatePageSize(value);
    this.saveSettings();
  }

  static get ramPageSize(): number {
    return this._ramPageSize;
  }

  static set ramPageSize(value: number) {
    this._ramPageSize = this.validatePageSize(value);
    this.saveSettings();
  }

  // 超时时间 getter/setter
  static get defaultTimeout(): number {
    return this._defaultTimeout;
  }

  static set defaultTimeout(value: number) {
    this._defaultTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get packageSendTimeout(): number {
    return this._packageSendTimeout;
  }

  static set packageSendTimeout(value: number) {
    this._packageSendTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get packageReceiveTimeout(): number {
    return this._packageReceiveTimeout;
  }

  static set packageReceiveTimeout(value: number) {
    this._packageReceiveTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get operationTimeout(): number {
    return this._operationTimeout;
  }

  static set operationTimeout(value: number) {
    this._operationTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  /**
   * 验证页面大小是否在有效范围内
   */
  private static validatePageSize(size: number): number {
    if (size < this.MIN_PAGE_SIZE) {
      console.warn(`页面大小 ${size} 小于最小值 ${this.MIN_PAGE_SIZE}，已调整为最小值`);
      return this.MIN_PAGE_SIZE;
    }
    if (size > this.MAX_PAGE_SIZE) {
      console.warn(`页面大小 ${size} 大于最大值 ${this.MAX_PAGE_SIZE}，已调整为最大值`);
      return this.MAX_PAGE_SIZE;
    }
    // 检查是否是2的幂
    if ((size & (size - 1)) !== 0) {
      console.warn(`页面大小 ${size} 不是2的幂，可能会导致性能问题`);
    }
    return size;
  }

  /**
   * 验证超时时间是否在有效范围内
   */
  private static validateTimeout(timeout: number): number {
    if (timeout < this.MIN_TIMEOUT) {
      console.warn(`超时时间 ${timeout}ms 小于最小值 ${this.MIN_TIMEOUT}ms，已调整为最小值`);
      return this.MIN_TIMEOUT;
    }
    if (timeout > this.MAX_TIMEOUT) {
      console.warn(`超时时间 ${timeout}ms 大于最大值 ${this.MAX_TIMEOUT}ms，已调整为最大值`);
      return this.MAX_TIMEOUT;
    }
    return timeout;
  }

  /**
   * 获取所有设置的配置对象
   */
  static getSettings() {
    return {
      pageSize: {
        rom: this._romPageSize,
        ram: this._ramPageSize
      },
      timeout: {
        default: this._defaultTimeout,
        packageSend: this._packageSendTimeout,
        packageReceive: this._packageReceiveTimeout,
        operation: this._operationTimeout
      }
    };
  }

  /**
   * 批量设置配置
   */
  static setSettings(settings: {
    pageSize?: {
      rom?: number;
      ram?: number;
    };
    timeout?: {
      default?: number;
      packageSend?: number;
      packageReceive?: number;
      operation?: number;
    };
  }): void {
    if (settings.pageSize) {
      if (settings.pageSize.rom !== undefined) {
        this.romPageSize = settings.pageSize.rom;
      }
      if (settings.pageSize.ram !== undefined) {
        this.ramPageSize = settings.pageSize.ram;
      }
    }

    if (settings.timeout) {
      if (settings.timeout.default !== undefined) {
        this.defaultTimeout = settings.timeout.default;
      }
      if (settings.timeout.packageSend !== undefined) {
        this.packageSendTimeout = settings.timeout.packageSend;
      }
      if (settings.timeout.packageReceive !== undefined) {
        this.packageReceiveTimeout = settings.timeout.packageReceive;
      }
      if (settings.timeout.operation !== undefined) {
        this.operationTimeout = settings.timeout.operation;
      }
    }
  }

  /**
   * 重置为默认设置
   */
  static resetToDefaults(): void {
    this._romPageSize = 0x1000; // 4KB
    this._ramPageSize = 0x800; // 1KB
    this._defaultTimeout = 3000; // 3秒
    this._packageSendTimeout = 3000; // 3秒
    this._packageReceiveTimeout = 3000; // 3秒
    this._operationTimeout = 30000; // 30秒
    this.saveSettings();
  }

  /**
   * 从localStorage加载设置
   */
  static loadSettings(): void {
    try {
      const saved = localStorage.getItem('advanced_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.setSettings(settings);
      }
    } catch (error) {
      console.warn('加载高级设置失败，使用默认设置:', error);
      this.resetToDefaults();
    }
  }

  /**
   * 保存设置到localStorage
   */
  public static saveSettings(): void {
    try {
      const settings = this.getSettings();
      localStorage.setItem('advanced_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('保存高级设置失败:', error);
    }
  }

  /**
   * 初始化高级设置
   */
  static init(): void {
    this.loadSettings();
    console.log('高级设置已初始化:', this.getSettings());
  }

  /**
   * 获取设置的限制信息
   */
  static getLimits() {
    return {
      pageSize: {
        min: this.MIN_PAGE_SIZE,
        max: this.MAX_PAGE_SIZE
      },
      timeout: {
        min: this.MIN_TIMEOUT,
        max: this.MAX_TIMEOUT
      }
    };
  }

  /**
   * 验证设置是否有效
   */
  static validateSettings(settings: Partial<ReturnType<typeof AdvancedSettings.getSettings>>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.pageSize) {
      if (settings.pageSize.rom !== undefined) {
        if (settings.pageSize.rom < this.MIN_PAGE_SIZE || settings.pageSize.rom > this.MAX_PAGE_SIZE) {
          errors.push(`ROM页面大小必须在 ${this.MIN_PAGE_SIZE} - ${this.MAX_PAGE_SIZE} 之间`);
        }
      }
      if (settings.pageSize.ram !== undefined) {
        if (settings.pageSize.ram < this.MIN_PAGE_SIZE || settings.pageSize.ram > this.MAX_PAGE_SIZE) {
          errors.push(`RAM页面大小必须在 ${this.MIN_PAGE_SIZE} - ${this.MAX_PAGE_SIZE} 之间`);
        }
      }
    }

    if (settings.timeout) {
      Object.entries(settings.timeout).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (value < this.MIN_TIMEOUT || value > this.MAX_TIMEOUT) {
            errors.push(`${key}超时时间必须在 ${this.MIN_TIMEOUT}ms - ${this.MAX_TIMEOUT}ms 之间`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
