import { describe, expect, it, vi } from 'vitest';

import { ConnectionOrchestrationUseCase } from '@/features/burner/application';
import type { BurnerConnectionPort, BurnerConnectionSelection } from '@/features/burner/application';

function createPortMock(overrides: Partial<BurnerConnectionPort> = {}): BurnerConnectionPort {
  const selection: BurnerConnectionSelection = {
    portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' },
    context: { portInfo: { path: '/dev/mock', vendorId: '0483', productId: '0721' } },
  };

  let seq = 0;
  const base: BurnerConnectionPort = {
    list: async () => ({ ok: true, data: [selection.portInfo] }),
    select: async () => ({ ok: true, data: selection }),
    connect: async (selected) => {
      seq += 1;
      return {
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
      };
    },
    init: async () => ({ ok: true, data: undefined }),
    disconnect: async () => ({ ok: true, data: undefined }),
  };

  return {
    ...base,
    ...overrides,
  };
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
      select: async () => ({ ok: true, data: null }),
    }));

    const result = await useCase.prepareConnection();
    expect(result.success).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.failure?.code).toBe('selection_required');
    expect(result.failure?.stage).toBe('select');
  });

  it('maps list failure to stage-aware normalized output', async () => {
    const useCase = new ConnectionOrchestrationUseCase(createPortMock({
      list: async () => ({
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
