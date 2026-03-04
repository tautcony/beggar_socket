import type { ProgressInfo } from '@/types/progress-info';

import type { BurnerSessionPort } from './domain/ports';
import type { BurnerSessionState, LogLevel } from './types';

export interface BurnerFlowContext {
  signal?: AbortSignal;
}

export interface BurnerFlowOptions<TResult> {
  session: BurnerSessionPort;
  cancellable?: boolean;
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
  const signal = options.session.startOperation(options.cancellable ?? false);
  if (options.updateProgress) {
    options.session.updateProgress(options.updateProgress as ProgressInfo);
  }
  options.syncState(options.session.snapshot);

  try {
    const result = await options.execute({ signal });
    await options.onSuccess?.(result);
    return result;
  } catch (error) {
    if (isAbortError(error)) {
      if (options.cancelLogMessage && options.log) {
        options.log(options.cancelLogMessage, 'warn');
      }
      return undefined;
    }

    await options.onError?.(error);
    return undefined;
  } finally {
    options.session.completeOperation();
    const aborted = signal?.aborted === true;
    if (options.resetProgressOnFinish && !aborted) {
      options.session.resetProgress();
    }
    options.syncState(options.session.snapshot);
    await options.onFinally?.();
  }
}
