import { describe, expect, it, vi } from 'vitest';

import { BurnerSession } from '@/features/burner/application/burner-session';
import { BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import { runBurnerFlow } from '@/features/burner/application/flow-template';
import type { CartridgeAdapter } from '@/services/cartridge-adapter';
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

describe('BurnerSession', () => {
  it('should manage cancellable operation lifecycle', () => {
    const session = new BurnerSession();

    const signal = session.startOperation(true);
    expect(signal).toBeDefined();
    expect(session.snapshot.busy).toBe(true);
    expect(session.snapshot.abortController).not.toBeNull();

    session.abortOperation();
    expect(session.snapshot.busy).toBe(false);
    expect(session.snapshot.abortController).toBeNull();
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
    const adapter = {
      getCartInfo: vi.fn().mockResolvedValue(cfi),
    } as unknown as CartridgeAdapter;

    const useCase = new BurnerUseCaseImpl(t, toHex);
    const result = await useCase.readCart(adapter, false);

    expect(result.success).toBe(true);
    expect(result.cfiInfo).toBe(cfi);
    expect(result.chipId).toEqual([0x01, 0x02, 0x03, 0x04]);
    expect(result.romSizeHex).toBe('0x20000');
  });

  it('eraseChip should delegate to adapter.eraseSectors', async () => {
    const cfi = createFakeCfi();
    const eraseResult = { success: true, message: 'ok' };
    const eraseSectors = vi.fn().mockResolvedValue(eraseResult);
    const adapter = {
      eraseSectors,
    } as unknown as CartridgeAdapter;

    const useCase = new BurnerUseCaseImpl(t, toHex);
    const result = await useCase.eraseChip({
      adapter,
      cfiInfo: cfi,
      options: { cfiInfo: cfi, mbcType: 'MBC5', enable5V: false },
    });

    expect(eraseSectors).toHaveBeenCalledOnce();
    expect(result).toEqual(eraseResult);
  });

  it('readCart should return normalized failure when adapter returns falsy info', async () => {
    const adapter = {
      getCartInfo: vi.fn().mockResolvedValue(false),
    } as unknown as CartridgeAdapter;

    const useCase = new BurnerUseCaseImpl(t, toHex);
    const result = await useCase.readCart(adapter, true);

    expect(result.success).toBe(false);
    expect(result.message).toBe('messages.operation.readCartFailed');
  });

  it('readCart should normalize runtime error message', async () => {
    const adapter = {
      getCartInfo: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as CartridgeAdapter;

    const useCase = new BurnerUseCaseImpl(t, toHex);
    const result = await useCase.readCart(adapter, true);

    expect(result.success).toBe(false);
    expect(result.message).toContain('messages.operation.readCartFailed');
    expect(result.message).toContain('boom');
  });

  it('write/read rom and ram flows should preserve command result contracts', async () => {
    const cfi = createFakeCfi();
    const writeROM = vi.fn().mockResolvedValue({ success: true, message: 'write-rom-ok' });
    const readROM = vi.fn().mockResolvedValue({ success: true, message: 'read-rom-ok', data: new Uint8Array([1, 2, 3]) });
    const writeRAM = vi.fn().mockResolvedValue({ success: true, message: 'write-ram-ok' });
    const readRAM = vi.fn().mockResolvedValue({ success: true, message: 'read-ram-ok', data: new Uint8Array([4, 5]) });
    const adapter = {
      writeROM,
      readROM,
      writeRAM,
      readRAM,
    } as unknown as CartridgeAdapter;

    const useCase = new BurnerUseCaseImpl(t, toHex);
    const options = { cfiInfo: cfi, mbcType: 'MBC5' as const, enable5V: false };

    const romWrite = await useCase.writeRom({ adapter, cfiInfo: cfi, options, data: new Uint8Array([0x11]) });
    const romRead = await useCase.readRom({ adapter, cfiInfo: cfi, options, size: 3, showProgress: false });
    const ramWrite = await useCase.writeRam({ adapter, cfiInfo: cfi, options, data: new Uint8Array([0x22]) });
    const ramRead = await useCase.readRam({ adapter, cfiInfo: cfi, options, size: 2 });

    expect(romWrite).toEqual({ success: true, message: 'write-rom-ok' });
    expect(romRead).toEqual({ success: true, message: 'read-rom-ok', data: new Uint8Array([1, 2, 3]) });
    expect(ramWrite).toEqual({ success: true, message: 'write-ram-ok' });
    expect(ramRead).toEqual({ success: true, message: 'read-ram-ok', data: new Uint8Array([4, 5]) });
    expect(readROM).toHaveBeenCalledWith(3, options, undefined, false);
  });
});
