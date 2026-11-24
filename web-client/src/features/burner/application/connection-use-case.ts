import type { ConnectionAttemptContext, DeviceDiagnostic } from '@/device/session';
import { assessPortIdentityFromMatchers } from '@/device/usb-identity';

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

/**
 * Discovery of one attempt, built from the selection alone.
 *
 * Opening a port can fail before any session exists (busy, unplugged, permission denied),
 * and that failure must still report the variant and the port match the attempt was made
 * with — otherwise the log falls back to "unknown" for exactly the cases where the user
 * needs to know whether the right device was addressed.
 */
function attemptContextFor(
  selection: ConnectionContext['selection'],
): ConnectionAttemptContext | undefined {
  if (!selection) {
    return undefined;
  }
  const portInfo = selection.portInfo;
  const port = portInfo
    ? { path: portInfo.path, vendorId: portInfo.vendorId, productId: portInfo.productId }
    : undefined;
  const matchers = selection.plan?.identityMatchers;
  const portIdentity = matchers ? assessPortIdentityFromMatchers(matchers, portInfo) : undefined;
  const variantId = selection.plan?.variantId;
  if (variantId === undefined && !port && !portIdentity) {
    return undefined;
  }
  return {
    ...(variantId !== undefined ? { variantId } : {}),
    ...(port ? { port } : {}),
    ...(portIdentity ? { portIdentity } : {}),
  };
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
      context?: ConnectionFailure['context'];
    };
    return {
      stage: mapped.stage,
      code: mapped.code as ConnectionFailureCode,
      message: mapped.message,
      cause: mapped.cause,
      ...(mapped.diagnostics ? { diagnostics: mapped.diagnostics } : {}),
      ...(mapped.context ? { context: mapped.context } : {}),
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

type CleanupResource = Pick<ConnectionContext, 'selection' | 'handle' | 'pendingCleanup'>;

const NO_RESOURCE: CleanupResource = { selection: null, handle: null, pendingCleanup: null };

/** Keeps the retry paths (authorized selection, un-closed resource) but never a handle. */
function releasedResource(context: ConnectionContext): CleanupResource {
  return {
    selection: context.selection,
    handle: null,
    pendingCleanup: context.pendingCleanup ?? null,
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

/** Appends diagnostics of an earlier step without dropping the ones already attached. */
function mergeDiagnostics(
  failure: ConnectionFailure,
  diagnostics?: readonly DeviceDiagnostic[],
): ConnectionFailure {
  if (!diagnostics || diagnostics.length === 0) {
    return failure;
  }
  const existing = failure.diagnostics ?? [];
  const codes = new Set(existing.map(diagnostic => `${diagnostic.code}:${diagnostic.stage ?? ''}`));
  const merged = [
    ...existing,
    ...diagnostics.filter(diagnostic => !codes.has(`${diagnostic.code}:${diagnostic.stage ?? ''}`)),
  ];
  return { ...failure, diagnostics: merged };
}

export class ConnectionOrchestrationUseCase {
  readonly operationCoordinator = new ConnectionOperationCoordinator();
  private snapshotState: ConnectionSnapshot = {
    state: 'idle',
    context: {
      generation: 0,
      selection: null,
      handle: null,
      pendingCleanup: null,
    },
  };

  private lifecycleQueue: Promise<void> = Promise.resolve();

  constructor(private readonly connectionPort: BurnerConnectionPort) {}

  get snapshot(): ConnectionSnapshot {
    return this.snapshotState;
  }

  /**
   * Selection of a failed attempt whose port authorization still holds (Web Serial).
   * Present means the next attempt may reuse the granted port instead of prompting.
   */
  get retryableSelection(): ConnectionContext['selection'] {
    const { state, context } = this.snapshotState;
    if (state === 'connected') {
      return null;
    }
    return hasWebPort(context.selection) && this.connectionPort.reuseSelection ? context.selection : null;
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
    resource: CleanupResource = this.snapshotState.context,
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
        pendingCleanup: resource.pendingCleanup ?? null,
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
        pendingCleanup: null,
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
      const result = this.markFailure(failure, releasedResource(this.snapshotState.context));
      return toFailure(result.state, result.context, failure);
    }

    this.setState('selecting');
    const selectResult = await this.connectionPort.select(options);
    if (!selectResult.ok) {
      const failure = normalizeFailure('select', selectResult.error, 'select_failed');
      const result = this.markFailure(failure, releasedResource(this.snapshotState.context));
      return toFailure(result.state, result.context, failure);
    }

    if (!selectResult.data) {
      const failure: ConnectionFailure = {
        stage: 'select',
        code: 'selection_required',
        message: 'Device selection required',
      };
      const result = this.markFailure(failure, NO_RESOURCE);
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

  /**
   * Retries with a port the user already authorized: the selection is rebuilt from this
   * attempt's options, so a baud rate or variant saved since the failed attempt is what
   * the port is opened with.
   */
  async retryConnection(options?: BurnerConnectionSelectOptions): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.context.handle) {
        const disconnectResult = await this._disconnect();
        if (!disconnectResult.success) return disconnectResult;
      }
      const preserved = this.snapshotState.context.selection;
      if (hasWebPort(preserved) && this.connectionPort.reuseSelection && preserved) {
        return this._prepareConnectionWithSelection(this.connectionPort.reuseSelection(preserved, options));
      }
      return this._prepareConnection(options);
    });
  }

  /**
   * Connects to an explicitly chosen port, releasing whatever is open first.
   *
   * The manual port picker already knows the port: reporting "already connected" would
   * ignore the user's choice, so the previous handle (or a pending close) is released and the
   * selected port is opened with this attempt's plan.
   */
  async reconnectWithSelection(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    return this.enqueueLifecycle(async () => {
      if (this.snapshotState.context.handle || this.snapshotState.context.pendingCleanup) {
        const cleanup = await this._disconnect();
        if (!cleanup.success) return cleanup;
      }
      return this._prepareConnectionWithSelection(selection);
    });
  }

  private async _prepareConnectionWithSelection(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    if (!selection) {
      const failure: ConnectionFailure = {
        stage: 'select',
        code: 'selection_required',
        message: 'Device selection required',
      };
      const result = this.markFailure(failure, NO_RESOURCE);
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
      // A failure carries its diagnostics on the error, so a close that fails after a
      // successful teardown still reports why the port could not be released.
      const diagnostics = (result.ok ? result.diagnostics : result.error.diagnostics) ?? [];
      if (!result.ok) {
        return {
          error: result.error,
          ...(diagnostics.length > 0 ? { diagnostics } : {}),
        };
      }
      return diagnostics.length > 0 ? { diagnostics } : undefined;
    } catch (error) {
      return { error };
    }
  }

  /**
   * Releases a port that never became an active session. The handle is kept only as
   * `pendingCleanup`, never as `handle`: nothing may use it as a connection again.
   */
  private async rollbackConnection(
    failure: ConnectionFailure,
    selection: ConnectionContext['selection'],
    handle: NonNullable<ConnectionContext['handle']>,
  ): Promise<ConnectionCommandResult> {
    const cleanup = await this.closeHandle(handle);
    const failureWithCleanup = mergeDiagnostics(appendCleanupCause(failure, cleanup?.error), cleanup?.diagnostics);
    const preservedSelection = hasWebPort(selection) ? selection : null;
    const resource: CleanupResource = cleanup?.error
      ? { selection, handle: null, pendingCleanup: handle }
      : { selection: preservedSelection, handle: null, pendingCleanup: null };
    const result = this.markFailure(failureWithCleanup, resource);
    return toFailure(result.state, result.context, failureWithCleanup);
  }

  /** Attaches the attempt discovery to a failure that has none of its own. */
  private withAttemptDiscovery(
    failure: ConnectionFailure,
    selection: ConnectionContext['selection'],
  ): ConnectionFailure {
    if (failure.context) {
      return failure;
    }
    const context = attemptContextFor(selection);
    return context ? { ...failure, context } : failure;
  }

  private async connectAndInit(selection: ConnectionContext['selection']): Promise<ConnectionCommandResult> {
    const previousHandleId = this.snapshotState.context.handle?.id
      ?? this.snapshotState.context.pendingCleanup?.id
      ?? null;
    // A handle or a not-yet-closed resource must be released before another port opens:
    // two open ports on one device is exactly the stale-handle failure this prevents.
    if (this.snapshotState.context.handle || this.snapshotState.context.pendingCleanup) {
      const cleanup = await this._disconnect();
      if (!cleanup.success) return cleanup;
    }
    this.setState('connecting');
    const connectResult = await this.connectionPort.connect(selection);
    if (!connectResult.ok) {
      // The port never opened (busy, unplugged, permission denied): the failure keeps the
      // same variant / port / match triplet a committed session reports.
      const failure = this.withAttemptDiscovery(
        normalizeFailure('connect', connectResult.error, 'connect_failed'),
        selection,
      );
      // An authorized port stays retryable even when opening it failed (busy, unplugged).
      const result = this.markFailure(failure, {
        selection: hasWebPort(selection) ? selection : null,
        handle: null,
        pendingCleanup: null,
      });
      return toFailure(result.state, result.context, failure);
    }

    if (previousHandleId !== null && connectResult.data.id === previousHandleId) {
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
      return this.rollbackConnection(
        this.withAttemptDiscovery(initFailure, selection),
        selection,
        connectResult.data,
      );
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
    const handle = this.snapshotState.context.handle ?? this.snapshotState.context.pendingCleanup ?? null;
    if (!handle) {
      this.snapshotState = {
        state: 'idle',
        context: {
          generation: this.snapshotState.context.generation + 1,
          selection: null,
          handle: null,
          session: null,
          pendingCleanup: null,
        },
      };
      return toSuccess(this.snapshotState.state, this.snapshotState.context, 'No active connection');
    }

    this.setState('disconnecting');
    // The port runs `teardown(activeSession)` and then closes the transport; teardown
    // failures come back as `disconnect` diagnostics instead of blocking the close.
    const cleanup = await this.closeHandle(handle);
    if (cleanup?.error) {
      const failure = mergeDiagnostics(
        normalizeFailure('disconnect', cleanup.error, 'disconnect_failed'),
        cleanup.diagnostics,
      );
      // The session, identity and adapters are already invalid; only the close is left to
      // retry, so the resource moves to `pendingCleanup` instead of staying `handle`.
      const result = this.markFailure(failure, {
        selection: this.snapshotState.context.selection,
        handle: null,
        pendingCleanup: handle,
      });
      return toFailure(result.state, result.context, failure);
    }

    this.snapshotState = {
      state: 'idle',
      context: {
        generation: this.snapshotState.context.generation + 1,
        selection: null,
        handle: null,
        session: null,
        pendingCleanup: null,
      },
      lastFailure: undefined,
    };
    return toSuccess(this.snapshotState.state, this.snapshotState.context, 'Disconnected', cleanup?.diagnostics);
  }
}
