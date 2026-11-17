import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { useConnectionOperationBusy } from '@/composables/useConnectionOperationBusy';
import { ConnectionOperationCoordinator } from '@/features/burner/application';
import { DeviceConnectionManager } from '@/services/device-connection-manager';
import type { DeviceInfo } from '@/types/device-info';

describe('ConnectionOperationCoordinator', () => {
  it('rejects concurrent requests with busy without executing them', async () => {
    const coordinator = new ConnectionOperationCoordinator();
    let releaseOuter!: () => void;
    const outerGate = new Promise<void>((resolve) => {
      releaseOuter = resolve;
    });
    const secondaryFn = vi.fn();

    const outerPromise = coordinator.runExclusive({
      currentGeneration: () => 1,
      fn: async () => {
        await outerGate;
        return 'done';
      },
    });

    expect(coordinator.isBusy).toBe(true);

    const concurrentResult = await coordinator.runExclusive({
      currentGeneration: () => 1,
      fn: secondaryFn,
    });

    expect(concurrentResult).toEqual({
      ok: false,
      reason: 'busy',
      message: 'Device connection is busy with another operation',
    });
    expect(secondaryFn).not.toHaveBeenCalled();

    releaseOuter();
    await expect(outerPromise).resolves.toEqual({ ok: true, value: 'done' });
    expect(coordinator.isBusy).toBe(false);
  });

  it('reuses ownership for re-entrant nested calls with the active token', async () => {
    const coordinator = new ConnectionOperationCoordinator();
    const events: string[] = [];

    const result = await coordinator.runExclusive({
      currentGeneration: () => 1,
      fn: async (token) => {
        events.push('outer-start');
        const nested = await coordinator.runExclusive({
          token,
          currentGeneration: () => 1,
          fn: async (nestedToken) => {
            expect(nestedToken).toBe(token);
            events.push('nested');
            return 42;
          },
        });
        expect(nested).toEqual({ ok: true, value: 42 });
        expect(coordinator.isBusy).toBe(true);
        events.push('outer-end');
        return 'ok';
      },
    });

    expect(result).toEqual({ ok: true, value: 'ok' });
    expect(events).toEqual(['outer-start', 'nested', 'outer-end']);
    expect(coordinator.isBusy).toBe(false);
  });

  it('holds ownership until cleanup (power restore + command buffer reset) finishes', async () => {
    const coordinator = new ConnectionOperationCoordinator();
    const timeline: string[] = [];
    const unsubscribe = coordinator.subscribe((busy) => {
      timeline.push(`busy:${busy}`);
    });

    await coordinator.runExclusive({
      currentGeneration: () => 1,
      fn: async () => {
        timeline.push('op');
        try {
          throw new Error('simulated failure');
        } finally {
          await Promise.resolve();
          timeline.push(`restore3.3v:busy=${coordinator.isBusy}`);
          await Promise.resolve();
          timeline.push(`resetCmdBuf:busy=${coordinator.isBusy}`);
        }
      },
    });

    unsubscribe();
    expect(timeline).toEqual([
      'busy:true',
      'op',
      'restore3.3v:busy=true',
      'resetCmdBuf:busy=true',
      'busy:false',
    ]);
  });

  it('blocks DeviceConnectionManager reset/disconnect and updates shared UI busy state while an operation is active', async () => {
    const manager = DeviceConnectionManager.getInstance();
    let releaseOp!: () => void;
    const opGate = new Promise<void>((resolve) => {
      releaseOp = resolve;
    });

    const scope = effectScope();
    const uiState = scope.run(() => useConnectionOperationBusy())!;
    expect(uiState.connectionBusy.value).toBe(false);

    const activeOp = manager.runConnectionOperation({
      requireConnected: false,
      fn: async () => {
        await opGate;
        return 'finished';
      },
    });

    expect(uiState.connectionBusy.value).toBe(true);

    const mockDevice: DeviceInfo = {
      port: null,
      connection: null,
      transport: null,
    };

    await expect(manager.initializeDevice(mockDevice)).rejects.toMatchObject({ code: 'busy' });
    await expect(manager.disconnectDevice(mockDevice)).rejects.toMatchObject({ code: 'busy' });

    releaseOp();
    await expect(activeOp).resolves.toEqual({ ok: true, value: 'finished' });
    expect(uiState.connectionBusy.value).toBe(false);
    scope.stop();
  });
});
