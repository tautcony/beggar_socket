import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { ProgressInfo } from '@/types/progress-info';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';

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

export interface BurnerConnectionPort {
  list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>>;
  select(): Promise<BurnerDomainResult<BurnerConnectionSelection | null>>;
  connect(selection?: BurnerConnectionSelection | null): Promise<BurnerDomainResult<BurnerConnectionHandle>>;
  init(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>>;
  disconnect(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>>;
}

export interface BurnerProtocolSession {
  readonly id: string;
  isActive?: () => boolean;
  getCartInfo(enable5V?: boolean): Promise<CFIInfo | false>;
  eraseSectors(sectorInfo: SectorBlock[], options: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  writeROM(data: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult>;
  readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress?: boolean): Promise<CommandResult>;
  verifyROM(data: Uint8Array, options: CommandOptions, signal: AbortSignal): Promise<CommandResult>;
  writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult>;
  readRAM(size: number, options?: CommandOptions): Promise<CommandResult>;
  verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult>;
  resetCommandBuffer(): Promise<void>;
}

export interface BurnerProtocolPort {
  readCartInfo(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerDomainResult<CFIInfo>>;
  eraseSectors(
    session: BurnerProtocolSession,
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>>;
  writeRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>>;
  readRom(
    session: BurnerProtocolSession,
    size: number,
    options: CommandOptions,
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<BurnerDomainResult<CommandResult>>;
  verifyRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: CommandOptions,
    signal: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>>;
  writeRam(session: BurnerProtocolSession, data: Uint8Array, options?: CommandOptions): Promise<BurnerDomainResult<CommandResult>>;
  readRam(session: BurnerProtocolSession, size: number, options?: CommandOptions): Promise<BurnerDomainResult<CommandResult>>;
  verifyRam(session: BurnerProtocolSession, data: Uint8Array, options?: CommandOptions): Promise<BurnerDomainResult<CommandResult>>;
  resetCommandBuffer(session: BurnerProtocolSession): Promise<BurnerDomainResult<void>>;
}

export interface BurnerSessionPort {
  readonly snapshot: BurnerSessionState;
  startOperation(cancellable?: boolean): AbortSignal | undefined;
  completeOperation(): void;
  abortOperation(): void;
  updateProgress(info: ProgressInfo): void;
  resetProgress(): void;
}
