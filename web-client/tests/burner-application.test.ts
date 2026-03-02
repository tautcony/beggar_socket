import { describe, expect, it, vi } from 'vitest';

import { BurnerSession } from '@/features/burner/application/burner-session';
import { BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
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
});
