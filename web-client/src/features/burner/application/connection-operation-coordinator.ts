export interface ConnectionOperationToken {
  readonly id: symbol;
  readonly generation: number;
}

export type ConnectionOperationFailureReason = 'busy' | 'stale_context' | 'disconnected' | 'error';

export type ConnectionOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ConnectionOperationFailureReason; message: string; error?: unknown };

export interface RunConnectionOperationOptions<T> {
  /** Existing ownership token for re-entrant nested calls on the same connection. */
  token?: ConnectionOperationToken;
  /** Expected connection generation captured when the session/context was created. */
  expectedGeneration?: number;
  /** Returns the current authoritative connection generation. */
  currentGeneration: () => number;
  /** Optional predicate verifying the connection is currently active. */
  isConnected?: () => boolean;
  /** Operation body executed while holding connection-level ownership. */
  fn: (token: ConnectionOperationToken) => Promise<T>;
}

export class ConnectionOperationCoordinator {
  private currentToken: ConnectionOperationToken | null = null;
  private readonly listeners = new Set<(busy: boolean) => void>();

  get isBusy(): boolean {
    return this.currentToken !== null;
  }

  get activeToken(): ConnectionOperationToken | null {
    return this.currentToken;
  }

  subscribe(listener: (busy: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(busy: boolean): void {
    for (const listener of this.listeners) {
      try {
        listener(busy);
      } catch {
        // Ignore subscriber errors so ownership release is never blocked.
      }
    }
  }

  async runExclusive<T>(options: RunConnectionOperationOptions<T>): Promise<ConnectionOperationResult<T>> {
    if (options.isConnected && !options.isConnected()) {
      return {
        ok: false,
        reason: 'disconnected',
        message: 'Device is not connected',
      };
    }

    const liveGeneration = options.currentGeneration();
    if (options.expectedGeneration !== undefined && options.expectedGeneration !== liveGeneration) {
      return {
        ok: false,
        reason: 'stale_context',
        message: `Stale connection context: expected generation ${options.expectedGeneration}, got ${liveGeneration}`,
      };
    }

    if (options.token) {
      if (this.currentToken && this.currentToken.id === options.token.id) {
        try {
          const value = await options.fn(this.currentToken);
          return { ok: true, value };
        } catch (error) {
          return {
            ok: false,
            reason: 'error',
            message: error instanceof Error ? error.message : String(error),
            error,
          };
        }
      }
      return {
        ok: false,
        reason: 'busy',
        message: 'Device connection is busy with another operation',
      };
    }

    if (this.currentToken !== null) {
      return {
        ok: false,
        reason: 'busy',
        message: 'Device connection is busy with another operation',
      };
    }

    const token: ConnectionOperationToken = {
      id: Symbol('connection-operation'),
      generation: liveGeneration,
    };

    this.currentToken = token;
    this.notify(true);

    try {
      const value = await options.fn(token);
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        reason: 'error',
        message: error instanceof Error ? error.message : String(error),
        error,
      };
    } finally {
      this.currentToken = null;
      this.notify(false);
    }
  }
}
