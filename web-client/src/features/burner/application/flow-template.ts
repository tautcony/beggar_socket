import { commandErrorToException, isCommandError } from '@/types/command-error';
import type { ProgressInfo } from '@/types/progress-info';

import type { BurnerSessionPort } from './domain/ports';
import type { BurnerSessionState, LogLevel } from './types';

export interface BurnerFlowContext {
  signal?: AbortSignal;
}

export interface BurnerFlowOptions<TResult> {
  session: BurnerSessionPort;
  cancellable?: boolean;
  /** Execution including command cleanup; excludes success presentation/file dialogs. */
  budgetMs?: number;
  syncState: (snapshot: BurnerSessionState) => void;
  updateProgress?: Partial<ProgressInfo>;
  resetProgressOnFinish?: boolean;
  log?: (message: string, level?: LogLevel) => void;
  cancelLogMessage?: string;
  execute: (context: BurnerFlowContext) => Promise<TResult>;
  onSuccess?: (result: TResult) => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function runBurnerFlow<TResult>(options: BurnerFlowOptions<TResult>): Promise<TResult | undefined> {
  const budgetMs = options.budgetMs;
  if (budgetMs !== undefined && (!Number.isFinite(budgetMs) || budgetMs <= 0)) {
    throw new RangeError('Operation budget must be a positive finite duration');
  }
  const signal = options.session.startOperation((options.cancellable ?? false) || budgetMs !== undefined);
  const token = options.session.snapshot.operationToken;
  let errorOccurred = false;
  let budgetExpired = false;
  const timeoutError = budgetMs === undefined ? undefined : commandErrorToException({
    stage: 'session', code: 'timeout', recoverable: true, operation: 'burner',
    message: `Operation timeout in ${budgetMs}ms`,
  });
  const preserveLateFailure = (failure: unknown) => {
    if (!timeoutError || failure === timeoutError) return;
    // An adapter may report aborted with our reason as its cause. Avoid a cycle.
    if (isCommandError(failure) && failure.cause === timeoutError) {
      const { cause: _reason, ...diagnostic } = failure;
      timeoutError.cause = diagnostic;
    } else {
      timeoutError.cause = failure;
    }
    if (isCommandError(failure) && failure.cleanupError !== undefined) timeoutError.cleanupError = failure.cleanupError;
  };
  let timer = budgetMs === undefined ? undefined : setTimeout(() => {
    if (signal?.aborted) return;
    budgetExpired = true;
    options.session.abortOperation(timeoutError);
  }, budgetMs);
  const clearBudget = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  try {
    if (options.updateProgress) {
      options.session.updateProgress(options.updateProgress);
    }
    options.syncState(options.session.snapshot);
    const result = await options.execute({ signal });
    clearBudget();
    if (budgetExpired && timeoutError) {
      // Failed commands commonly return structured diagnostics instead of throwing.
      if (result && typeof result === 'object' && 'success' in result && result.success === false
        && 'error' in result && isCommandError(result.error)) preserveLateFailure(result.error);
      throw timeoutError;
    }
    if (!signal?.aborted) {
      await options.onSuccess?.(result);
    }
    return result;
  } catch (error) {
    clearBudget();
    if (budgetExpired && timeoutError) {
      errorOccurred = true;
      preserveLateFailure(error);
      await options.onError?.(timeoutError);
      return undefined;
    }
    if (isAbortError(error)) {
      if (options.cancelLogMessage && options.log) {
        options.log(options.cancelLogMessage, 'warn');
      }
      return undefined;
    }

    errorOccurred = true;
    await options.onError?.(error);
    return undefined;
  } finally {
    clearBudget();
    options.session.beginRecovery(token);
    try {
      try {
        const aborted = signal?.aborted === true;
        const currentProgressState = options.session.snapshot.progress?.state;
        if (options.resetProgressOnFinish && !aborted && !errorOccurred && currentProgressState !== 'error') {
          options.session.resetProgress();
        }
        options.syncState(options.session.snapshot);
      } finally {
        await options.onFinally?.();
      }
    } finally {
      options.session.completeOperation(token);
      options.syncState(options.session.snapshot);
    }
  }
}
