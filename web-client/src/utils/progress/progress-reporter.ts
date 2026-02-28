import {
  ProgressInfo,
  SectorProgressInfo,
  type SectorSizeClass,
  type SectorStateCode,
} from '@/types/progress-info';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';

/**
 * Adapter 的进度报告辅助类
 */
export class ProgressReporter {
  private operationType: 'erase' | 'write' | 'read' | 'verify' | 'other';
  private totalBytes: number;
  private startTime: number;
  private sectors: SectorProgressInfo[] = [];
  private sectorAddresses: number[] = [];
  private sectorSizes: number[] = [];
  private sectorSizeClasses: SectorSizeClass[] = [];
  private sectorStateBuffer: Uint8Array = new Uint8Array(0);
  private updateCallback: (progressInfo: ProgressInfo) => void;
  private showProgress: boolean;

  constructor(
    operationType: 'erase' | 'write' | 'read' | 'verify' | 'other',
    totalBytes: number,
    updateCallback: (progressInfo: ProgressInfo) => void,
    _translateFunc: (key: string, params?: Record<string, unknown>) => string,
    showProgress = true,
  ) {
    this.operationType = operationType;
    this.totalBytes = totalBytes;
    this.startTime = Date.now();
    this.updateCallback = updateCallback;
    this.showProgress = showProgress;
  }

  /**
   * 设置扇区信息
   */
  setSectors(sectors: SectorProgressInfo[]): void {
    // Keep an internal immutable copy to avoid mutating adapter-owned arrays.
    this.sectors = sectors.map((sector) => ({ ...sector }));
    this.sectorAddresses = this.sectors.map((sector) => sector.address);
    this.sectorSizes = this.sectors.map((sector) => sector.size);
    this.sectorSizeClasses = this.sectors.map((sector) => this.getSectorSizeClass(sector.size));
    this.sectorStateBuffer = Uint8Array.from(this.sectors.map((sector) => this.encodeSectorState(sector.state)));
  }

  /**
   * 重置所有扇区状态为pending
   */
  resetSectorsState(): void {
    this.sectors = this.sectors.map((sector) => ({ ...sector, state: 'pending' as const }));
    this.sectorStateBuffer = new Uint8Array(this.sectorStateBuffer.length);
  }

  /**
   * 报告开始状态
   */
  reportStart(message: string): void {
    const builder = ProgressInfoBuilder.running(this.operationType)
      .detail(message)
      .bytes(0, this.totalBytes)
      .startTime(this.startTime)
      .showProgress(this.showProgress);

    if (this.sectors.length > 0) {
      builder.sectorProgress(this.getSectorMetaSnapshot(), 0, -1);
    }

    this.updateCallback(builder.build());
  }

  /**
   * 报告运行中的进度（实时上报，不限流）
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
      .speed(currentSpeed)
      .showProgress(this.showProgress);

    if (this.sectors.length > 0) {
      builder.sectorProgress(this.getSectorMetaSnapshot(), completedSectors, currentSectorIndex);
    }

    this.updateCallback(builder.build());
  }

  emitProgress(
    transferredBytes: number,
    currentSpeed: number,
    message: string,
    activeAddress?: number,
  ): void {
    if (this.sectors.length === 0) {
      this.reportProgress(transferredBytes, currentSpeed, message);
      return;
    }
    const currentSectorIndex = activeAddress === undefined
      ? -1
      : this.getCurrentSectorIndexByAddress(activeAddress);
    const completedSectors = this.getCompletedSectorsCount();
    this.reportProgress(transferredBytes, currentSpeed, message, completedSectors, currentSectorIndex);
  }

  /**
   * 报告完成状态
   */
  reportCompleted(message: string, avgSpeed: number): void {
    const builder = ProgressInfoBuilder.completed(this.operationType)
      .detail(message)
      .bytes(this.totalBytes, this.totalBytes)
      .startTime(this.startTime)
      .speed(avgSpeed)
      .showProgress(this.showProgress);

    if (this.sectors.length > 0) {
      builder.sectorProgress(this.getSectorMetaSnapshot(), this.sectors.length, -1);
    }

    this.updateCallback(builder.build());
  }

  /**
   * 报告错误状态
   */
  reportError(message: string): void {
    const progress = ProgressInfoBuilder.error(this.operationType, message)
      .showProgress(this.showProgress)
      .build();

    this.updateCallback(progress);
  }

  /**
   * 更新扇区状态
   */
  markSectorState(address: number, state: 'pending' | 'processing' | 'completed' | 'error'): number {
    const sectorIndex = this.sectors.findIndex(s =>
      address >= s.address && address < s.address + s.size,
    );

    if (sectorIndex >= 0) {
      const current = this.sectors[sectorIndex];
      if (current.state !== state) {
        const next = [...this.sectors];
        next[sectorIndex] = { ...current, state };
        this.sectors = next;
        this.sectorStateBuffer = this.withStateBufferValue(sectorIndex, this.encodeSectorState(state));
      }
    }

    return sectorIndex;
  }

  /**
   * 更新地址范围内的扇区状态
   */
  markSectorRangeState(
    startAddress: number,
    endAddress: number,
    state: 'pending' | 'processing' | 'completed' | 'error',
  ): void {
    let changed = false;
    const next = this.sectors.map((sector) => {
      if (sector.address >= startAddress && sector.address <= endAddress && sector.state !== state) {
        changed = true;
        return { ...sector, state };
      }
      return sector;
    });
    if (changed) {
      this.sectors = next;
      this.sectorStateBuffer = Uint8Array.from(next.map((sector) => this.encodeSectorState(sector.state)));
    }
  }

  getCurrentSectorIndexByAddress(address: number): number {
    return this.sectors.findIndex(s =>
      address >= s.address && address < s.address + s.size,
    );
  }

  getCompletedSectorsCount(): number {
    return this.sectors.filter(s => s.state === 'completed').length;
  }

  private getSectorMetaSnapshot(): {
    addresses: number[];
    sizes: number[];
    sizeClasses: SectorSizeClass[];
    stateBuffer: Uint8Array;
  } {
    return {
      addresses: this.sectorAddresses,
      sizes: this.sectorSizes,
      sizeClasses: this.sectorSizeClasses,
      stateBuffer: new Uint8Array(this.sectorStateBuffer),
    };
  }

  private getSectorSizeClass(sectorSize: number): SectorSizeClass {
    if (sectorSize <= 0x1000) return 'small';
    if (sectorSize <= 0x8000) return 'medium';
    return 'large';
  }

  private encodeSectorState(state: SectorProgressInfo['state']): SectorStateCode {
    if (state === 'processing') return 1;
    if (state === 'completed') return 2;
    if (state === 'error') return 3;
    return 0;
  }

  private withStateBufferValue(index: number, value: SectorStateCode): Uint8Array {
    const next = new Uint8Array(this.sectorStateBuffer);
    next[index] = value;
    return next;
  }
}
