import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';

import { runWithCommandBufferReset, useCartBurnerSessionState } from '@/composables/cartburner';
import { createCartridgeProtocolSession } from '@/features/burner/adapters';
import { DeviceGatewayConnectionPortAdapter } from '@/features/burner/adapters/device-gateway-connection-port';
import { ConnectionOrchestrationUseCase, createBurnerFacade } from '@/features/burner/application';
import { DeviceOperationOwner } from '@/features/burner/application/device-operation-owner';
import type { BurnerConnectionHandle } from '@/features/burner/application/domain/ports';
import type { DeviceGateway, Transport } from '@/platform/serial';
import type { CartridgeAdapter } from '@/services/cartridge-adapter';
import { executeDebugCommand } from '@/services/debug-protocol-service';
import { getDeviceOperationOwner, getTransportOperationOwner } from '@/services/device-operation-owner';
import { readRTC } from '@/services/tool-functions';
import type { DeviceInfo } from '@/types/device-info';

const protocol = vi.hoisted(() => ({ sendPackage: vi.fn(), getPackage: vi.fn() }));
vi.mock('@/protocol', async (original) => ({ ...await original<typeof import('@/protocol')>(), ...protocol }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function device(): DeviceInfo & { transport: Transport } { return { port: null, transport: {} as Transport }; }
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected value');
  return value;
}

describe('device operation ownership', () => {
  it('shares raw and reactive transport identity', () => {
    const current = device();
    expect(getDeviceOperationOwner(reactive(current))).toBe(getDeviceOperationOwner(current));
  });

  it('rejects a second UI, tools and debug through worker and reset settlement', async () => {
    const scope = effectScope();
    const current = device();
    const states = required(scope.run(() => [
      useCartBurnerSessionState(key => key, () => current),
      useCartBurnerSessionState(key => key, () => current),
    ]));
    const worker = deferred();
    const cleanup = deferred();
    const pending = states[0].executeOperation({
      cancellable: true,
      operation: () => runWithCommandBufferReset('adapter', () => worker.promise, () => cleanup.promise, vi.fn()),
      onError: vi.fn(),
    });
    expect(states[1].busy.value).toBe(true);
    const other = vi.fn(async () => {});
    await expect(states[1].executeOperation({ operation: other, onError: vi.fn() })).rejects.toThrow('already running');
    await expect(readRTC(current, 'GBA')).rejects.toThrow('already running');
    await expect(executeDebugCommand({ transport: current.transport, command: 0, receiveLength: 1 })).rejects.toThrow('already running');
    expect(protocol.sendPackage).not.toHaveBeenCalled();
    states[0].handleProgressStop();
    worker.resolve();
    await nextTick();
    expect(states[1].busy.value).toBe(true);
    cleanup.resolve();
    await pending;
    await states[1].executeOperation({ operation: other, onError: vi.fn() });
    expect(other).toHaveBeenCalledOnce();
    scope.stop();
  });

  it('holds debug ownership through its receive phase', async () => {
    const current = device();
    const receive = deferred();
    protocol.sendPackage.mockResolvedValue(undefined);
    protocol.getPackage.mockImplementation(async () => { await receive.promise; return { data: new Uint8Array([1]) }; });
    const pending = executeDebugCommand({ transport: current.transport, command: 0, receiveLength: 1 });
    await nextTick();
    await expect(readRTC(current, 'GBA')).rejects.toThrow('already running');
    receive.resolve();
    expect((await pending).responseData).toEqual(new Uint8Array([1]));
    expect(required(getDeviceOperationOwner(current)).busy).toBe(false);
  });

  it('drains cancellation and cleanup before gateway close and permits close retry', async () => {
    const current = device();
    const owner = required(getDeviceOperationOwner(current));
    const worker = deferred();
    const cleanup = deferred();
    const cancel = vi.fn();
    const running = owner.run(async () => { await worker.promise; await cleanup.promise; }, cancel);
    const disconnect = vi.fn().mockRejectedValueOnce(new Error('close failed')).mockResolvedValueOnce(undefined);
    const adapter = new DeviceGatewayConnectionPortAdapter({ disconnect } as unknown as DeviceGateway);
    const handle = { context: { platform: 'web', transport: current.transport } } as BurnerConnectionHandle;
    const closing = adapter.disconnect(handle);
    expect(cancel).toHaveBeenCalledOnce();
    await expect(owner.run(async () => {})).rejects.toThrow('connection closing');
    expect(disconnect).not.toHaveBeenCalled();
    worker.resolve();
    await nextTick();
    expect(disconnect).not.toHaveBeenCalled();
    cleanup.resolve();
    await running;
    expect((await closing).ok).toBe(false);
    await expect(owner.run(async () => {})).rejects.toThrow('connection closing');
    expect((await adapter.disconnect(handle)).ok).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(required(getDeviceOperationOwner(device())).busy).toBe(false);
  });

  it('isolates old UI settlement from replacement device progress', async () => {
    const scope = effectScope();
    const current = ref(device());
    const state = required(scope.run(() => useCartBurnerSessionState(key => key, () => current.value)));
    const worker = deferred();
    let oldSignal: AbortSignal | undefined;
    const old = state.executeOperation({
      cancellable: true,
      operation: signal => { oldSignal = signal; return worker.promise; },
      onError: vi.fn(),
    });
    const oldSession = state.burnerSession;
    current.value = device();
    await nextTick();
    expect(state.burnerSession).not.toBe(oldSession);
    expect(oldSignal?.aborted).toBe(true);
    state.burnerSession.addLog('now', 'new-device');
    state.syncSessionState();
    expect(state.logs.value.map(entry => entry.message)).toEqual(['new-device']);
    state.burnerSession.clearLogs();
    state.syncSessionState();
    expect(state.logs.value).toEqual([]);
    await state.executeOperation({
      updateProgress: { progress: 77, showProgress: true },
      operation: async () => {}, onError: vi.fn(),
    });
    worker.resolve();
    await old;
    expect(state.progressInfo.value.progress).toBe(77);
    expect(state.busy.value).toBe(false);
    const newWorker = deferred();
    let newSignal: AbortSignal | undefined;
    const newer = state.executeOperation({
      cancellable: true,
      operation: signal => { newSignal = signal; return newWorker.promise; },
      onError: vi.fn(),
    });
    state.handleProgressStop();
    expect(newSignal?.aborted).toBe(true);
    newWorker.resolve();
    await newer;
    scope.stop();
  });

  it('automatic reconnect waits for a live adapter reset before opening the replacement', async () => {
    const first = device();
    const replacement = device();
    const connect = vi.fn()
      .mockResolvedValueOnce({ platform: 'web', transport: first.transport })
      .mockResolvedValueOnce({ platform: 'web', transport: replacement.transport });
    const disconnect = vi.fn(async () => {});
    const adapter = new DeviceGatewayConnectionPortAdapter({
      connect, disconnect, init: vi.fn(async () => {}),
    } as unknown as DeviceGateway);
    const connection = new ConnectionOrchestrationUseCase(adapter);
    const selection = { context: {}, portInfo: { path: 'test' } };
    expect((await connection.prepareConnectionWithSelection(selection)).success).toBe(true);
    const owner = required(getDeviceOperationOwner(first));
    const worker = deferred();
    const cleanup = deferred();
    const reset = vi.fn(() => cleanup.promise);
    const session = createCartridgeProtocolSession({ resetCommandBuffer: reset } as unknown as CartridgeAdapter, 'test', {
      isActive: () => owner.connected,
    });
    const facade = createBurnerFacade({ translate: key => key, formatHex: value => String(value) });
    const pending = owner.run(() => runWithCommandBufferReset(session, () => worker.promise, () => facade.resetCommandBuffer(session), error => { throw error; }));
    const reconnecting = connection.reconnectWithSelection(selection);
    await nextTick();
    expect(owner.available).toBe(false);
    expect(owner.connected).toBe(true);
    await expect(owner.run(async () => {})).rejects.toThrow('connection closing');
    worker.resolve();
    await nextTick();
    expect(reset).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledOnce();
    cleanup.resolve();
    await pending;
    expect((await reconnecting).success).toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledTimes(2);
    expect(owner.connected).toBe(false);
    expect(required(getDeviceOperationOwner(replacement)).available).toBe(true);
  });

  it('survives observer and cancellation callback exceptions', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const owner = new DeviceOperationOwner();
    owner.subscribe(() => { throw new Error('observer'); });
    await owner.run(async () => {});
    expect(owner.busy).toBe(false);
    const worker = deferred();
    const running = owner.run(() => worker.promise, () => { throw new Error('cancel'); });
    const close = vi.fn(async () => {});
    const closing = owner.close(close);
    worker.resolve();
    await running;
    await closing;
    expect(close).toHaveBeenCalledOnce();
    errors.mockRestore();
  });
});
