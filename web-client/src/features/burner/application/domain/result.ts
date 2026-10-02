import type { CommandError as BurnerDomainError } from '@/types/command-error';
import type { CommandResult } from '@/types/command-result';
import type { ProgressInfo } from '@/types/progress-info';

export type { CommandError as BurnerDomainError, CommandErrorCode as BurnerErrorCode, CommandErrorStage as BurnerErrorStage } from '@/types/command-error';

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
  commandResult?: CommandResult;
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
