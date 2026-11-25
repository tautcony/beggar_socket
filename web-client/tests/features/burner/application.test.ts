import { describe, expect, it, vi } from 'vitest';

import { firmwareUnsupportedResult, STM_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { BurnerSession } from '@/features/burner/application/burner-session';
import { type BurnerOperationContext, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import { runBurnerFlow } from '@/features/burner/application/flow-template';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const t = (key: string) => key;
const toHex = (value: number) => `0x${value.toString(16)}`;

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
  return new BurnerUseCaseImpl(t, toHex);
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
  it('should manage cancellable operation lifecycle and keep busy until completion', () => {
    const session = new BurnerSession();

    const signal = session.startOperation(true);
    expect(signal).toBeDefined();
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.cancelling).toBe(false);
    expect(session.snapshot.abortController).not.toBeNull();

    session.abortOperation();
    expect(signal?.aborted).toBe(true);
    expect(session.snapshot.cancelling).toBe(true);
    expect(session.snapshot.busy).toBe(true);
    expect(() => session.startOperation(true)).toThrow('Burner session is busy');

    session.completeOperation();
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.cancelling).toBe(false);
    expect(session.snapshot.abortController).toBeNull();
  });

  it('keeps lock until in-flight runBurnerFlow promise settles after abortOperation', async () => {
    const session = new BurnerSession();
    let releaseInFlight!: () => void;
    const inFlightGate = new Promise<void>((resolve) => {
      releaseInFlight = resolve;
    });

    const firstFlow = runBurnerFlow({
      session,
      cancellable: true,
      syncState: () => {},
      execute: async () => {
        await inFlightGate;
        return 'done';
      },
    });

    session.abortOperation();
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.cancelling).toBe(true);
    await expect(runBurnerFlow({
      session,
      cancellable: true,
      syncState: () => {},
      execute: () => Promise.resolve('second'),
    })).rejects.toThrow('Burner session is busy');

    releaseInFlight();
    await firstFlow;
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.cancelling).toBe(false);
  });

  it('runWithTimeout aborts on deadline and releases busy only after operation settles', async () => {
    const session = new BurnerSession();
    let releaseSlowOp!: () => void;
    let capturedSignal: AbortSignal | undefined;

    const slowOpPromise = session.runWithTimeout(async () => {
      capturedSignal = session.snapshot.abortController?.signal;
      await new Promise<void>((resolve) => {
        releaseSlowOp = resolve;
      });
      return 'late-result';
    }, 10);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(capturedSignal?.aborted).toBe(true);
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.cancelling).toBe(true);

    releaseSlowOp();
    await expect(slowOpPromise).rejects.toThrow('Operation timeout in 10ms');
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.cancelling).toBe(false);
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

  it('should converge lifecycle state when operation times out', async () => {
    const session = new BurnerSession();

    await expect(session.runWithTimeout(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return 'ok';
    }, 1)).rejects.toThrow('Operation timeout');

    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.abortController).toBeNull();
  });
});

describe('runBurnerFlow', () => {
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

  it('readCart should forward CommandOptions and surface profile_ambiguous / profile_not_found with details', async () => {
    const cfi = createFakeCfi();
    const getCartInfo = vi.fn().mockResolvedValue(cfi);
    const session = createSession({ getCartInfo });
    const useCase = createUseCase();

    await useCase.readCart(session, false, { flashcartProfileId: 'agb:custom' });
    expect(getCartInfo).toHaveBeenCalledWith(false, { flashcartProfileId: 'agb:custom' });

    const candidates = [{ id: 'agb:a', names: ['Cart A'] }, { id: 'agb:b', names: ['Cart B'] }];
    const ambiguousSession = createSession({
      getCartInfo: vi.fn().mockResolvedValue(false),
      getLastCartInfoError: () => 'Multiple flashcart profiles matched',
      getLastCartInfoErrorCode: () => 'profile_ambiguous',
      getLastCartInfoErrorDetails: () => ({ candidates }),
    });
    const ambiguousRes = await useCase.readCart(ambiguousSession, false);
    expect(ambiguousRes.success).toBe(false);
    expect(ambiguousRes.errorCode).toBe('profile_ambiguous');
    expect(ambiguousRes.details).toEqual({ candidates });

    const notFoundSession = createSession({
      getCartInfo: vi.fn().mockResolvedValue(false),
      getLastCartInfoError: () => 'No matching flashcart profile found',
      getLastCartInfoErrorCode: () => 'profile_not_found',
    });
    const notFoundRes = await useCase.readCart(notFoundSession, true);
    expect(notFoundRes.success).toBe(false);
    expect(notFoundRes.errorCode).toBe('profile_not_found');

    const thrownAmbiguousSession = createSession({
      getCartInfo: vi.fn().mockRejectedValue(
        Object.assign(new Error('Ambiguous profile'), { code: 'profile_ambiguous', details: { candidates } }),
      ),
    });
    const thrownRes = await useCase.readCart(thrownAmbiguousSession, false);
    expect(thrownRes.success).toBe(false);
    expect(thrownRes.errorCode).toBe('profile_ambiguous');
    expect(thrownRes.details).toEqual({ candidates });
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

  it('preserves error classification for timeout, cancellation, disconnect, and unsupported capability without round-trip loss', async () => {
    const useCase = createUseCase();

    const timeoutSession = createSession({
      readROM: () => Promise.reject(Object.assign(new Error('Read timeout after 3000ms'), { code: 'TIMEOUT' })),
    });
    const timeoutRes = await useCase.readRom({ ...createContext(timeoutSession), size: 1 });
    expect(timeoutRes).toMatchObject({
      success: false,
      errorCode: 'timeout',
      errorStage: 'transport',
      message: 'Read timeout after 3000ms',
    });

    const cancelErr = new Error('Operation aborted');
    cancelErr.name = 'AbortError';
    const cancelSession = createSession({
      writeROM: () => Promise.reject(cancelErr),
    });
    const cancelRes = await useCase.writeRom({ ...createContext(cancelSession), data: new Uint8Array([1]) });
    expect(cancelRes).toMatchObject({
      success: false,
      errorCode: 'aborted',
      errorStage: 'transport',
      message: 'Operation aborted',
    });

    const disconnectedSession = createSession({ isActive: () => false });
    const disconnectedRes = await useCase.readRam({ ...createContext(disconnectedSession), size: 1 });
    expect(disconnectedRes).toMatchObject({
      success: false,
      errorCode: 'not_connected',
      errorStage: 'session',
      message: 'Device not connected',
    });

    const unsupportedSession = createSession({
      writeROM: () => Promise.resolve(firmwareUnsupportedResult('MBC 5V power control', STM_FIRMWARE_PROFILE)),
    });
    const unsupportedRes = await useCase.writeRom({ ...createContext(unsupportedSession), data: new Uint8Array([1]) });
    expect(unsupportedRes).toMatchObject({
      success: false,
      errorCode: 'unsupported',
      errorStage: 'protocol',
      message: `MBC 5V power control is not supported by ${STM_FIRMWARE_PROFILE.label} firmware`,
    });
  });

  it('preserves underlying readCartInfo failure causes instead of generic No cart info returned', async () => {
    const useCase = createUseCase();

    // 1. 5V unsupported / CFI parse failure via getLastCartInfoError
    const cfiFailSession = createSession({
      getCartInfo: () => Promise.resolve(false),
      getLastCartInfoError: () => 'messages.operation.cfiParseFailed',
    });
    const cfiFailRes = await useCase.readCart(cfiFailSession, false);
    expect(cfiFailRes.success).toBe(false);
    expect(cfiFailRes.message).toContain('messages.operation.cfiParseFailed');
    expect(cfiFailRes.message).not.toContain('No cart info returned');

    // 2. Timeout thrown by getCartInfo
    const timeoutCartSession = createSession({
      getCartInfo: () => Promise.reject(Object.assign(new Error('Packet timeout'), { code: 'PACKET_TIMEOUT' })),
    });
    const timeoutCartRes = await useCase.readCart(timeoutCartSession, false);
    expect(timeoutCartRes).toMatchObject({
      success: false,
      errorCode: 'timeout',
      errorStage: 'protocol',
    });
    expect(timeoutCartRes.message).toContain('Packet timeout');

    // 3. Disconnected session
    const disconnectedCartSession = createSession({ isActive: () => false });
    const disconnectedCartRes = await useCase.readCart(disconnectedCartSession, false);
    expect(disconnectedCartRes).toMatchObject({
      success: false,
      errorCode: 'not_connected',
      errorStage: 'session',
      message: 'Device not connected',
    });
  });

  it('distinguishes bulk-only and read-only CFI in eraseChip when eraseSectorBlocks is empty', async () => {
    const useCase = createUseCase();
    const eraseSectors = vi.fn(() => Promise.resolve({ success: true, message: 'chip-erased' }));
    const session = createSession({ eraseSectors });

    const bulkOnlyCfi: CFIInfo = {
      ...createFakeCfi(0x100000),
      eraseSectorBlocks: [],
      chipErase: true,
      sectorErase: false,
    };
    const bulkRes = await useCase.eraseChip(createContext(session, bulkOnlyCfi));
    expect(bulkRes.success).toBe(true);
    expect(eraseSectors).toHaveBeenCalledWith([], expect.any(Object), undefined);

    const readOnlyCfi: CFIInfo = {
      ...createFakeCfi(0x100000),
      eraseSectorBlocks: [],
      chipErase: false,
      sectorErase: false,
    };
    const roRes = await useCase.eraseChip(createContext(session, readOnlyCfi));
    expect(roRes).toMatchObject({
      success: false,
      errorCode: 'unsupported',
    });
  });
});
