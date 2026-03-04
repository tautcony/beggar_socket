import type { ProgressInfo } from '@/types/progress-info';

export type BurnerErrorStage = 'connection' | 'transport' | 'protocol' | 'session' | 'unknown';

export type BurnerErrorCode =
  | 'aborted'
  | 'selection_required'
  | 'not_connected'
  | 'timeout'
  | 'runtime_error'
  | 'unknown';

export interface BurnerDomainError {
  stage: BurnerErrorStage;
  code: BurnerErrorCode;
  message: string;
  cause?: unknown;
  recoverable: boolean;
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
}

export interface BurnerDomainFailure {
  ok: false;
  error: BurnerDomainError;
}

export type BurnerDomainResult<TData> = BurnerDomainSuccess<TData> | BurnerDomainFailure;

export function successResult<TData>(data: TData, progress?: BurnerDomainProgress): BurnerDomainSuccess<TData> {
  return { ok: true, data, progress };
}

export function failureResult(error: BurnerDomainError): BurnerDomainFailure {
  return { ok: false, error };
}
