import type { BurnerLogEntry, BurnerLogLevel } from '@/types/burner-log';
import type { ProgressInfo } from '@/types/progress-info';

export type LogLevel = BurnerLogLevel;
export type { BurnerLogEntry };

export interface BurnerSessionState {
  busy: boolean;
  abortController: AbortController | null;
  progress: ProgressInfo;
  logs: BurnerLogEntry[];
}
