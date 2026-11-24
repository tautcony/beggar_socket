import type { ConnectionAttemptContext, DeviceDiagnostic } from '@/device/session';

import type { BurnerConnectionHandle, BurnerConnectionSelection, BurnerConnectionSession } from './ports';

export type ConnectionState = 'idle' | 'selecting' | 'connecting' | 'connected' | 'disconnecting' | 'failed';
export type ConnectionFailureStage =
  | 'list'
  | 'select'
  | 'connect'
  | 'init'
  | 'probe'
  | 'resolve'
  | 'initialize'
  | 'disconnect'
  | 'unknown';

export type ConnectionFailureCode =
  | 'list_failed'
  | 'selection_required'
  | 'selection_invalid'
  | 'select_failed'
  | 'connect_failed'
  | 'init_failed'
  | 'probe_failed'
  | 'resolve_failed'
  | 'initialize_failed'
  | 'disconnect_failed'
  | 'stale_context'
  | 'unknown';

export interface ConnectionFailure {
  stage: ConnectionFailureStage;
  code: ConnectionFailureCode;
  message: string;
  cause?: unknown;
  /** Stage-aware diagnostics for the UI; never derived from log text. */
  diagnostics?: readonly DeviceDiagnostic[];
  /**
   * Structured discovery of the failed attempt, so a failure reports the selected variant,
   * the port and the match result exactly like a committed profile does.
   */
  context?: ConnectionAttemptContext;
}

export interface ConnectionContext {
  generation: number;
  selection: BurnerConnectionSelection | null;
  handle: BurnerConnectionHandle | null;
  /** Committed session of `handle`; cleared as soon as the connection is released. */
  session?: BurnerConnectionSession | null;
  /**
   * Resource of a released connection whose close failed.
   *
   * It is deliberately not `handle`: the old session, identity and adapter are invalid the
   * moment the release starts, so nothing may treat this as an active connection. Only the
   * cleanup path retries its close, and a new connection attempt must succeed at that
   * cleanup before it opens another port.
   */
  pendingCleanup?: BurnerConnectionHandle | null;
}

export interface ConnectionSnapshot {
  state: ConnectionState;
  context: ConnectionContext;
  lastFailure?: ConnectionFailure;
}

export interface ConnectionUseCaseResult {
  success: boolean;
  state: ConnectionState;
  context: ConnectionContext;
  failure?: ConnectionFailure;
  /** Non-fatal diagnostics of the completed step (e.g. teardown warnings). */
  diagnostics?: readonly DeviceDiagnostic[];
}

export interface ConnectionCommandResult extends ConnectionUseCaseResult {
  message: string;
}
