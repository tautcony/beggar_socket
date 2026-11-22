import type { DeviceDiagnostic } from '@/device/session';

import { ConnectionOperationCoordinator } from './connection-operation-coordinator';
import type {
  ConnectionCommandResult,
  ConnectionContext,
  ConnectionFailure,
  ConnectionFailureCode,
  ConnectionFailureStage,
  ConnectionSnapshot,
  ConnectionState,
  ConnectionUseCaseResult,
} from './domain/connection';
import type { BurnerConnectionPort, BurnerConnectionSelectOptions, BurnerConnectionSession } from './domain/ports';

function hasWebPort(selection: ConnectionContext['selection']): boolean {
  return Boolean(
    selection
    && typeof selection.context === 'object'
    && selection.context !== null
    && 'webPort' in selection.context
    && (selection.context as { webPort?: unknown }).webPort,
  );
}

function normalizeFailure(
  stage: ConnectionFailureStage,
  error: unknown,
  fallbackCode: ConnectionFailureCode,
): ConnectionFailure {
  if (error && typeof error === 'object' && 'stage' in error && 'code' in error && 'message' in error) {
    const mapped = error as {
      stage: ConnectionFailureStage;
      code: string;
      message: string;
      cause?: unknown;
      diagnostics?: ConnectionFailure['diagnostics'];
    };
    return {
      stage: mapped.stage,
      code: mapped.code as ConnectionFailureCode,
      message: mapped.message,
      cause: mapped.cause,
      ...(mapped.diagnostics ? { diagnostics: mapped.diagnostics } : {}),
    };
  }

  const message = error instanceof Error ? error.message : `Connection ${stage} failed`;

  return {
    stage,
    code: fallbackCode,
    message,
    cause: error,
  };
}

function toSuccess(
  state: ConnectionState,
  context: ConnectionContext,
  message: string,
  diagnostics?: readonly DeviceDiagnostic[],
): ConnectionCommandResult {
  return {
    success: true,
    state,
    context,
    message,
    ...(diagnostics && diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

function toFailure(state: ConnectionState, context: ConnectionContext, failure: ConnectionFailure): ConnectionCommandResult {
  return {
    success: false,
    state,
    context,
    failure,
    message: failure.message,
  };
}

function appendCleanupCause(failure: ConnectionFailure, cleanupError: unknown): ConnectionFailure {
  return {
    ...failure,
    cause: cleanupError
      ? {
        original: failure.cause,
        cleanup: cleanupError,
      }
      : failure.cause,
  };
}

export class ConnectionOrchestrationUseCase {
  readonly operationCoordinator = new ConnectionOperationCoordinator();
  private snapshotState: ConnectionSnapshot = {
    state: 'idle',
    context: {
      generation: 0,
      selection: null,
      handle: null,
    },
  };

  private lifecycleQueue: Promise<void> = Promise.resolve();

  constructor(private readonly connectionPort: BurnerConnectionPort) {}

  get snapshot(): ConnectionSnapshot {
    return this.snapshotState;
  }

  private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.lifecycleQueue.then(operation, operation);
    this.lifecycleQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private setState(state: ConnectionState) {
    this.snapshotState = {
      ...this.snapshotState,
      state,
    };
  }

  private markFailure(
    failure: ConnectionFailure,
    resource: Pick<ConnectionContext, 'selection' | 'handle'> = this.snapshotState.context,
    options: { readonly keepSession?: boolean } = {},
  ): ConnectionUseCaseResult {
    const session = options.keepSession ? this.snapshotState.context.session ?? null : null;
    this.snapshotState = {
      state: 'failed',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection: resource.selection,
        handle: resource.handle,
        session,
      },
      lastFailure: failure,
    };

    return {
      success: false,
      state: 'failed',
      context: this.snapshotState.context,
      failure,
      ...(failure.diagnostics ? { diagnostics: failure.diagnostics } : {}),
    };
  }

  private markConnected(
    selection: ConnectionContext['selection'],
    handle: ConnectionContext['handle'],
    session: BurnerConnectionSession | null,
  ): ConnectionUseCaseResult {
    this.snapshotState = {
      state: 'connected',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection,
        handle,
        session,
      },
      lastFailure: undefined,
    };

    return {
      success: true,
      state: this.snapshotState.state,
      context: this.snapshotState.context,
      ...(session && session.diagnostics.length > 0 ? { diagnostics: session.diagnostics } : {}),
    };
  }

  async prepareConnection(options?: BurnerConnectionSelectOptions): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.state === 'connected' && this.snapshotState.context.handle) {
        return toSuccess('connected', this.snapshotState.context, 'Connection already ready');
      }
      return this._prepareConnection(options);
    });
  }

  private async _prepareConnection(options?: BurnerConnectionSelectOptions): Promise<ConnectionCommandResult> {
    const listResult = await this.connectionPort.list();
    if (!listResult.ok) {
      const failure = normalizeFailure('list', listResult.error, 'list_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    this.setState('selecting');
    const selectResult = await this.connectionPort.select(options);
    if (!selectResult.ok) {
      const failure = normalizeFailure('select', selectResult.error, 'select_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    if (!selectResult.data) {
      const failure: ConnectionFailure = {
        stage: 'select',
        code: 'selection_required',
        message: 'Device selection required',
      };
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    return this.connectAndInit(selectResult.data);
  }

  async prepareConnectionWithSelection(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.state === 'connected' && this.snapshotState.context.handle) {
        return toSuccess('connected', this.snapshotState.context, 'Connection already ready');
      }
      return this._prepareConnectionWithSelection(selection);
    });
  }

  async reconnectWithSelection(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(() => this._prepareConnectionWithSelection(selection));
  }

  private async _prepareConnectionWithSelection(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    if (!selection) {
      const failure: ConnectionFailure = {
        stage: 'select',
        code: 'selection_required',
        message: 'Device selection required',
      };
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }
    return this.connectAndInit(selection);
  }

  async listAvailableSelections(): Promise<ConnectionCommandResult & { ports?: ConnectionContext['selection'][] }> {
    try {
      const listResult = await this.connectionPort.list();
      if (!listResult.ok) {
        const failure = normalizeFailure('list', listResult.error, 'list_failed');
        return toFailure(this.snapshotState.state, this.snapshotState.context, failure);
      }

      return {
        ...toSuccess(this.snapshotState.state, this.snapshotState.context, 'Listed ports'),
        ports: listResult.data
          .filter(Boolean)
          .map(portInfo => ({ portInfo, context: { portInfo } })),
      };
    } catch (error) {
      const failure = normalizeFailure('list', error, 'list_failed');
      return toFailure(this.snapshotState.state, this.snapshotState.context, failure);
    }
  }

  private async closeHandle(
    handle: NonNullable<ConnectionContext['handle']>,
  ): Promise<{ error?: unknown; diagnostics?: readonly DeviceDiagnostic[] } | undefined> {
    try {
      const result = await this.connectionPort.disconnect(handle);
      if (!result.ok) {
        return { error: result.error };
      }
      const diagnostics = result.diagnostics ?? [];
      return diagnostics.length > 0 ? { diagnostics } : undefined;
    } catch (error) {
      return { error };
    }
  }

  private async rollbackConnection(
    failure: ConnectionFailure,
    selection: ConnectionContext['selection'],
    handle: NonNullable<ConnectionContext['handle']>,
  ): Promise<ConnectionCommandResult> {
    const cleanup = await this.closeHandle(handle);
    const failureWithCleanup = appendCleanupCause(failure, cleanup?.error);
    const preservedSelection = hasWebPort(selection) ? selection : null;
    const result = this.markFailure(
      failureWithCleanup,
      cleanup?.error ? { selection, handle } : { selection: preservedSelection, handle: null },
    );
    return toFailure(result.state, result.context, failureWithCleanup);
  }

  private async connectAndInit(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    const previousHandle = this.snapshotState.context.handle;
    if (previousHandle) {
      const cleanup = await this._disconnect();
      if (!cleanup.success) return cleanup;
    }
    this.setState('connecting');
    const connectResult = await this.connectionPort.connect(selection);
    if (!connectResult.ok) {
      const failure = normalizeFailure('connect', connectResult.error, 'connect_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    if (connectResult.data.id === previousHandle?.id) {
      return this.rollbackConnection({
        stage: 'connect',
        code: 'stale_context',
        message: 'Reconnect must return a fresh connection context',
      }, selection, connectResult.data);
    }

    let initFailure: ConnectionFailure | undefined;
    try {
      const initResult = await this.connectionPort.init(connectResult.data);
      if (!initResult.ok) {
        initFailure = normalizeFailure('init', initResult.error, 'init_failed');
      }
    } catch (error) {
      initFailure = normalizeFailure('init', error, 'init_failed');
    }
    if (initFailure) {
      return this.rollbackConnection(initFailure, selection, connectResult.data);
    }

    // Probe → resolve → initialize run inside the same lifecycle queue entry, so a connect
    // requested concurrently waits for the whole transaction instead of interleaving it.
    let session: BurnerConnectionSession | null = null;
    if (this.connectionPort.establishSession) {
      let establishFailure: ConnectionFailure | undefined;
      try {
        const established = await this.connectionPort.establishSession(connectResult.data);
        if (established.ok) {
          session = established.data;
        } else {
          establishFailure = normalizeFailure('probe', established.error, 'probe_failed');
        }
      } catch (error) {
        establishFailure = normalizeFailure('probe', error, 'probe_failed');
      }
      if (establishFailure) {
        return this.rollbackConnection(establishFailure, selection, connectResult.data);
      }
    }

    const result = this.markConnected(selection, connectResult.data, session);
    return toSuccess(result.state, result.context, 'Connection prepared', result.diagnostics);
  }

  async ensureConnected(): Promise<ConnectionCommandResult> {
    return this.prepareConnection();
  }

  async reinitializeConnection(): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.state === 'connected' && this.snapshotState.context.handle) {
        try {
          const initResult = await this.connectionPort.init(this.snapshotState.context.handle);
          if (!initResult.ok) {
            const failure = normalizeFailure('init', initResult.error, 'init_failed');
            const result = this.markFailure(failure);
            return toFailure(result.state, result.context, failure);
          }
          return toSuccess('connected', this.snapshotState.context, 'Connection initialized');
        } catch (error) {
          const failure = normalizeFailure('init', error, 'init_failed');
          const result = this.markFailure(failure);
          return toFailure(result.state, result.context, failure);
        }
      }
      return this._prepareConnection();
    });
  }

  async disconnect(): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(() => this._disconnect());
  }

  private async _disconnect(): Promise<ConnectionCommandResult> {
    if (!this.snapshotState.context.handle) {
      this.snapshotState = {
        state: 'idle',
        context: {
          generation: this.snapshotState.context.generation + 1,
          selection: null,
          handle: null,
          session: null,
        },
      };
      return toSuccess(this.snapshotState.state, this.snapshotState.context, 'No active connection');
    }

    this.setState('disconnecting');
    // The port runs `teardown(activeSession)` and then closes the transport; teardown
    // failures come back as `disconnect` diagnostics instead of blocking the close.
    const cleanup = await this.closeHandle(this.snapshotState.context.handle);
    if (cleanup?.error) {
      const failure = normalizeFailure('disconnect', cleanup.error, 'disconnect_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    this.snapshotState = {
      state: 'idle',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection: null,
        handle: null,
        session: null,
      },
      lastFailure: undefined,
    };
    return toSuccess(this.snapshotState.state, this.snapshotState.context, 'Disconnected', cleanup?.diagnostics);
  }

  async retryConnection(options?: BurnerConnectionSelectOptions): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.context.handle) {
        const disconnectResult = await this._disconnect();
        if (!disconnectResult.success) return disconnectResult;
      }
      const preserved = this.snapshotState.context.selection;
      if (hasWebPort(preserved)) {
        return this._prepareConnectionWithSelection(preserved);
      }
      return this._prepareConnection(options);
    });
  }
}
