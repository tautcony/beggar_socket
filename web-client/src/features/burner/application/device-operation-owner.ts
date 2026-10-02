/** Owns a complete transaction, including its recovery, for one connection. */
export class DeviceOperationOwner {
  private active: { settled: Promise<void>; cancel?: () => void } | null = null;
  private closing = false;
  private closed = false;
  private closeAttempt: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  get busy(): boolean { return this.active !== null || this.closing || this.closed; }
  get connected(): boolean { return !this.closed; }
  get available(): boolean { return !this.closing && !this.closed; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error(error); }
    }
  }

  async run<T>(operation: () => Promise<T>, cancel?: () => void): Promise<T> {
    if (this.busy) throw new Error('Device operation already running or connection closing');
    let release!: () => void;
    const active = { settled: new Promise<void>((resolve) => { release = resolve; }), cancel };
    this.active = active;
    this.notify();
    try {
      return await operation();
    } finally {
      if (this.active === active) this.active = null;
      release();
      this.notify();
    }
  }

  /** Closing blocks admission synchronously; failed close remains blocked and retryable. */
  close(close: () => Promise<void>): Promise<void> {
    if (this.closeAttempt) return this.closeAttempt;
    if (this.closed) return Promise.resolve();
    this.closing = true;
    const active = this.active;
    this.closeAttempt = Promise.resolve().then(async () => {
      await active?.settled;
      await close();
      this.closed = true;
    }).finally(() => {
      this.closeAttempt = null;
      this.notify();
    });
    this.notify();
    try { active?.cancel?.(); } catch (error) { console.error(error); }
    return this.closeAttempt;
  }
}
