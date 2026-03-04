import type { ProgressInfo } from '@/types/progress-info';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface BurnerLogEntry {
  time: string;
  message: string;
  level: LogLevel;
}

export interface BurnerSessionState {
  busy: boolean;
  abortController: AbortController | null;
  progress: ProgressInfo;
  logs: BurnerLogEntry[];
}
