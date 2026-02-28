export interface SectorProgressInfo {
  address: number
  size: number
  state: 'pending' | 'processing' | 'completed' | 'error'
}

export type SectorSizeClass = 'small' | 'medium' | 'large';

export type SectorStateCode = 0 | 1 | 2 | 3; // 0=pending,1=processing,2=completed,3=error

export interface ProgressInfo {
  type?: 'erase' | 'write' | 'read' | 'verify' | 'other'
  progress?: number | null
  detail?: string
  totalBytes?: number
  transferredBytes?: number
  startTime?: number
  currentSpeed?: number // KiB/s
  allowCancel?: boolean,
  state?: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  showProgress?: boolean // 是否显示进度面板
  // 扇区级别的可视化进度
  sectorProgress?: {
    totalSectors: number
    completedSectors: number
    currentSectorIndex: number
    addresses: number[]
    sizes: number[]
    sizeClasses: SectorSizeClass[]
    stateBuffer: Uint8Array
  }
}
