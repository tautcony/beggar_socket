import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { ProgressInfo } from '@/types/progress-info';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';
import type { PortFilter } from '@/utils/port-filter';

import type { BurnerSessionState } from '../types';
import type { BurnerDomainResult } from './result';

export interface BurnerConnectionHandle {
  id: string;
  platform: 'web' | 'tauri' | 'simulated';
  portInfo?: {
    path?: string;
    manufacturer?: string;
    product?: string;
    vendorId?: string;
    productId?: string;
  };
  context: unknown;
}

export interface BurnerConnectionSelection {
  portInfo?: BurnerConnectionHandle['portInfo'];
  context: unknown;
}

export interface BurnerConnectionSelectOptions {
  filter?: PortFilter;
  baudRate?: number;
  skipSignalInit?: boolean;
}

export interface BurnerConnectionPort {
  list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>>;
  select(options?: BurnerConnectionSelectOptions): Promise<BurnerDomainResult<BurnerConnectionSelection | null>>;
  connect(selection?: BurnerConnectionSelection | null): Promise<BurnerDomainResult<BurnerConnectionHandle>>;
  init(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>>;
  disconnect(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>>;
}

export interface BurnerProtocolSession {
  readonly id: string;
  isActive?: () => boolean;
  getCartInfo(enable5V?: boolean, options?: Partial<CommandOptions>): Promise<CFIInfo | false>;
  getLastCartInfoError?: () => string | undefined;
  getLastCartInfoErrorCode?: () => string | undefined;
  getLastCartInfoErrorDetails?: () => unknown;
  eraseSectors(sectorInfo: SectorBlock[], options: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  writeROM(data: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress?: boolean): Promise<CommandResult>;
  verifyROM(data: Uint8Array, options: CommandOptions, signal: AbortSignal): Promise<CommandResult>;
  writeRAM(data: Uint8Array, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  readRAM(size: number, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  verifyRAM(data: Uint8Array, options?: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  resetCommandBuffer(): Promise<void>;
}

export interface BurnerSessionPort {
  readonly snapshot: BurnerSessionState;
  startOperation(cancellable?: boolean): AbortSignal | undefined;
  completeOperation(): void;
  abortOperation(): void;
  updateProgress(info: ProgressInfo): void;
  resetProgress(): void;
}
