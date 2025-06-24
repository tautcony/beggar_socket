/**
 * 滑动窗口数据点接口
 */
interface SpeedDataPoint {
  time: number;
  bytes: number;
}

/**
 * 滑动窗口速度计算器
 * 用于计算传输速度，避免在各个adapter中重复实现相同的逻辑
 */
export class SpeedCalculator {
  private speedWindow: SpeedDataPoint[] = [];
  private maxWindowSize: number;
  private currentSpeed: number = 0;
  private maxSpeed: number = 0;

  /**
   * 构造函数
   * @param windowSize - 滑动窗口大小，默认为20
   */
  constructor(windowSize: number = 20) {
    this.maxWindowSize = windowSize;
  }

  /**
   * 添加一个数据点到滑动窗口
   * @param bytes - 传输的字节数
   * @param timestamp - 时间戳，默认为当前时间
   */
  addDataPoint(bytes: number, timestamp: number = Date.now()): void {
    this.speedWindow.push({
      time: timestamp,
      bytes: bytes,
    });

    // 保持窗口大小
    if (this.speedWindow.length > this.maxWindowSize) {
      this.speedWindow.shift();
    }
    this.calculateCurrentSpeed();
  }

  /**
   * 计算当前速度（基于滑动窗口）
   * @returns 当前速度，单位为 KB/s
   */
  calculateCurrentSpeed(): number {
    if (this.speedWindow.length < 2) {
      return 0;
    }

    const windowStart = this.speedWindow[0].time;
    const windowEnd = this.speedWindow[this.speedWindow.length - 1].time;
    const windowBytes = this.speedWindow.reduce((sum, item) => sum + item.bytes, 0);
    const windowElapsed = (windowEnd - windowStart) / 1000;

    const speed = windowElapsed > 0 ? (windowBytes / 1024) / windowElapsed : 0;
    this.maxSpeed = Math.max(this.maxSpeed, speed);
    this.currentSpeed = speed;

    return speed;
  }

  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * 获取历史最大速度
   * @returns 历史最大速度，单位为 KB/s
   */
  getMaxSpeed(): number {
    return this.maxSpeed;
  }

  /**
   * 重置速度计算器
   */
  reset(): void {
    this.speedWindow = [];
    this.maxSpeed = 0;
  }

  /**
   * 获取当前窗口大小
   * @returns 当前窗口中的数据点数量
   */
  getWindowSize(): number {
    return this.speedWindow.length;
  }

  /**
   * 计算平均速度
   * @param totalBytes - 总字节数
   * @param totalTime - 总时间（秒）
   * @returns 平均速度，单位为 KB/s
   */
  static calculateAverageSpeed(totalBytes: number, totalTime: number): number {
    return totalTime > 0 ? (totalBytes / 1024) / totalTime : 0;
  }
}
