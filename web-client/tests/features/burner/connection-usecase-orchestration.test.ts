import { describe, expect, it, vi } from 'vitest';

import { type BurnerConnectionPort, type BurnerConnectionSelection, ConnectionOrchestrationUseCase } from '@/features/burner/application';

function createPortMock(overrides: Partial<BurnerConnectionPort> = {}): BurnerConnectionPort {
  const selection: BurnerConnectionSelection = {
    portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' },
    context: { portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' } },
  };

  let seq = 0;
  const base: BurnerConnectionPort = {
    list: () => Promise.resolve({ ok: true, data: [selection.portInfo] }),
    select: () => Promise.resolve({ ok: true, data: selection }),
    connect: (selected) => {
      seq += 1;
      return Promise.resolve({
        ok: true,
        data: {
          id: `mock:${selected?.portInfo?.path ?? 'auto'}:${seq}`,
          platform: 'web',
          portInfo: selected?.portInfo,
          context: {
            platform: 'web',
            portInfo: selected?.portInfo,
            transport: {},
            port: null,
            connection: null,
          },
        },
      });
    },
    init: () => Promise.resolve({ ok: true, data: undefined }),
    disconnect: () => Promise.resolve({ ok: true, data: undefined }),
  };

  return {
    ...base,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('ConnectionOrchestrationUseCase', () => {
  it.each(['result', 'throw'] as const)('keeps enumeration %s failures read-only while connected', async (mode) => {
    const error = new Error('list failed');
    const list = vi.fn();
    const disconnect = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ list, disconnect }));
    await useCase.prepareConnectionWithSelection({ context: {} });
    const snapshot = useCase.snapshot;
    if (mode === 'throw') list.mockRejectedValue(error);
    else list.mockResolvedValue({ ok: false, error });

    const result = await useCase.listAvailableSelections();

    expect(result.success).toBe(false);
    expect(result.failure?.code).toBe('list_failed');
    expect(result.state).toBe('connected');
    expect(result.context).toBe(snapshot.context);
    expect(useCase.snapshot).toBe(snapshot);
    expect((await useCase.disconnect()).success).toBe(true);
    expect(disconnect).toHaveBeenCalledWith(snapshot.context.handle);
  });

  it('does not let a delayed enumeration failure overwrite a completed disconnect', async () => {
    const listed = deferred<Awaited<ReturnType<BurnerConnectionPort['list']>>>();
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ list: () => listed.promise }));
    await useCase.prepareConnectionWithSelection({ context: {} });
    const listing = useCase.listAvailableSelections();
    await useCase.disconnect();
    const snapshot = useCase.snapshot;
    listed.resolve({ ok: false, error: { stage: 'connection', code: 'list_failed', message: 'list failed', recoverable: true } });

    expect((await listing).state).toBe('idle');
    expect(useCase.snapshot).toBe(snapshot);
  });

  it.each(['result', 'throw'] as const)('retains a handle after disconnect %s failure and retries its cleanup', async (mode) => {
    const error = new Error('close failed');
    const disconnect = vi.fn();
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ disconnect }));
    const connected = await useCase.prepareConnection();
    if (mode === 'throw') disconnect.mockRejectedValueOnce(error);
    else disconnect.mockResolvedValueOnce({ ok: false, error });
    disconnect.mockResolvedValueOnce({ ok: true, data: undefined });

    const failed = await useCase.disconnect();

    expect(failed.success).toBe(false);
    expect(failed.state).toBe('failed');
    expect(failed.failure?.code).toBe('disconnect_failed');
    expect(failed.context.handle).toBe(connected.context.handle);
    expect(failed.context.selection).toBe(connected.context.selection);
    expect(failed.context.generation).toBeGreaterThan(connected.context.generation);
    const cleaned = await useCase.disconnect();
    expect(cleaned.success).toBe(true);
    expect(cleaned.context.handle).toBeNull();
    expect(cleaned.context.generation).toBeGreaterThan(failed.context.generation);
    expect(disconnect).toHaveBeenNthCalledWith(1, connected.context.handle);
    expect(disconnect).toHaveBeenNthCalledWith(2, connected.context.handle);
  });

  it.each(['result', 'throw'] as const)('blocks both prepare paths until failed rollback %s cleanup succeeds', async (mode) => {
    const error = new Error('close failed');
    const basePort = createPortMock();
    const connect = vi.fn((selection?: BurnerConnectionSelection | null) => basePort.connect(selection));
    const init = vi.fn().mockResolvedValueOnce({ ok: false, error: new Error('init failed') }).mockResolvedValue({ ok: true, data: undefined });
    const disconnect = vi.fn();
    if (mode === 'throw') disconnect.mockRejectedValueOnce(error);
    else disconnect.mockResolvedValueOnce({ ok: false, error });
    const cleanup = deferred<Awaited<ReturnType<BurnerConnectionPort['disconnect']>>>();
    disconnect.mockImplementationOnce(() => cleanup.promise).mockResolvedValueOnce({ ok: true, data: undefined });
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect, init, disconnect }));
    const failed = await useCase.prepareConnection();

    expect(failed.failure?.code).toBe('init_failed');
    expect(failed.failure?.cause).toMatchObject({ cleanup: error });
    expect(failed.context.handle).toBe(disconnect.mock.calls[0][0]);
    expect(failed.context.selection).not.toBeNull();
    const preparing = useCase.prepareConnection();
    await vi.waitFor(() => {
      expect(disconnect).toHaveBeenCalledTimes(2);
    });
    expect(connect).toHaveBeenCalledOnce();
    cleanup.resolve({ ok: false, error: { stage: 'connection', code: 'disconnect_failed', message: 'close failed', recoverable: true } });
    expect((await preparing).success).toBe(false);
    expect(useCase.snapshot.context.handle).toBe(failed.context.handle);
    expect(connect).toHaveBeenCalledOnce();

    const recovered = await useCase.prepareConnectionWithSelection({ context: {} });
    expect(recovered.success).toBe(true);
    expect(recovered.context.handle?.id).not.toBe(failed.context.handle?.id);
    expect(recovered.context.generation).toBeGreaterThan(failed.context.generation);
    expect(disconnect).toHaveBeenNthCalledWith(1, failed.context.handle);
    expect(disconnect).toHaveBeenNthCalledWith(2, failed.context.handle);
    expect(disconnect).toHaveBeenNthCalledWith(3, failed.context.handle);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('rolls back a thrown init failure and releases the acquired handle', async () => {
    const error = new Error('init threw');
    const disconnect = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({
      init: vi.fn().mockRejectedValue(error),
      disconnect,
    }));

    const result = await useCase.prepareConnection();

    expect(result.success).toBe(false);
    expect(result.failure).toMatchObject({ stage: 'init', code: 'init_failed', cause: error });
    expect(disconnect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledWith(expect.objectContaining({ id: 'mock:/dev/mock:1' }));
    expect(result.context.handle).toBeNull();
    expect(result.context.selection).toBeNull();
  });

  it('sequences list/select/connect/init and transitions to connected then idle on disconnect', async () => {
    const port = createPortMock();
    const useCase = new ConnectionOrchestrationUseCase(port);

    const connectResult = await useCase.prepareConnection();
    expect(connectResult.success).toBe(true);
    expect(connectResult.state).toBe('connected');
    expect(connectResult.context.handle?.id).toContain('mock:/dev/mock:1');

    const disconnectResult = await useCase.disconnect();
    expect(disconnectResult.success).toBe(true);
    expect(disconnectResult.state).toBe('idle');
    expect(disconnectResult.context.handle).toBeNull();
    expect(disconnectResult.context.selection).toBeNull();
  });

  it('normalizes init failure to failed state with invalidated context', async () => {
    const port = createPortMock({
      init: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          stage: 'connection',
          code: 'init_failed',
          message: 'init failed',
          recoverable: true,
        },
      }),
    });

    const useCase = new ConnectionOrchestrationUseCase(port);
    const result = await useCase.prepareConnection();

    expect(result.success).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.failure?.stage).toBe('connection');
    expect(result.failure?.code).toBe('init_failed');
    expect(result.context.handle).toBeNull();
    expect(result.context.selection).toBeNull();
  });

  it('keeps init failure normalized when rollback disconnect also fails', async () => {
    const disconnect = vi.fn().mockRejectedValue(new Error('close failed'));
    const port = createPortMock({
      init: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          stage: 'init',
          code: 'init_failed',
          message: 'init failed',
          recoverable: true,
        },
      }),
      disconnect,
    });

    const useCase = new ConnectionOrchestrationUseCase(port);
    const result = await useCase.prepareConnection();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.failure?.stage).toBe('init');
    expect(result.failure?.code).toBe('init_failed');
    expect(result.failure?.message).toBe('init failed');
    expect(result.failure?.cause).toMatchObject({
      cleanup: expect.any(Error),
    });
    expect(result.context.handle).toBe(disconnect.mock.calls[0][0]);
    expect(useCase.snapshot.state).toBe('failed');
  });

  it('returns the current connection instead of opening another one when already connected', async () => {
    const basePort = createPortMock();
    const connect = vi.fn((selection?: BurnerConnectionSelection | null) => basePort.connect(selection));
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect }));

    const first = await useCase.prepareConnection();
    const second = await useCase.prepareConnection();

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.context.handle?.id).toBe(first.context.handle?.id);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('runs a disconnect requested during connect after the connection attempt settles', async () => {
    const basePort = createPortMock();
    const connectResult = deferred<Awaited<ReturnType<BurnerConnectionPort['connect']>>>();
    const connect = vi.fn(() => connectResult.promise);
    const disconnect = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect, disconnect }));

    const connecting = useCase.prepareConnection();
    await vi.waitFor(() => {
      expect(connect).toHaveBeenCalledOnce();
    });
    const disconnecting = useCase.disconnect();
    connectResult.resolve(await basePort.connect(null));

    expect((await connecting).success).toBe(true);
    expect((await disconnecting).success).toBe(true);
    expect(useCase.snapshot.state).toBe('idle');
    expect(useCase.snapshot.context.handle).toBeNull();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('runs a connect requested during disconnect after the disconnect settles', async () => {
    const disconnectResult = deferred<Awaited<ReturnType<BurnerConnectionPort['disconnect']>>>();
    const disconnect = vi.fn(() => disconnectResult.promise);
    const port = createPortMock({ disconnect });
    const useCase = new ConnectionOrchestrationUseCase(port);
    await useCase.prepareConnection();

    const disconnecting = useCase.disconnect();
    await vi.waitFor(() => {
      expect(disconnect).toHaveBeenCalledOnce();
    });
    const connecting = useCase.prepareConnection();
    disconnectResult.resolve({ ok: true, data: undefined });

    expect((await disconnecting).success).toBe(true);
    expect((await connecting).success).toBe(true);
    expect(useCase.snapshot.state).toBe('connected');
    expect(useCase.snapshot.context.handle).not.toBeNull();
  });

  it('does not reconnect when retry cleanup fails', async () => {
    const basePort = createPortMock();
    const connect = vi.fn((selection?: BurnerConnectionSelection | null) => basePort.connect(selection));
    const disconnect = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        stage: 'disconnect',
        code: 'disconnect_failed',
        message: 'close failed',
      },
    });
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect, disconnect }));
    await useCase.prepareConnection();

    const retry = await useCase.retryConnection();

    expect(retry.success).toBe(false);
    expect(retry.failure?.code).toBe('disconnect_failed');
    expect(connect).toHaveBeenCalledOnce();
  });

  it('best-effort disconnects a stale connection handle before failing', async () => {
    const staleHandle = {
      id: 'mock:/dev/mock:1',
      platform: 'web' as const,
      portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' },
      context: {
        platform: 'web',
        portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' },
        transport: {},
        port: null,
        connection: null,
      },
    };
    const connect = vi
      .fn()
      .mockResolvedValue({ ok: true, data: staleHandle });
    const disconnect = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect, disconnect }));
    (useCase as unknown as {
      snapshotState: {
        state: string;
        context: {
          generation: number;
          selection: BurnerConnectionSelection | null;
          handle: typeof staleHandle;
        };
      };
    }).snapshotState = {
      state: 'failed',
      context: {
        generation: 1,
        selection: null,
        handle: staleHandle,
      },
    };

    const second = await useCase.prepareConnection();

    expect(second.success).toBe(false);
    expect(second.failure?.code).toBe('stale_context');
    expect(disconnect).toHaveBeenCalledWith(staleHandle);
  });

  it('supports recovery from failed attempt via retry with fresh context', async () => {
    const connect = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          stage: 'connection',
          code: 'connect_failed',
          message: 'permission denied',
          recoverable: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'mock:/dev/mock:2',
          platform: 'web',
          portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' },
          context: { platform: 'web', portInfo: { path: '/dev/mock' }, transport: {}, port: null, connection: null },
        },
      });

    const useCase = new ConnectionOrchestrationUseCase(createPortMock({ connect }));

    const first = await useCase.prepareConnection();
    expect(first.success).toBe(false);
    expect(first.state).toBe('failed');
    expect(first.failure?.code).toBe('connect_failed');

    const retry = await useCase.retryConnection();
    expect(retry.success).toBe(true);
    expect(retry.state).toBe('connected');
    expect(retry.context.handle?.id).toBe('mock:/dev/mock:2');
    expect(retry.context.generation).toBeGreaterThan(first.context.generation);
  });

  it('maps selection-required case to failed output', async () => {
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({
      select: () => Promise.resolve({ ok: true, data: null }),
    }));

    const result = await useCase.prepareConnection();
    expect(result.success).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.failure?.code).toBe('selection_required');
    expect(result.failure?.stage).toBe('select');
  });

  it('maps list failure to stage-aware normalized output', async () => {
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({
      list: () => Promise.resolve({
        ok: false,
        error: {
          stage: 'connection',
          code: 'list_failed',
          message: 'permission denied',
          recoverable: true,
        },
      }),
    }));

    const result = await useCase.prepareConnection();
    expect(result.success).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.failure?.code).toBe('list_failed');
    expect(result.failure?.message).toContain('permission denied');
  });
});
