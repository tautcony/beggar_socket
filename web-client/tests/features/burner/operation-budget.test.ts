import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, shallowRef } from 'vue';

import { useCartBurnerSessionState } from '@/composables/cartburner/useCartBurnerSessionState';
import { runWithCommandBufferReset } from '@/composables/cartburner/withCommandBufferReset';
import { CartridgeProtocolPortAdapter } from '@/features/burner/adapters/cartridge-protocol-port';
import { BurnerSession } from '@/features/burner/application/burner-session';
import { BurnerFacadeImpl, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import { runBurnerFlow } from '@/features/burner/application/flow-template';
import type { Transport } from '@/platform/serial';
import { getDeviceOperationOwner } from '@/services/device-operation-owner';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { type CommandError, isCommandError } from '@/types/command-error';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { DeviceInfo } from '@/types/device-info';

function deferred<T>() {
  let resolve!: (value?: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = value => { yes(value as T); }; reject = no; });
  return { promise, resolve, reject };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test state');
  return value;
}
function diagnostic(value: unknown): CommandError {
  if (!isCommandError(value)) throw new Error('Expected command diagnostic');
  return value;
}

describe('cooperative operation budget', () => {
  beforeEach(() => { vi.useFakeTimers(); AdvancedSettings.resetToDefaults(); });
  afterEach(() => { vi.useRealTimers(); AdvancedSettings.resetToDefaults(); });

  it('keeps default slow execution working beyond the existing 30 second setting', async () => {
    const scope = effectScope();
    const state = required(scope.run(() => useCartBurnerSessionState(key => key)));
    const worker = deferred<number>();
    const success = vi.fn();
    const pending = state.executeOperation({ operation: () => worker.promise, onSuccess: success, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(60000);
    expect(state.busy.value).toBe(true);
    worker.resolve(7);
    await pending;
    expect(success).toHaveBeenCalledWith(7, expect.any(Function));
    scope.stop();
  });

  it('aborts at the deadline and retains ownership through atomic work and recovery', async () => {
    const session = new BurnerSession();
    const worker = deferred<number>();
    const recovery = deferred<undefined>();
    const success = vi.fn();
    const error = vi.fn<(error: unknown) => void>();
    let signal: AbortSignal | undefined;
    const pending = runBurnerFlow({ session, budgetMs: 100, syncState: vi.fn(),
      execute: context => { signal = context.signal; return worker.promise; },
      onSuccess: success, onError: error, onFinally: () => recovery.promise });
    await vi.advanceTimersByTimeAsync(100);
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toMatchObject({ stage: 'session', code: 'timeout' });
    expect(session.snapshot.busy).toBe(true);
    expect(error).not.toHaveBeenCalled();
    worker.resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalledWith(signal?.reason);
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.phase).toBe('recovering');
    recovery.resolve();
    await pending;
    expect(session.snapshot.busy).toBe(false);
    expect(success).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves late I/O and cleanup diagnostic identities on timeout', async () => {
    const session = new BurnerSession();
    const worker = deferred<undefined>();
    const error = vi.fn<(error: unknown) => void>();
    const cleanup = new Error('reset failed');
    const failure = { stage: 'transport' as const, code: 'transport_failure' as const,
      message: 'I/O failed', recoverable: true, cleanupError: cleanup };
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(), execute: () => worker.promise, onError: error });
    await vi.advanceTimersByTimeAsync(10);
    worker.reject(failure);
    await pending;
    expect(error.mock.calls[0]?.[0]).toMatchObject({ code: 'timeout', cleanupError: cleanup });
    expect(diagnostic(error.mock.calls[0]?.[0]).cause).toBe(failure);
  });

  it('preserves returned adapter failure through the real facade after expiry', async () => {
    const session = new BurnerSession();
    const worker = deferred<CommandResult>();
    const ioFailure = new Error('driver gone');
    const cleanup = new Error('reset failed');
    const ioDiagnostic = { stage: 'transport' as const, code: 'transport_failure' as const,
      message: 'I/O failed', recoverable: true, cause: ioFailure, cleanupError: cleanup };
    const adapter = { id: 'test', readROM: () => worker.promise } as unknown as BurnerProtocolSession;
    const facade = new BurnerFacadeImpl(new BurnerUseCaseImpl(new CartridgeProtocolPortAdapter(), key => key, String));
    const error = vi.fn<(error: unknown) => void>();
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(),
      execute: ({ signal }) => facade.readRom(adapter, 4, { cfiInfo: {} } as CommandOptions, signal), onError: error });
    await vi.advanceTimersByTimeAsync(10);
    worker.resolve({ success: false, message: 'failed', error: ioDiagnostic });
    await pending;
    expect(diagnostic(error.mock.calls[0]?.[0]).cause).toBe(ioDiagnostic);
    expect(diagnostic(diagnostic(error.mock.calls[0]?.[0]).cause).cause).toBe(ioFailure);
    expect(diagnostic(error.mock.calls[0]?.[0]).cleanupError).toBe(cleanup);
  });

  it('does not create a cause cycle when adapter returns the budget reason', async () => {
    const session = new BurnerSession();
    const worker = deferred<CommandResult>();
    const error = vi.fn<(error: unknown) => void>();
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(), execute: () => worker.promise, onError: error });
    await vi.advanceTimersByTimeAsync(10);
    worker.resolve({ success: false, message: 'cancelled', error: {
      stage: 'session', code: 'aborted', message: 'cancelled', recoverable: true,
      cause: session.snapshot.abortController?.signal.reason } });
    await pending;
    const failure = diagnostic(error.mock.calls[0]?.[0]);
    expect(failure.cause).toMatchObject({ code: 'aborted' });
    expect(failure.cause).not.toHaveProperty('cause');
    expect(() => JSON.stringify(failure)).not.toThrow();
  });

  it('preserves user cancellation when it arrives before the budget', async () => {
    const session = new BurnerSession();
    const worker = deferred<undefined>();
    const error = vi.fn<(error: unknown) => void>();
    const success = vi.fn();
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(), execute: () => worker.promise, onError: error, onSuccess: success });
    session.abortOperation();
    const reason = session.snapshot.abortController?.signal.reason;
    await vi.advanceTimersByTimeAsync(10);
    expect(session.snapshot.abortController?.signal.reason).toBe(reason);
    worker.resolve();
    await pending;
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('preserves budget reason when a user cancels after expiry', async () => {
    const session = new BurnerSession();
    const worker = deferred<undefined>();
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(), execute: () => worker.promise });
    await vi.advanceTimersByTimeAsync(10);
    const reason = session.snapshot.abortController?.signal.reason;
    session.abortOperation();
    expect(session.snapshot.abortController?.signal.reason).toBe(reason);
    worker.resolve();
    await pending;
  });

  it('clears budget before a long save dialog but retains session ownership', async () => {
    const session = new BurnerSession();
    const dialog = deferred<undefined>();
    const success = vi.fn(() => dialog.promise);
    const error = vi.fn<(error: unknown) => void>();
    const pending = runBurnerFlow({ session, budgetMs: 10, syncState: vi.fn(), execute: () => Promise.resolve(1), onSuccess: success, onError: error });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.abortController?.signal.aborted).toBe(false);
    dialog.resolve();
    await pending;
    expect(error).not.toHaveBeenCalled();
  });

  it('captures settings on admission instead of rescheduling current work', async () => {
    AdvancedSettings.setSettings({ timeout: { operationBudgetEnabled: true, operation: 1000 } });
    const scope = effectScope();
    const state = required(scope.run(() => useCartBurnerSessionState(key => key)));
    const worker = deferred<undefined>();
    const error = vi.fn<(error: unknown) => void>();
    let signal: AbortSignal | undefined;
    const pending = state.executeOperation({ operation: value => { signal = value; return worker.promise; }, onError: error });
    AdvancedSettings.setSettings({ timeout: { operationBudgetEnabled: false, operation: 5000 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(signal?.aborted).toBe(true);
    worker.resolve();
    await pending;
    expect(error.mock.calls[0]?.[0]).toMatchObject({ code: 'timeout', message: 'Operation timeout in 1000ms' });
    scope.stop();
  });

  it('disposal wins before expiry and suppresses callbacks until real settlement', async () => {
    AdvancedSettings.setSettings({ timeout: { operationBudgetEnabled: true, operation: 1000 } });
    const scope = effectScope();
    const state = required(scope.run(() => useCartBurnerSessionState(key => key)));
    const worker = deferred<undefined>();
    const success = vi.fn();
    const error = vi.fn<(error: unknown) => void>();
    let signal: AbortSignal | undefined;
    const pending = state.executeOperation({ operation: value => { signal = value; return worker.promise; }, onSuccess: success, onError: error });
    scope.stop();
    const reason = signal?.reason;
    await vi.advanceTimersByTimeAsync(2000);
    expect(signal?.reason).toBe(reason);
    expect(state.burnerSession.snapshot.busy).toBe(true);
    worker.reject(new DOMException('Cancelled', 'AbortError'));
    await pending;
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds the shared device owner through delayed failing command reset', async () => {
    AdvancedSettings.setSettings({ timeout: { operationBudgetEnabled: true, operation: 1000 } });
    const device: DeviceInfo = { port: null, transport: {} as Transport };
    const scope = effectScope();
    const states = required(scope.run(() => [useCartBurnerSessionState(key => key, () => device), useCartBurnerSessionState(key => key, () => device)]));
    const reset = deferred<undefined>();
    const resetError = vi.fn();
    const timeoutError = vi.fn<(error: unknown) => void>();
    const pending = states[0].executeOperation({
      operation: () => runWithCommandBufferReset('session', () => Promise.resolve(1), () => reset.promise, resetError),
      onError: timeoutError,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(states[1].busy.value).toBe(true);
    await expect(states[1].executeOperation({ operation: () => Promise.resolve(), onError: vi.fn() })).rejects.toThrow('already running');
    const failure = new Error('reset failed');
    reset.reject(failure);
    await pending;
    expect(resetError).toHaveBeenCalledWith(failure);
    expect(timeoutError.mock.calls[0]?.[0]).toMatchObject({ code: 'timeout' });
    expect(states[1].busy.value).toBe(false);
    scope.stop();
  });

  it('device replacement cancels the old budget and never projects its result into the new session', async () => {
    AdvancedSettings.setSettings({ timeout: { operationBudgetEnabled: true, operation: 1000 } });
    const oldDevice: DeviceInfo = { port: null, transport: {} as Transport };
    const selected = shallowRef<DeviceInfo>(oldDevice);
    const scope = effectScope();
    const state = required(scope.run(() => useCartBurnerSessionState(key => key, () => selected.value)));
    const worker = deferred<undefined>();
    const success = vi.fn();
    const error = vi.fn<(error: unknown) => void>();
    const pending = state.executeOperation({ operation: () => worker.promise, onSuccess: success, onError: error });
    selected.value = { port: null, transport: {} as Transport };
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    expect(getDeviceOperationOwner(oldDevice)?.busy).toBe(true);
    expect(state.busy.value).toBe(false);
    worker.resolve();
    await pending;
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(getDeviceOperationOwner(oldDevice)?.busy).toBe(false);
    scope.stop();
  });

  it.each([0, -1, Infinity, NaN])('rejects invalid public budget %s before ownership acquisition', async budgetMs => {
    const session = new BurnerSession();
    await expect(runBurnerFlow({ session, budgetMs, syncState: vi.fn(), execute: () => Promise.resolve() })).rejects.toThrow('positive finite');
    expect(session.snapshot.busy).toBe(false);
  });
});
