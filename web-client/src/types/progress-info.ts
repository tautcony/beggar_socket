export interface ProgressInfo {
  progress?: number | null
  detail?: string
  totalBytes?: number
  transferredBytes?: number
  startTime?: number
  currentSpeed?: number // KB/s
  allowCancel?: boolean
}
