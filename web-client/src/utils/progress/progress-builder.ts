import { ProgressInfo, SectorProgressInfo } from '@/types/progress-info';

/**
 * ProgressInfo Builder - 解决参数地狱问题
 *
 * Linus 说过："如果你需要超过3-4个参数，你的数据结构设计就错了"
 * 这个 Builder 让我们能一步步构建复杂的进度信息，而不是传递一堆参数
 */
export class ProgressInfoBuilder {
  private info: ProgressInfo = {};

  /**
   * 设置操作类型
   */
  type(type: 'erase' | 'write' | 'read' | 'verify' | 'other'): this {
    this.info.type = type;
    return this;
  }

  /**
   * 设置进度百分比 (0-100)
   */
  progress(progress: number): this {
    this.info.progress = Math.max(0, Math.min(100, progress));
    return this;
  }

  /**
   * 设置详细信息/状态消息
   */
  detail(detail: string): this {
    this.info.detail = detail;
    return this;
  }

  /**
   * 设置字节信息
   */
  bytes(transferred: number, total: number): this {
    this.info.transferredBytes = transferred;
    this.info.totalBytes = total;

    // 自动计算进度百分比，除非已经手动设置
    if (this.info.progress === undefined && total > 0) {
      this.info.progress = (transferred / total) * 100;
    }

    return this;
  }

  /**
   * 设置开始时间 (用于计算耗时)
   */
  startTime(startTime: number): this {
    this.info.startTime = startTime;
    return this;
  }

  /**
   * 设置当前速度 (KiB/s)
   */
  speed(speed: number): this {
    this.info.currentSpeed = speed;
    return this;
  }

  /**
   * 设置是否允许取消
   */
  cancellable(allow = true): this {
    this.info.allowCancel = allow;
    return this;
  }

  /**
   * 设置状态
   */
  state(state: 'idle' | 'running' | 'paused' | 'completed' | 'error'): this {
    this.info.state = state;
    return this;
  }

  /**
   * 设置扇区进度信息
   */
  sectors(
    sectors: SectorProgressInfo[],
    completedCount: number,
    currentIndex: number,
  ): this {
    this.info.sectorProgress = {
      sectors,
      totalSectors: sectors.length,
      completedSectors: completedCount,
      currentSectorIndex: currentIndex,
    };
    return this;
  }

  /**
   * 构建最终的 ProgressInfo 对象
   */
  build(): ProgressInfo {
    // 创建副本，避免意外修改
    return { ...this.info };
  }

  /**
   * 重置 builder 以便复用
   */
  reset(): this {
    this.info = {};
    return this;
  }

  /**
   * 静态工厂方法 - 创建新的 builder
   */
  static create(): ProgressInfoBuilder {
    return new ProgressInfoBuilder();
  }

  /**
   * 静态工厂方法 - 创建运行中的操作
   */
  static running(type: 'erase' | 'write' | 'read' | 'verify' | 'other'): ProgressInfoBuilder {
    return new ProgressInfoBuilder()
      .type(type)
      .state('running')
      .cancellable(true);
  }

  /**
   * 静态工厂方法 - 创建完成的操作
   */
  static completed(type: 'erase' | 'write' | 'read' | 'verify' | 'other'): ProgressInfoBuilder {
    return new ProgressInfoBuilder()
      .type(type)
      .state('completed')
      .progress(100)
      .cancellable(false);
  }

  /**
   * 静态工厂方法 - 创建错误状态
   */
  static error(type: 'erase' | 'write' | 'read' | 'verify' | 'other', message: string): ProgressInfoBuilder {
    return new ProgressInfoBuilder()
      .type(type)
      .state('error')
      .detail(message)
      .cancellable(false);
  }
}
