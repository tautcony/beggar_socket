import type { CommandError } from './command-error';

export type BurnerLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface BurnerLogMessage {
  message: string;
  error?: string;
  details?: string;
  diagnostic?: CommandError;
}

export interface BurnerLogEntry extends BurnerLogMessage {
  time: string;
  level: BurnerLogLevel;
}
