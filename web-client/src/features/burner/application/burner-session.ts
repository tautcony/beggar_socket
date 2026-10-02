import { DEFAULT_PROGRESS, type ProgressInfo } from '@/types/progress-info';
import type { BurnerLogInput } from '@/utils/burner-log';

import type { BurnerSessionPort } from './domain/ports';
import type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';

export class BurnerSession implements BurnerSessionPort {
  private readonly state: BurnerSessionState = {
    busy: false,
    phase: 'idle',
    operationToken: null,
    abortController: null,
    progress: { ...DEFAULT_PROGRESS },
    logs: [],
  };

  get snapshot(): BurnerSessionState {
    return this.state;
  }

  startOperation(cancellable = false): AbortSignal | undefined {
    if (this.state.busy) {
      throw new Error('Burner operation already running');
    }
    this.state.busy = true;
    this.state.phase = 'running';
    this.state.operationToken = Symbol('burner-operation');
    this.state.abortController = cancellable ? new AbortController() : null;
    return this.state.abortController?.signal;
  }

  completeOperation(token: symbol | null) {
    if (token === null || this.state.operationToken !== token) return;
    this.state.busy = false;
    this.state.phase = 'idle';
    this.state.operationToken = null;
    this.state.abortController = null;
  }

  beginRecovery(token: symbol | null) {
    if (token !== null && this.state.operationToken === token) {
      this.state.phase = 'recovering';
    }
  }

  abortOperation() {
    if (!this.state.busy) return;
    if (this.state.phase === 'running') this.state.phase = 'cancelling';
    this.state.abortController?.abort();
  }

  async runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    this.startOperation();
    const token = this.state.operationToken;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.beginRecovery(token);
        reject(new Error(`Operation timeout in ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // The worker owns release even if the timeout wins the race. Both settlement
    // handlers observe late rejection, without creating an unhandled promise.
    const worker = Promise.resolve().then(operation);
    void worker.then(
      () => { this.completeOperation(token); },
      () => { this.completeOperation(token); },
    );
    try {
      return await Promise.race([worker, timeoutPromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
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
