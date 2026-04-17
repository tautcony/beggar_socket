export type BurnerLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface BurnerLogMessage {
  message: string;
  error?: string;
  details?: string;
}

export interface BurnerLogEntry extends BurnerLogMessage {
  time: string;
  level: BurnerLogLevel;
}
