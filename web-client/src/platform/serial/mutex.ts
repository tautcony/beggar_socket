/**
 * Promise-based mutex for serialising asynchronous critical sections.
 *
 * Usage:
 * ```ts
 * const mutex = new Mutex();
 * const release = await mutex.acquire();
 * try { ... } finally { release(); }
 * ```
 */
export class Mutex {
  private _queue: (() => void)[] = [];
  private _locked = false;

  get locked(): boolean {
    return this._locked;
  }

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          resolve(() => {
            this._locked = false;
            const next = this._queue.shift();
            if (next) next();
          });
        } else {
          this._queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}
