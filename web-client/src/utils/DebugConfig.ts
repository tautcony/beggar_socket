/**
 * 调试配置类
 * 用于在开发模式下模拟设备行为
 */
export class DebugConfig {
  // 是否启用调试模式
  private static _enabled = false;

  // 模拟延迟时间（毫秒）
  private static _simulatedDelay = 1000;

  // 模拟进度更新间隔（毫秒）
  private static _progressUpdateInterval = 100;

  // 是否模拟错误
  private static _simulateErrors = false;

  // 错误模拟概率 (0-1)
  private static _errorProbability = 0.1;

  static get enabled(): boolean {
    return this._enabled;
  }

  static set enabled(value: boolean) {
    this._enabled = value;
    localStorage.setItem('debug_mode', value.toString());
  }

  static get simulatedDelay(): number {
    return this._simulatedDelay;
  }

  static set simulatedDelay(value: number) {
    this._simulatedDelay = Math.max(0, value);
  }

  static get progressUpdateInterval(): number {
    return this._progressUpdateInterval;
  }

  static set progressUpdateInterval(value: number) {
    this._progressUpdateInterval = Math.max(50, value);
  }

  static get simulateErrors(): boolean {
    return this._simulateErrors;
  }

  static set simulateErrors(value: boolean) {
    this._simulateErrors = value;
  }

  static get errorProbability(): number {
    return this._errorProbability;
  }

  static set errorProbability(value: number) {
    this._errorProbability = Math.max(0, Math.min(1, value));
  }

  /**
   * 初始化调试配置
   */
  static init(): void {
    // 从localStorage恢复设置
    const saved = localStorage.getItem('debug_mode');
    if (saved !== null) {
      this._enabled = saved === 'true';
    }

    // console.log(`调试模式初始化: ${this._enabled ? '启用' : '禁用'}`)
  }

  /**
   * 切换调试模式
   */
  static toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * 模拟异步延迟
   */
  static async delay(customDelay?: number): Promise<void> {
    if (!this.enabled) return;

    const delay = customDelay ?? this._simulatedDelay;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 检查是否应该模拟错误
   */
  static shouldSimulateError(): boolean {
    if (!this.enabled || !this._simulateErrors) return false;
    return Math.random() < this._errorProbability;
  }

  /**
   * 模拟进度更新
   */
  static async simulateProgress(
    callback: (progress: number, detail?: string) => void,
    totalTime: number = 3000,
    detail?: string
  ): Promise<void> {
    if (!this.enabled) return;

    const steps = Math.floor(totalTime / this._progressUpdateInterval);

    for (let i = 0; i <= steps; i++) {
      const progress = Math.min(100, (i / steps) * 100);
      callback(progress, detail);

      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, this._progressUpdateInterval));
      }
    }
  }

  /**
   * 生成随机数据
   */
  static generateRandomData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    return data;
  }

  /**
   * 创建模拟的 SerialPort 设备
   */
  static createMockSerialPort(): SerialPort {
    // 创建模拟的可读流
    const mockReadableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // 模拟设备响应数据
        const mockResponses = [
          new Uint8Array([0x01, 0x02, 0x03, 0x04]), // 模拟ID响应
          new Uint8Array([0x00]), // 模拟成功响应
        ];
        let responseIndex = 0;

        // 定期推送模拟数据
        setInterval(() => {
          if (responseIndex < mockResponses.length) {
            controller.enqueue(mockResponses[responseIndex]);
            responseIndex++;
          }
        }, 100);
      }
    });

    // 创建模拟的可写流
    const mockWritableStream = new WritableStream<Uint8Array>({
      write(chunk) {
        console.log('Mock SerialPort: 接收到数据', chunk);
        return Promise.resolve();
      }
    });

    // 创建模拟的 SerialPort
    return {
      readable: mockReadableStream,
      writable: mockWritableStream,

      // 模拟串口信息
      getInfo: () => ({
        usbVendorId: 0x1234,
        usbProductId: 0x5678
      }),

      // 模拟信号控制
      getSignals: () => Promise.resolve({
        dataCarrierDetect: false,
        clearToSend: false,
        ringIndicator: false,
        dataSetReady: false
      }),

      setSignals: (signals: SerialOutputSignals) => {
        console.log('Mock SerialPort: 设置信号', signals);
        return Promise.resolve();
      },

      // 模拟打开/关闭
      open: (options: SerialOptions) => {
        console.log('Mock SerialPort: 打开端口', options);
        return Promise.resolve();
      },

      close: () => {
        console.log('Mock SerialPort: 关闭端口');
        return Promise.resolve();
      },

      // 模拟设备移除事件
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => false,
      onconnect: (ev: Event) => {},
      ondisconnect: (ev: Event) => {},
      connected: true,
      forget: () =>  Promise.resolve(),
    } as SerialPort;
  }

  /**
   * 创建模拟的 DeviceInfo
   */
  static createMockDeviceInfo() {
    const mockPort = this.createMockSerialPort();
    return {
      port: mockPort,
      reader: null,
      writer: null
    };
  }
}

// 初始化调试配置
DebugConfig.init();
