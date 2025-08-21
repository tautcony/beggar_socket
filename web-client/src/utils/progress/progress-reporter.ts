import { ProgressInfo, SectorProgressInfo } from '@/types/progress-info';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';

/**
 * GBAAdapter 的进度报告辅助类
 */
export class ProgressReporter {
  private operationType: 'erase' | 'write' | 'read' | 'verify' | 'other';
  private totalBytes: number;
  private startTime: number;
  private sectors: SectorProgressInfo[] = [];
  private updateCallback: (progressInfo: ProgressInfo) => void;
  private translateFunc: (key: string, params?: Record<string, unknown>) => string;

  constructor(
    operationType: 'erase' | 'write' | 'read' | 'verify' | 'other',
    totalBytes: number,
    updateCallback: (progressInfo: ProgressInfo) => void,
    translateFunc: (key: string, params?: Record<string, unknown>) => string,
  ) {
    this.operationType = operationType;
    this.totalBytes = totalBytes;
    this.startTime = Date.now();
    this.updateCallback = updateCallback;
    this.translateFunc = translateFunc;
  }

  /**
   * 设置扇区信息
   */
  setSectors(sectors: SectorProgressInfo[]): void {
    this.sectors = sectors;
  }

  /**
   * 报告开始状态
   */
  reportStart(message: string): void {
    const progress = ProgressInfoBuilder.running(this.operationType)
      .detail(message)
      .bytes(0, this.totalBytes)
      .startTime(this.startTime)
      .build();

    this.updateCallback(progress);
  }

  /**
   * 报告运行中的进度
   */
  reportProgress(
    transferredBytes: number,
    currentSpeed: number,
    message: string,
    completedSectors = 0,
    currentSectorIndex = -1,
  ): void {
    const builder = ProgressInfoBuilder.running(this.operationType)
      .bytes(transferredBytes, this.totalBytes)
      .detail(message)
      .startTime(this.startTime)
      .speed(currentSpeed);

    if (this.sectors.length > 0) {
      builder.sectors(this.sectors, completedSectors, currentSectorIndex);
    }

    this.updateCallback(builder.build());
  }

  /**
   * 报告完成状态
   */
  reportCompleted(message: string, avgSpeed: number): void {
    const builder = ProgressInfoBuilder.completed(this.operationType)
      .detail(message)
      .bytes(this.totalBytes, this.totalBytes)
      .startTime(this.startTime)
      .speed(avgSpeed);

    if (this.sectors.length > 0) {
      builder.sectors(this.sectors, this.sectors.length, -1);
    }

    this.updateCallback(builder.build());
  }

  /**
   * 报告错误状态
   */
  reportError(message: string): void {
    const progress = ProgressInfoBuilder.error(this.operationType, message)
      .build();

    this.updateCallback(progress);
  }

  /**
   * 更新扇区状态
   */
  updateSectorProgress(address: number, state: 'pending' | 'processing' | 'completed' | 'error'): number {
    const sectorIndex = this.sectors.findIndex(s =>
      address >= s.address && address < s.address + s.size,
    );

    if (sectorIndex >= 0) {
      this.sectors[sectorIndex].state = state;
    }

    return sectorIndex;
  }

  /**
   * 更新地址范围内的扇区状态
   */
  updateSectorRangeProgress(
    startAddress: number,
    endAddress: number,
    state: 'pending' | 'processing' | 'completed' | 'error',
  ): void {
    for (const sector of this.sectors) {
      if (sector.address >= startAddress && sector.address <= endAddress) {
        sector.state = state;
      }
    }
  }
}
