import { DEFAULT_PROGRESS, type ProgressInfo } from '@/types/progress-info';
import type { BurnerLogInput } from '@/utils/burner-log';

import type { BurnerSessionPort } from './domain/ports';
import type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';

export class BurnerSession implements BurnerSessionPort {
  private readonly state: BurnerSessionState = {
    busy: false,
    cancelling: false,
    abortController: null,
    progress: { ...DEFAULT_PROGRESS },
    logs: [],
  };

  get snapshot(): BurnerSessionState {
    return this.state;
  }

  startOperation(cancellable = false): AbortSignal | undefined {
    if (this.state.busy) {
      throw new Error('Burner session is busy');
    }
    this.state.busy = true;
    this.state.cancelling = false;

    if (!cancellable) {
      this.state.abortController = null;
      return undefined;
    }

    this.state.abortController = new AbortController();
    return this.state.abortController.signal;
  }

  completeOperation() {
    this.state.busy = false;
    this.state.cancelling = false;
    this.state.abortController = null;
  }

  abortOperation() {
    if (this.state.busy) {
      this.state.cancelling = true;
    }
    this.state.abortController?.abort();
  }

  async runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    this.startOperation(true);

    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.abortOperation();
        reject(new Error(`Operation timeout in ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const operationPromise = Promise.resolve().then(() => operation());

    try {
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      await operationPromise.catch(() => undefined);
      throw error;
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
