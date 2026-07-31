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
import type { BurnerConnectionPort } from './domain/ports';

function normalizeFailure(
  stage: ConnectionFailureStage,
  error: unknown,
  fallbackCode: ConnectionFailureCode,
): ConnectionFailure {
  if (error && typeof error === 'object' && 'stage' in error && 'code' in error && 'message' in error) {
    const mapped = error as { stage: ConnectionFailureStage; code: ConnectionFailureCode; message: string; cause?: unknown };
    return {
      stage: mapped.stage,
      code: mapped.code,
      message: mapped.message,
      cause: mapped.cause,
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

function toSuccess(state: ConnectionState, context: ConnectionContext, message: string): ConnectionCommandResult {
  return {
    success: true,
    state,
    context,
    message,
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

  private markFailure(failure: ConnectionFailure): ConnectionUseCaseResult {
    this.snapshotState = {
      state: 'failed',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection: null,
        handle: null,
      },
      lastFailure: failure,
    };

    return {
      success: false,
      state: 'failed',
      context: this.snapshotState.context,
      failure,
    };
  }

  private markConnected(selection: ConnectionContext['selection'], handle: ConnectionContext['handle']): ConnectionUseCaseResult {
    this.snapshotState = {
      state: 'connected',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection,
        handle,
      },
      lastFailure: undefined,
    };

    return {
      success: true,
      state: this.snapshotState.state,
      context: this.snapshotState.context,
    };
  }

  async prepareConnection(): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.state === 'connected' && this.snapshotState.context.handle) {
        return toSuccess('connected', this.snapshotState.context, 'Connection already ready');
      }
      return this._prepareConnection();
    });
  }

  private async _prepareConnection(): Promise<ConnectionCommandResult> {
    const listResult = await this.connectionPort.list();
    if (!listResult.ok) {
      const failure = normalizeFailure('list', listResult.error, 'list_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    this.setState('selecting');
    const selectResult = await this.connectionPort.select();
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
    });
  }

  async listAvailableSelections(): Promise<ConnectionCommandResult & { ports?: ConnectionContext['selection'][] }> {
    const listResult = await this.connectionPort.list();
    if (!listResult.ok) {
      const failure = normalizeFailure('list', listResult.error, 'list_failed');
      const result = this.markFailure(failure);
      return {
        ...toFailure(result.state, result.context, failure),
      };
    }

    return {
      ...toSuccess(this.snapshotState.state, this.snapshotState.context, 'Listed ports'),
      ports: listResult.data
        .filter(Boolean)
        .map(portInfo => ({ portInfo, context: { portInfo } })),
    };
  }

  private async connectAndInit(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    this.setState('connecting');
    const previousHandle = this.snapshotState.context.handle;
    const connectResult = await this.connectionPort.connect(selection);
    if (!connectResult.ok) {
      const failure = normalizeFailure('connect', connectResult.error, 'connect_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    if (connectResult.data.id === previousHandle?.id) {
      let cleanupError: unknown;
      const failure: ConnectionFailure = {
        stage: 'connect',
        code: 'stale_context',
        message: 'Reconnect must return a fresh connection context',
      };
      try {
        await this.connectionPort.disconnect(connectResult.data);
      } catch (error) {
        cleanupError = error;
      }
      const failureWithCleanup = appendCleanupCause(failure, cleanupError);
      const result = this.markFailure(failureWithCleanup);
      return toFailure(result.state, result.context, failureWithCleanup);
    }

    const initResult = await this.connectionPort.init(connectResult.data);
    if (!initResult.ok) {
      let cleanupError: unknown;
      try {
        await this.connectionPort.disconnect(connectResult.data);
      } catch (error) {
        cleanupError = error;
      }
      const failure = appendCleanupCause(normalizeFailure('init', initResult.error, 'init_failed'), cleanupError);
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    const result = this.markConnected(selection, connectResult.data);
    return toSuccess(result.state, result.context, 'Connection prepared');
  }

  async ensureConnected(): Promise<ConnectionCommandResult> {
    return this.prepareConnection();
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
        },
      };
      return toSuccess(this.snapshotState.state, this.snapshotState.context, 'No active connection');
    }

    this.setState('disconnecting');
    const disconnectResult = await this.connectionPort.disconnect(this.snapshotState.context.handle);
    if (!disconnectResult.ok) {
      const failure = normalizeFailure('disconnect', disconnectResult.error, 'disconnect_failed');
      const result = this.markFailure(failure);
      return toFailure(result.state, result.context, failure);
    }

    this.snapshotState = {
      state: 'idle',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection: null,
        handle: null,
      },
      lastFailure: undefined,
    };
    return toSuccess(this.snapshotState.state, this.snapshotState.context, 'Disconnected');
  }

  async retryConnection(): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.context.handle) {
        const disconnectResult = await this._disconnect();
        if (!disconnectResult.success) return disconnectResult;
      }
      return this._prepareConnection();
    });
  }
}
