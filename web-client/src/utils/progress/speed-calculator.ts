/**
 * 滑动窗口数据点接口
 */
interface SpeedDataPoint {
  time: number;
  bytes: number;
}

/**
 * 滑动窗口速度计算器
 */
export class SpeedCalculator {
  private speedWindow: SpeedDataPoint[] = [];
  private timeWindow: number; // ms，滑动窗口的时间长度
  private minValidElapsed = 500; // ms，小于此值时，不更新maxSpeed，防止速率虚高
  private currentSpeed = 0;
  private peakSpeed = 0;
  private maxSpeed = 0;
  private smoothingFactor = 0.3; // 指数平滑因子 (0~1)，越大越敏感
  private totalBytes = 0;
  // 用于整体平均速率计算
  private startTime: number | null = null;
  private lastTimestamp = 0;

  /**
   * 构造函数
   * @param windowSize - 滑动窗口大小
   */
  constructor(timeWindowMs = 3000) {
    this.timeWindow = timeWindowMs;
    this.startTime = Date.now();
  }

  /**
   * 添加一个数据点到滑动窗口
   * @param bytes - 传输的字节数
   * @param timestamp - 时间戳，默认为当前时间
   */
  addDataPoint(bytes: number, timestamp: number = Date.now()): void {
    // 初始化整体起始时间，并更新最后时间戳
    this.startTime ??= timestamp;
    this.lastTimestamp = timestamp;
    this.totalBytes += Math.max(0, bytes);

    this.speedWindow.push({
      time: timestamp,
      bytes: bytes,
    });

    // 剔除时间窗口之外的数据点
    const cutoff = timestamp - this.timeWindow;
    while (this.speedWindow.length && this.speedWindow[0].time < cutoff) {
      this.speedWindow.shift();
    }

    this.calculateCurrentSpeed();
  }

  /**
   * 计算当前速度（基于滑动窗口）
   * @returns 当前速度，单位为 K/s
   */
  calculateCurrentSpeed(): number {
    const start = this.speedWindow.length === 1 && this.startTime ? this.startTime : this.speedWindow[0].time;
    const end = this.speedWindow[this.speedWindow.length - 1].time;
    const elapsedMs = end - start;

    const windowBytes = this.speedWindow.reduce((sum, item) => sum + item.bytes, 0);
    const rawSpeed = elapsedMs > 0 ? windowBytes / (elapsedMs / 1000) : 0;

    // 平滑：当前速度使用指数移动平均（EMA）
    this.currentSpeed = this.smoothingFactor * rawSpeed + (1 - this.smoothingFactor) * this.currentSpeed;

    // 立即更新峰值速率
    this.peakSpeed = Math.max(this.peakSpeed, rawSpeed);

    // 仅在窗口时间足够时更新 maxSpeed，避免瞬时波动影响
    if (elapsedMs >= this.minValidElapsed) {
      this.maxSpeed = Math.max(this.maxSpeed, this.currentSpeed);
    }

    return this.currentSpeed;
  }

  /**
   * 获取当前速度，单位 B/s
   */
  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * 获取历史最大速度
   * @returns 历史最大速度，单位为 B/s
   */
  getMaxSpeed(): number {
    return this.maxSpeed === 0 ? this.getPeakSpeed() : this.maxSpeed;
  }

  getPeakSpeed(): number {
    return this.peakSpeed;
  }

  /**
   * 计算平均速度
   * @returns 平均速度，单位为 B/s
   */
  getAverageSpeed(): number {
    // 如果没有累计数据或起始时间未设置，返回0
    if (this.startTime === null || this.totalBytes === 0 || this.lastTimestamp <= this.startTime) {
      return 0;
    }
    // 计算从起始到最新数据点的总时间（秒）
    const totalTimeSeconds = Math.max((this.lastTimestamp - this.startTime) / 1000, 0.001);
    // 计算整体平均速度，单位 B/s
    return this.totalBytes / totalTimeSeconds;
  }

  getTotalTime(): number {
    // 如果没有累计数据或起始时间未设置，返回0
    if (this.startTime === null || this.lastTimestamp <= this.startTime) {
      return 0;
    }
    // 计算从起始到最新数据点的总时间（秒）
    return (this.lastTimestamp - this.startTime) / 1000;
  }

  /**
   * 重置速度计算器
   */
  reset(): void {
    this.speedWindow = [];
    this.currentSpeed = 0;
    this.peakSpeed = 0;
    this.maxSpeed = 0;
    this.totalBytes = 0;
    this.startTime = null;
    this.lastTimestamp = 0;
  }
}
