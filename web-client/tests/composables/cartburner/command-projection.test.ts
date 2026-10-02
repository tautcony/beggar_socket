import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, shallowRef } from 'vue';

import { useCartBurnerSessionState } from '@/composables/cartburner';
import { runWithCommandBufferReset } from '@/features/burner/application/command-transaction';
import type { Transport } from '@/platform/serial';
import { getDeviceOperationOwner } from '@/services/device-operation-owner';
import type { DeviceInfo } from '@/types/device-info';
import { errorToBurnerLog } from '@/utils/burner-log';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function setup() {
  const scope = effectScope();
  const device = shallowRef<DeviceInfo>({ port: null, transport: {} as Transport });
  const state = scope.run(() => useCartBurnerSessionState(key => key, () => device.value));
  if (!state) throw new Error('missing state');
  return { scope, state, device };
}

describe('admitted command presentation projection', () => {
  it('ignores deferred adapter log and progress callbacks after scope disposal', async () => {
    const { scope, state } = setup();
    const callback = deferred<undefined>();
    state.updateProgress({ progress: 12, state: 'running', showProgress: true });
    state.log('current log');
    const progress = { ...state.progressInfo.value };
    const logs = [...state.logs.value];
    const late = callback.promise.then(() => {
      state.updateProgress({ progress: 99, state: 'error', showProgress: true });
      state.log('late adapter error', 'error');
    });
    scope.stop(); callback.resolve(undefined); await late;
    expect(state.progressInfo.value).toEqual(progress);
    expect(state.logs.value).toEqual(logs);
  });
  it.each(['cancel', 'replace', 'dispose', 'same-transport-replacement'] as const)('blocks late success after %s', async (reason) => {
    const { scope, state, device } = setup();
    const worker = deferred<Uint8Array>();
    const cleanup = deferred<undefined>();
    const exportFile = vi.fn();
    const onError = vi.fn();
    const oldOwner = getDeviceOperationOwner(device.value);
    const pending = state.executeOperation({ cancellable: true,
      operation: () => runWithCommandBufferReset('device', () => worker.promise, () => cleanup.promise, vi.fn()),
      onSuccess: exportFile, onError });
    if (reason === 'cancel') state.handleProgressStop();
    if (reason === 'replace') device.value = { port: null, transport: {} as Transport };
    if (reason === 'same-transport-replacement') device.value = { ...device.value };
    if (reason === 'dispose') scope.stop();
    worker.resolve(new Uint8Array([1]));
    await nextTick();
    expect(oldOwner?.busy).toBe(true);
    cleanup.resolve(undefined); await pending;
    expect(exportFile).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(oldOwner?.busy).toBe(false);
    scope.stop();
  });

  it('keeps cancellation cleanup failure diagnostic and exact cause while suppressing success', async () => {
    const { scope, state } = setup();
    const worker = deferred<undefined>();
    const diagnostic = Object.assign(new Error('reset failed'), { code: 'transport_failure' as const, stage: 'transport' as const, recoverable: true, cause: { code: 'usb' } });
    const onSuccess = vi.fn();
    const pending = state.executeOperation({ cancellable: true,
      operation: (_signal, isAttached) => runWithCommandBufferReset('device', () => worker.promise,
        () => { throw diagnostic; }, error => { if (isAttached?.()) state.log(errorToBurnerLog('Reset failed', error), 'error'); }),
      onSuccess, onError: vi.fn() });
    state.handleProgressStop(); worker.resolve(undefined); await pending;
    expect(onSuccess).not.toHaveBeenCalled();
    expect(state.logs.value[0]?.diagnostic).toBe(diagnostic);
    expect(state.logs.value[0]?.diagnostic?.cause).toBe(diagnostic.cause);
    scope.stop();
  });

  it.each(['dispose', 'replace'] as const)('suppresses late thrown-error presentation after %s', async (reason) => {
    const { scope, state, device } = setup();
    const worker = deferred<undefined>(); const onError = vi.fn();
    const pending = state.executeOperation({ operation: () => worker.promise, onError });
    if (reason === 'dispose') scope.stop();
    else device.value = { port: null, transport: {} as Transport };
    worker.reject(new Error('late failure')); await pending;
    expect(onError).not.toHaveBeenCalled(); scope.stop();
  });

  it('holds ownership through awaited save and supplies a guard for post-dialog projection', async () => {
    const { scope, state } = setup(); const save = deferred<undefined>(); const afterSave = vi.fn();
    let projecting = false;
    const pending = state.executeOperation({ cancellable: true, operation: () => Promise.resolve('bytes'),
      onSuccess: async (_result, isCurrent) => { projecting = true; await save.promise; if (isCurrent()) afterSave(); }, onError: vi.fn() });
    await nextTick(); expect(projecting).toBe(true); expect(state.busy.value).toBe(true);
    const clearChipInfo = vi.fn();
    await expect(state.executeOperation({ operation: () => { clearChipInfo(); return Promise.resolve(); }, onError: vi.fn() })).rejects.toThrow('already running');
    expect(clearChipInfo).not.toHaveBeenCalled();
    state.handleProgressStop(); save.resolve(undefined); await pending;
    expect(afterSave).not.toHaveBeenCalled(); expect(state.busy.value).toBe(false); scope.stop();
  });
});
