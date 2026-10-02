import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { runWithCommandBufferReset, useCartBurnerSessionState } from '@/composables/cartburner';
import { errorToBurnerLog } from '@/utils/burner-log';

describe('CartBurner container state', () => {
  it('preserves diagnostic and plain cause identities through Vue log projection', () => {
    const scope = effectScope();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const state = scope.run(() => useCartBurnerSessionState(key => key));
      if (!state) throw new Error('Missing state');
      const cause = { device: 'disconnected' };
      const diagnostic = { stage: 'transport' as const, code: 'transport_failure' as const, message: 'detail', recoverable: true, cause };
      state.log(errorToBurnerLog('Read failed', diagnostic), 'error');
      expect(state.logs.value[0]?.diagnostic).toBe(diagnostic);
      expect(state.logs.value[0]?.diagnostic?.cause).toBe(cause);
      expect(consoleSpy.mock.calls[0]?.[1]).toMatchObject({ diagnostic });
      state.clearLog();
      expect(state.logs.value).toEqual([]);
      state.log('next');
      expect(state.logs.value[0]?.message).toBe('next');
    } finally { scope.stop(); consoleSpy.mockRestore(); }
  });

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

  it('rejects reentry after stop without erasing cancelled progress', async () => {
    const state = useCartBurnerSessionState((key) => key);
    let finish!: () => void;
    const worker = new Promise<void>((resolve) => { finish = resolve; });
    const pending = state.executeOperation({
      cancellable: true,
      updateProgress: { progress: 42, showProgress: true, state: 'running' },
      operation: () => worker,
      onError: vi.fn(),
    });
    state.handleProgressStop();
    const progress = { ...state.progressInfo.value };
    const operation = vi.fn(() => Promise.resolve());
    await expect(state.executeOperation({ operation, onError: vi.fn() })).rejects.toThrow('already running');
    expect(operation).not.toHaveBeenCalled();
    expect(state.busy.value).toBe(true);
    expect(state.progressInfo.value).toEqual(progress);
    expect(state.showProgressModal.value).toBe(true);
    finish();
    await pending;
    expect(state.busy.value).toBe(false);
    expect(state.progressInfo.value.state).toBe('paused');
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

  it('resets the command buffer when a nested save operation throws', async () => {
    const reset = vi.fn(() => Promise.resolve());
    const saveError = new Error('save failed');

    await expect(runWithCommandBufferReset(
      'adapter',
      () => Promise.reject(saveError),
      reset,
      vi.fn(),
    )).rejects.toBe(saveError);
    expect(reset).toHaveBeenCalledWith('adapter');
  });

  it('settles operation state and reports a command-buffer reset failure', async () => {
    const state = useCartBurnerSessionState((key) => key);
    const resetError = new Error('reset failed');
    const onResetError = vi.fn();

    await state.executeOperation({
      updateProgress: { type: 'read', progress: 100, showProgress: true },
      operation: () => runWithCommandBufferReset(
        'adapter',
        () => Promise.resolve('saved'),
        () => Promise.reject(resetError),
        onResetError,
      ),
      onError: vi.fn(),
    });

    expect(onResetError).toHaveBeenCalledWith(resetError);
    expect(state.busy.value).toBe(false);
    expect(state.progressInfo.value.progress).toBe(100);
  });
});
