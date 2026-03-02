import type { CartridgeAdapter } from '@/services/cartridge-adapter';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { ProgressInfo } from '@/types/progress-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface BurnerLogEntry {
  time: string;
  message: string;
  level: LogLevel;
}

export interface BurnerOperationContext {
  adapter: CartridgeAdapter;
  cfiInfo: CFIInfo;
  options: CommandOptions;
  signal?: AbortSignal;
}

export interface BurnerReadCartResult extends CommandResult {
  cfiInfo?: CFIInfo;
  chipId?: number[];
  romSizeHex?: string;
}

export interface BurnerSessionState {
  busy: boolean;
  abortController: AbortController | null;
  progress: ProgressInfo;
  logs: BurnerLogEntry[];
}
