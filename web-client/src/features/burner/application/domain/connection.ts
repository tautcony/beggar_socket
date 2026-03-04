import type { BurnerConnectionHandle, BurnerConnectionSelection } from './ports';

export type ConnectionState = 'idle' | 'selecting' | 'connecting' | 'connected' | 'disconnecting' | 'failed';
export type ConnectionFailureStage = 'list' | 'select' | 'connect' | 'init' | 'disconnect' | 'unknown';

export type ConnectionFailureCode =
  | 'list_failed'
  | 'selection_required'
  | 'select_failed'
  | 'connect_failed'
  | 'init_failed'
  | 'disconnect_failed'
  | 'stale_context'
  | 'unknown';

export interface ConnectionFailure {
  stage: ConnectionFailureStage;
  code: ConnectionFailureCode;
  message: string;
  cause?: unknown;
}

export interface ConnectionContext {
  generation: number;
  selection: BurnerConnectionSelection | null;
  handle: BurnerConnectionHandle | null;
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
}

export interface ConnectionCommandResult extends ConnectionUseCaseResult {
  message: string;
}
