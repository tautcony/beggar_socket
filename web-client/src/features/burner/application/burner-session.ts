import type { ProgressInfo } from '@/types/progress-info';
import type { BurnerLogInput } from '@/utils/burner-log';

import type { BurnerSessionPort } from './domain/ports';
import type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';

const DEFAULT_PROGRESS: ProgressInfo = {
  type: 'other',
  progress: null,
  detail: '',
  totalBytes: undefined,
  transferredBytes: undefined,
  startTime: undefined,
  currentSpeed: undefined,
  allowCancel: true,
  state: 'idle',
};

export class BurnerSession implements BurnerSessionPort {
  private readonly state: BurnerSessionState = {
    busy: false,
    abortController: null,
    progress: { ...DEFAULT_PROGRESS },
    logs: [],
  };

  get snapshot(): BurnerSessionState {
    return this.state;
  }

  startOperation(cancellable = false): AbortSignal | undefined {
    this.state.busy = true;

    if (!cancellable) {
      this.state.abortController = null;
      return undefined;
    }

    if (this.state.abortController) {
      this.state.abortController.abort();
    }

    this.state.abortController = new AbortController();
    return this.state.abortController.signal;
  }

  completeOperation() {
    this.state.busy = false;
    this.state.abortController = null;
  }

  abortOperation() {
    this.state.abortController?.abort();
    this.state.abortController = null;
    this.state.busy = false;
  }

  async runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    this.state.busy = true;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Operation timeout in ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      this.completeOperation();
    }
  }

  updateProgress(info: ProgressInfo) {
    this.state.progress = { ...this.state.progress, ...info };
  }

  resetProgress() {
    this.state.progress = { ...DEFAULT_PROGRESS };
  }

  appendLog(entry: BurnerLogEntry) {
    this.state.logs.push(entry);
    if (this.state.logs.length > 500) {
      this.state.logs.shift();
    }
  }

  addLog(time: string, input: BurnerLogInput, level: LogLevel = 'info') {
    this.appendLog({ time, level, ...(typeof input === 'string' ? { message: input } : input) });
  }

  clearLogs() {
    this.state.logs = [];
  }
}
