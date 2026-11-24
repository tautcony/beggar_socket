import type { ConnectionPlan, DeviceDiagnostic, SessionProfile } from '@/device/session';
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
  /**
   * Connection plan of this attempt. It is created once by whoever opens the port and
   * travels with the selection so the session transaction resolves exactly the values the
   * port was opened with.
   */
  plan?: ConnectionPlan;
}

export interface BurnerConnectionSelectOptions {
  filter?: PortFilter;
  baudRate?: number;
  skipSignalInit?: boolean;
  plan?: ConnectionPlan;
}

/**
 * Committed session of one connection: the immutable resolved profile plus the
 * diagnostics produced while establishing it (`port-mismatch`, probe skips, ...).
 *
 * The profile is the only device/firmware authority for the connection; `probeFacts`
 * exists solely for the legacy `DeviceInfo` facade and is never consulted for behavior.
 */
export interface BurnerConnectionSession {
  readonly connectionId: string;
  readonly profile: SessionProfile;
  readonly diagnostics: readonly DeviceDiagnostic[];
  readonly probeFacts?: unknown;
}

export interface BurnerConnectionPort {
  list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>>;
  select(options?: BurnerConnectionSelectOptions): Promise<BurnerDomainResult<BurnerConnectionSelection | null>>;
  connect(selection?: BurnerConnectionSelection | null): Promise<BurnerDomainResult<BurnerConnectionHandle>>;
  init(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>>;
  /**
   * Probe → resolve → initialize inside the connection transaction. A port that provides
   * sessions must implement it; ports without it (tests, legacy harnesses) simply commit
   * the transport-level connection.
   */
  establishSession?(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<BurnerConnectionSession>>;
  /**
   * Rebuilds a selection for a port the user already authorized, using this attempt's
   * options. Present only for ports whose authorization survives a failed attempt
   * (Web Serial keeps the grant), so a retry never re-prompts for the same port.
   */
  reuseSelection?(selection: BurnerConnectionSelection, options?: BurnerConnectionSelectOptions): BurnerConnectionSelection;
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
