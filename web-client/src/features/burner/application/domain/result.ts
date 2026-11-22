import type { DeviceDiagnostic } from '@/device/session';
import type { ProgressInfo } from '@/types/progress-info';

export type BurnerErrorStage =
  | 'connection'
  | 'select'
  | 'connect'
  | 'probe'
  | 'resolve'
  | 'initialize'
  | 'disconnect'
  | 'transport'
  | 'protocol'
  | 'session'
  | 'unknown';

export type BurnerErrorCode =
  | 'aborted'
  | 'selection_required'
  | 'selection_invalid'
  | 'not_connected'
  | 'list_failed'
  | 'select_failed'
  | 'connect_failed'
  | 'init_failed'
  | 'probe_failed'
  | 'resolve_failed'
  | 'initialize_failed'
  | 'disconnect_failed'
  | 'stale_context'
  | 'timeout'
  | 'profile_ambiguous'
  | 'profile_not_found'
  | 'unsupported'
  | 'voltage_mismatch'
  | 'runtime_error'
  | 'unknown';

export interface BurnerDomainError {
  stage: BurnerErrorStage;
  code: BurnerErrorCode;
  message: string;
  cause?: unknown;
  recoverable: boolean;
  /** Stage diagnostics of the failed step, for logging and UI hints. */
  diagnostics?: readonly DeviceDiagnostic[];
}

export interface BurnerDomainProgress {
  type: ProgressInfo['type'];
  progress: number | null;
  detail: string;
  state: ProgressInfo['state'];
}

export interface BurnerDomainSuccess<TData> {
  ok: true;
  data: TData;
  progress?: BurnerDomainProgress;
  /** Non-fatal diagnostics collected while the step still succeeded. */
  diagnostics?: readonly DeviceDiagnostic[];
}

export interface BurnerDomainFailure {
  ok: false;
  error: BurnerDomainError;
}

export type BurnerDomainResult<TData> = BurnerDomainSuccess<TData> | BurnerDomainFailure;

export function successResult<TData>(
  data: TData,
  progress?: BurnerDomainProgress,
  diagnostics?: readonly DeviceDiagnostic[],
): BurnerDomainSuccess<TData> {
  return {
    ok: true,
    data,
    progress,
    ...(diagnostics && diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function failureResult(error: BurnerDomainError): BurnerDomainFailure {
  return { ok: false, error };
}
