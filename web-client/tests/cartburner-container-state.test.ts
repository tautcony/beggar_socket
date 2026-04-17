import { describe, expect, it, vi } from 'vitest';

import { useCartBurnerSessionState } from '@/composables/cartburner';

describe('CartBurner container state', () => {
  it('tracks read/write/verify flows with shared busy/progress/log state', async () => {
    const state = useCartBurnerSessionState((key) => key);

    await state.executeOperation({
      cancellable: true,
      updateProgress: { type: 'read', progress: 0, showProgress: true },
      operation: () => {
        state.updateProgress({ type: 'read', progress: 50, showProgress: true, state: 'running' });
        state.log('read-ok', 'success');
        return Promise.resolve();
      },
      onError: vi.fn(),
    });

    await state.executeOperation({
      cancellable: true,
      updateProgress: { type: 'write', progress: 0, showProgress: true },
      operation: () => {
        state.updateProgress({ type: 'write', progress: 100, showProgress: true, state: 'running' });
        state.log('write-ok', 'success');
        return Promise.resolve();
      },
      onError: vi.fn(),
    });

    await state.executeOperation({
      cancellable: true,
      updateProgress: { type: 'verify', progress: 0, showProgress: true },
      operation: () => {
        state.updateProgress({ type: 'verify', progress: 100, showProgress: true, state: 'running' });
        state.log('verify-ok', 'success');
        return Promise.resolve();
      },
      onError: vi.fn(),
    });

    expect(state.busy.value).toBe(false);
    expect(state.progressInfo.value.progress).toBe(100);
    expect(state.logs.value.map(entry => entry.message)).toEqual(['read-ok', 'write-ok', 'verify-ok']);
  });

  it('converges after cancellation and supports next operation', async () => {
    const state = useCartBurnerSessionState((key) => key);

    const cancelled = state.executeOperation({
      cancellable: true,
      operation: (signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      }),
      onError: vi.fn(),
    });

    state.handleProgressStop();
    await cancelled;
    expect(state.busy.value).toBe(false);
    expect(state.progressInfo.value.state).toBe('paused');

    await state.executeOperation({
      operation: () => {
        state.log('next-op', 'info');
        return Promise.resolve();
      },
      onError: vi.fn(),
    });

    const lastLog = state.logs.value[state.logs.value.length - 1];
    expect(state.busy.value).toBe(false);
    expect(lastLog?.message).toBe('next-op');
  });

  it('mirrors structured log details into console output', () => {
    const state = useCartBurnerSessionState((key) => key);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    state.log({
      message: 'ROM write retry 1/2 @ 0x00000000',
      error: 'Read timeout in 3000ms',
      details: 'Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
    }, 'warn');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CartBurner][warn]'),
      expect.objectContaining({
        message: 'ROM write retry 1/2 @ 0x00000000',
        error: 'Read timeout in 3000ms',
        details: 'Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
      }),
    );
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[details]'),
      expect.objectContaining({
        message: 'ROM write retry 1/2 @ 0x00000000',
        error: 'Read timeout in 3000ms',
        details: 'Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
      }),
    );
  });
});
