export interface SectorProgressInfo {
  address: number
  size: number
  state: 'pending' | 'erasing' | 'completed' | 'error'
}

export interface ProgressInfo {
  type?: 'erase' | 'write' | 'read' | 'other'
  progress?: number | null
  detail?: string
  totalBytes?: number
  transferredBytes?: number
  startTime?: number
  currentSpeed?: number // KiB/s
  allowCancel?: boolean,
  state?: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  // 扇区级别的可视化进度 (仅用于擦除操作)
  sectorProgress?: {
    sectors: SectorProgressInfo[]
    totalSectors: number
    completedSectors: number
    currentSectorIndex: number
  }
}
