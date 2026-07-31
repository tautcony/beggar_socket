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
    expect(result.context.handle).toBeNull();
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
