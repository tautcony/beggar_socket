import { describe, expect, it, vi } from 'vitest';

import { CartridgeProtocolPortAdapter } from '@/features/burner/adapters';
import { BurnerSession } from '@/features/burner/application/burner-session';
import { type BurnerOperationContext, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import { runBurnerFlow } from '@/features/burner/application/flow-template';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const t = (key: string) => key;
const toHex = (value: number) => `0x${value.toString(16)}`;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createFakeCfi(deviceSize = 0x20000): CFIInfo {
  return {
    deviceSize,
    flashId: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    eraseSectorBlocks: [
      {
        sectorSize: 0x10000,
        sectorCount: Math.max(1, deviceSize / 0x10000),
        totalSize: deviceSize,
        startAddress: 0,
        endAddress: deviceSize,
      },
    ],
  } as CFIInfo;
}

function createSession(overrides: Partial<BurnerProtocolSession> = {}): BurnerProtocolSession {
  const base: BurnerProtocolSession = {
    id: 'session-1',
    isActive: () => true,
    getCartInfo: () => Promise.resolve(createFakeCfi()),
    eraseSectors: () => Promise.resolve({ success: true, message: 'erase-ok' }),
    writeROM: () => Promise.resolve({ success: true, message: 'write-rom-ok' }),
    readROM: () => Promise.resolve({ success: true, message: 'read-rom-ok', data: new Uint8Array([1, 2, 3]) }),
    verifyROM: () => Promise.resolve({ success: true, message: 'verify-rom-ok' }),
    writeRAM: () => Promise.resolve({ success: true, message: 'write-ram-ok' }),
    readRAM: () => Promise.resolve({ success: true, message: 'read-ram-ok', data: new Uint8Array([4, 5]) }),
    verifyRAM: () => Promise.resolve({ success: true, message: 'verify-ram-ok' }),
    resetCommandBuffer: () => Promise.resolve(),
  };

  return {
    ...base,
    ...overrides,
  };
}

function createUseCase() {
  return new BurnerUseCaseImpl(new CartridgeProtocolPortAdapter(), t, toHex);
}

function createContext(
  session: BurnerProtocolSession,
  cfi = createFakeCfi(),
  extra: Partial<BurnerOperationContext> = {},
): BurnerOperationContext {
  return {
    session,
    cfiInfo: cfi,
    options: { cfiInfo: cfi, mbcType: 'MBC5', enable5V: false },
    ...extra,
  };
}

describe('BurnerSession', () => {
  it('should manage cancellable operation lifecycle', () => {
    const session = new BurnerSession();

    const signal = session.startOperation(true);
    expect(signal).toBeDefined();
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.abortController).not.toBeNull();

    session.abortOperation();
    expect(session.snapshot.busy).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(() => session.startOperation()).toThrow('already running');
    session.completeOperation(session.snapshot.operationToken);
    expect(session.snapshot.busy).toBe(false);
  });

  it('should append and trim logs', () => {
    const session = new BurnerSession();
    for (let i = 0; i < 510; i++) {
      session.addLog(String(i), `message-${i}`, 'info');
    }

    expect(session.snapshot.logs.length).toBe(500);
    expect(session.snapshot.logs[0].message).toBe('message-10');
  });

  it('should keep progress contract stable for UI consumption', () => {
    const session = new BurnerSession();

    session.updateProgress({
      type: 'write',
      progress: 42,
      detail: 'writing',
      state: 'running',
      showProgress: true,
    });

    expect(session.snapshot.progress.type).toBe('write');
    expect(session.snapshot.progress.progress).toBe(42);
    expect(session.snapshot.progress.detail).toBe('writing');
    expect(session.snapshot.progress.state).toBe('running');
    expect(session.snapshot.progress.showProgress).toBe(true);

    session.resetProgress();
    expect(session.snapshot.progress.progress).toBeNull();
    expect(session.snapshot.progress.state).toBe('idle');
  });

  it('should support clearing logs explicitly', () => {
    const session = new BurnerSession();
    session.addLog('10:00:00', 'log-1', 'info');
    session.addLog('10:00:01', 'log-2', 'warn');

    session.clearLogs();

    expect(session.snapshot.logs).toEqual([]);
  });

  it.each(['resolve', 'reject'] as const)('retains timeout ownership until late worker %s', async (outcome) => {
    vi.useFakeTimers();
    try {
      const session = new BurnerSession();
      const worker = deferred<string>();
      const timed = session.runWithTimeout(() => worker.promise, 10);
      const rejection = expect(timed).rejects.toThrow('Operation timeout');
      await vi.advanceTimersByTimeAsync(10);
      await rejection;
      expect(session.snapshot.busy).toBe(true);
      expect(() => session.startOperation()).toThrow('already running');
      if (outcome === 'resolve') worker.resolve('late');
      else worker.reject(new Error('late failure'));
      await Promise.resolve();
      await Promise.resolve();
      expect(session.snapshot.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a stale completion token', () => {
    const session = new BurnerSession();
    session.startOperation();
    const oldToken = session.snapshot.operationToken;
    session.completeOperation(oldToken);
    session.startOperation();
    session.completeOperation(oldToken);
    expect(session.snapshot.busy).toBe(true);
    session.completeOperation(session.snapshot.operationToken);
    expect(session.snapshot.busy).toBe(false);
  });

  it('preserves timeout helper success and worker failure', async () => {
    const session = new BurnerSession();
    await expect(session.runWithTimeout(() => Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    expect(session.snapshot.busy).toBe(false);
    const failure = new Error('worker failed');
    await expect(session.runWithTimeout(() => Promise.reject(failure), 1000)).rejects.toBe(failure);
    expect(session.snapshot.busy).toBe(false);
  });
});

describe('runBurnerFlow', () => {
  it('runs cleanup and releases ownership when progress projection throws', async () => {
    const session = new BurnerSession();
    const failure = new Error('projection failed');
    const onFinally = vi.fn(() => {
      expect(session.snapshot.busy).toBe(true);
    });
    await expect(runBurnerFlow({
      session,
      syncState: () => { if (session.snapshot.phase === 'recovering') throw failure; },
      execute: () => Promise.resolve('ok'), onFinally,
    })).rejects.toBe(failure);
    expect(onFinally).toHaveBeenCalledOnce();
    expect(session.snapshot.busy).toBe(false);
  });

  it('skips success side effects for a cancelled worker that resolves late', async () => {
    const session = new BurnerSession();
    const worker = deferred<string>();
    const onSuccess = vi.fn();
    const flow = runBurnerFlow({
      session, cancellable: true, syncState: () => {}, execute: () => worker.promise, onSuccess,
    });
    session.abortOperation();
    worker.resolve('late');
    await expect(flow).resolves.toBe('late');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(session.snapshot.busy).toBe(false);
    await expect(runBurnerFlow({
      session, cancellable: true, syncState: () => {}, execute: () => Promise.resolve('normal'), onSuccess,
    })).resolves.toBe('normal');
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith('normal');
  });
  it('preserves successful progress reset before delayed cleanup while retaining ownership', async () => {
    const session = new BurnerSession();
    const cleanup = deferred<undefined>();
    const onFinally = vi.fn(() => {
      expect(session.snapshot.busy).toBe(true);
      expect(session.snapshot.progress.state).toBe('idle');
      return cleanup.promise;
    });
    const flow = runBurnerFlow({
      session, syncState: () => {}, resetProgressOnFinish: true,
      updateProgress: { progress: 100, state: 'running' },
      execute: () => Promise.resolve('ok'), onFinally,
    });
    await vi.waitFor(() => { expect(onFinally).toHaveBeenCalledOnce(); });
    expect(() => session.startOperation()).toThrow('already running');
    cleanup.resolve(undefined);
    await expect(flow).resolves.toBe('ok');
    expect(session.snapshot.busy).toBe(false);
  });

  it('releases ownership when an error handler rejects', async () => {
    const session = new BurnerSession();
    const failure = new Error('error handler failed');
    await expect(runBurnerFlow({
      session, syncState: () => {}, execute: () => Promise.reject(new Error('worker failed')),
      onError: () => Promise.reject(failure),
    })).rejects.toBe(failure);
    expect(session.snapshot.busy).toBe(false);
  });
  it('retains ownership through deferred cancellation and cleanup', async () => {
    const session = new BurnerSession();
    const worker = deferred<string>();
    const cleanup = deferred<undefined>();
    const onFinally = vi.fn(() => cleanup.promise);
    const flow = runBurnerFlow({ session, cancellable: true, syncState: () => {}, execute: () => worker.promise, onFinally });
    session.abortOperation();
    expect(session.snapshot.busy).toBe(true);
    const replacement = vi.fn(() => Promise.resolve('replacement'));
    await expect(runBurnerFlow({ session, syncState: () => {}, execute: replacement })).rejects.toThrow('already running');
    expect(replacement).not.toHaveBeenCalled();
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    worker.reject(aborted);
    await vi.waitFor(() => { expect(onFinally).toHaveBeenCalledOnce(); });
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.phase).toBe('recovering');
    cleanup.resolve(undefined);
    await expect(flow).resolves.toBeUndefined();
    expect(session.snapshot.busy).toBe(false);
  });

  it('releases ownership even when cleanup rejects', async () => {
    const session = new BurnerSession();
    const failure = new Error('cleanup failed');
    await expect(runBurnerFlow({
      session, syncState: () => {}, execute: () => Promise.resolve('ok'),
      onFinally: () => { expect(session.snapshot.busy).toBe(true); return Promise.reject(failure); },
    })).rejects.toBe(failure);
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.phase).toBe('idle');
  });

  it('should apply shared lifecycle for progress and busy state', async () => {
    const session = new BurnerSession();
    const busyStates: boolean[] = [];

    const result = await runBurnerFlow<unknown>({
      session,
      cancellable: true,
      updateProgress: { progress: 0, detail: 'start' },
      resetProgressOnFinish: true,
      syncState: (snapshot) => {
        busyStates.push(snapshot.busy);
      },
      execute: ({ signal }) => {
        expect(signal).toBeDefined();
        session.updateProgress({ progress: 50, detail: 'halfway' });
        return Promise.resolve('ok');
      },
    });

    expect(result).toBe('ok');
    expect(busyStates[0]).toBe(true);
    expect(busyStates[busyStates.length - 1]).toBe(false);
    expect(session.snapshot.progress.progress).toBeNull();
    expect(session.snapshot.progress.state).toBe('idle');
  });

  it('should treat AbortError as cancellation without throwing', async () => {
    const session = new BurnerSession();
    const log = vi.fn();
    const syncState = vi.fn();

    await runBurnerFlow({
      session,
      cancellable: true,
      syncState,
      log,
      cancelLogMessage: 'cancelled',
      execute: () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      },
    });

    expect(log).toHaveBeenCalledWith('cancelled', 'warn');
    expect(session.snapshot.busy).toBe(false);
  });

  it('should recover session state after runtime error and allow next operation', async () => {
    const session = new BurnerSession();
    const onError = vi.fn();

    await runBurnerFlow({
      session,
      cancellable: true,
      syncState: () => {},
      onError,
      execute: () => Promise.reject(new Error('runtime fail')),
    });

    expect(onError).toHaveBeenCalled();
    expect(session.snapshot.busy).toBe(false);

    const nextResult = await runBurnerFlow({
      session,
      syncState: () => {},
      execute: () => Promise.resolve('next-ok'),
    });
    expect(nextResult).toBe('next-ok');
    expect(session.snapshot.busy).toBe(false);
  });

  it('should converge lifecycle after cancellation and support subsequent flow', async () => {
    const session = new BurnerSession();
    const cancellation = runBurnerFlow({
      session,
      cancellable: true,
      syncState: () => {},
      execute: ({ signal }) => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    });

    session.abortOperation();
    await cancellation;
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.abortController).toBeNull();

    const result = await runBurnerFlow({
      session,
      syncState: () => {},
      execute: () => Promise.resolve('ok'),
    });
    expect(result).toBe('ok');
    expect(session.snapshot.busy).toBe(false);
  });
});

describe('BurnerUseCaseImpl', () => {
  it('readCart should return normalized success payload', async () => {
    const cfi = createFakeCfi();
    const session = createSession({
      getCartInfo: vi.fn().mockResolvedValue(cfi),
    });

    const useCase = createUseCase();
    const result = await useCase.readCart(session, false);

    expect(result.success).toBe(true);
    expect(result.cfiInfo).toBe(cfi);
    expect(result.chipId).toEqual([0x01, 0x02, 0x03, 0x04]);
    expect(result.romSizeHex).toBe('0x20000');
  });

  it('eraseChip should delegate to port-backed session eraseSectors', async () => {
    const cfi = createFakeCfi();
    const eraseResult: CommandResult = { success: true, message: 'ok' };
    const eraseSectors = vi.fn().mockResolvedValue(eraseResult);
    const session = createSession({ eraseSectors });

    const useCase = createUseCase();
    const result = await useCase.eraseChip(createContext(session, cfi));

    expect(eraseSectors).toHaveBeenCalledOnce();
    expect(result).toEqual(eraseResult);
  });

  it('readCart should return normalized failure when session returns falsy info', async () => {
    const session = createSession({
      getCartInfo: vi.fn().mockResolvedValue(false),
    });

    const useCase = createUseCase();
    const result = await useCase.readCart(session, true);

    expect(result.success).toBe(false);
    expect(result.message).toContain('messages.operation.readCartFailed');
  });

  it('readCart should normalize runtime error message', async () => {
    const session = createSession({
      getCartInfo: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const useCase = createUseCase();
    const result = await useCase.readCart(session, true);

    expect(result.success).toBe(false);
    expect(result.message).toContain('messages.operation.readCartFailed');
    expect(result.message).toContain('boom');
  });

  it('write/read rom and ram flows should preserve command result contracts', async () => {
    const cfi = createFakeCfi();
    const session = createSession({
      writeROM: vi.fn().mockResolvedValue({ success: true, message: 'write-rom-ok' }),
      readROM: vi.fn().mockResolvedValue({ success: true, message: 'read-rom-ok', data: new Uint8Array([1, 2, 3]) }),
      writeRAM: vi.fn().mockResolvedValue({ success: true, message: 'write-ram-ok' }),
      readRAM: vi.fn().mockResolvedValue({ success: true, message: 'read-ram-ok', data: new Uint8Array([4, 5]) }),
    });

    const useCase = createUseCase();
    const context = createContext(session, cfi);

    const romWrite = await useCase.writeRom({ ...context, data: new Uint8Array([0x11]) });
    const romRead = await useCase.readRom({ ...context, size: 3, showProgress: false });
    const ramWrite = await useCase.writeRam({ ...context, data: new Uint8Array([0x22]) });
    const ramRead = await useCase.readRam({ ...context, size: 2 });

    expect(romWrite).toEqual({ success: true, message: 'write-rom-ok' });
    expect(romRead).toEqual({ success: true, message: 'read-rom-ok', data: new Uint8Array([1, 2, 3]) });
    expect(ramWrite).toEqual({ success: true, message: 'write-ram-ok' });
    expect(ramRead).toEqual({ success: true, message: 'read-ram-ok', data: new Uint8Array([4, 5]) });
  });

  it('should normalize failure then recover on next operation with the same session', async () => {
    const readROM = vi
      .fn()
      .mockResolvedValueOnce({ success: false, message: 'first fail' })
      .mockResolvedValueOnce({ success: true, message: 'second ok', data: new Uint8Array([0xaa]) });
    const session = createSession({ readROM });
    const useCase = createUseCase();
    const context = createContext(session);

    const first = await useCase.readRom({ ...context, size: 1, showProgress: false });
    const second = await useCase.readRom({ ...context, size: 1, showProgress: false });

    expect(first.success).toBe(false);
    expect(first.message).toBe('first fail');
    expect(second.success).toBe(true);
    expect(second.message).toBe('second ok');
  });

  it('should block burner operation when connection precondition is not active and recover after reconnect', async () => {
    const isActive = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const readROM = vi.fn().mockResolvedValue({ success: true, message: 'read-ok', data: new Uint8Array([0x42]) });
    const session = createSession({
      isActive,
      readROM,
    });
    const useCase = createUseCase();
    const context = createContext(session);

    const first = await useCase.readRom({ ...context, size: 1, showProgress: false });
    expect(first.success).toBe(false);
    expect(first.message).toBe('Device not connected');

    const second = await useCase.readRom({ ...context, size: 1, showProgress: false });
    expect(second.success).toBe(true);
    expect(second.message).toBe('read-ok');
  });
});
