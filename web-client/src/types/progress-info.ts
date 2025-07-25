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
}
