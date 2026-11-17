import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import NotImplementedError from '@/utils/errors/NotImplementedError';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const { mockCartPower, mockRomRead, mockGbcRead, mockGbcWrite } = vi.hoisted(() => ({
  mockCartPower: vi.fn(),
  mockRomRead: vi.fn(),
  mockGbcRead: vi.fn(),
  mockGbcWrite: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    cart_power: mockCartPower,
    rom_read: mockRomRead,
    gbc_read: mockGbcRead,
    gbc_write: mockGbcWrite,
  };
});

function createCfiInfo(deviceSize = 0x8000): CFIInfo {
  return {
    flashId: new Uint8Array([0x01, 0x02]),
    magic: 'QRY',
    dataSwap: null,
    cfiDetected: true,
    isSwapD0D1: false,
    isIntel: false,
    vddMin: 3,
    vddMax: 5,
    singleWrite: true,
    bufferWrite: true,
    sectorErase: true,
    chipErase: true,
    tbBootSector: false,
    tbBootSectorRaw: 0,
    deviceSize,
    eraseSectorRegions: 1,
    eraseSectorBlocks: [{
      sectorSize: 0x4000,
      sectorCount: 2,
      totalSize: 0x8000,
      startAddress: 0,
      endAddress: 0x7fff,
    }],
    reverseSectorRegion: false,
    info: 'test-cfi',
  };
}

function createDevice(profile = STC_FIRMWARE_PROFILE): DeviceInfo {
  return {
    port: null,
    connection: null,
    firmwareProfile: profile,
    transport: {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }),
      sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }),
      setSignals: vi.fn().mockResolvedValue(undefined),
      flushInput: vi.fn().mockResolvedValue(undefined),
      drainInput: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('Platform command sequence parity (GBA, MBC5, MBC3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romReadRetryCount = 1;
    AdvancedSettings.romReadRetryDelayMs = 0;
    mockCartPower.mockReset().mockResolvedValue(undefined);
    mockRomRead.mockReset().mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x11)));
    mockGbcRead.mockReset().mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x22)));
    mockGbcWrite.mockReset().mockResolvedValue(undefined);
  });

  it('aligns MBC3 (0x0000) vs MBC5 (0x4000) bank-0 mapping in PlatformOps.toRomBank and readROM across bank boundaries', async () => {
    AdvancedSettings.romReadPageSize = 0x4000;
    const adapter = new MBC5Adapter(createDevice());
    const ops = (adapter as unknown as { createPlatformOps: () => { toRomBank: (addr: number, opts: CommandOptions) => { bank: number; cartAddress: number } } }).createPlatformOps();

    expect(ops.toRomBank(0x0100, { mbcType: 'MBC3', cfiInfo: createCfiInfo() })).toEqual({ bank: 0, cartAddress: 0x0100 });
    expect(ops.toRomBank(0x0100, { mbcType: 'MBC5', cfiInfo: createCfiInfo() })).toEqual({ bank: 0, cartAddress: 0x4100 });
    expect(ops.toRomBank(0x4100, { mbcType: 'MBC3', cfiInfo: createCfiInfo() })).toEqual({ bank: 1, cartAddress: 0x4100 });
    expect(ops.toRomBank(0x4100, { mbcType: 'MBC5', cfiInfo: createCfiInfo() })).toEqual({ bank: 1, cartAddress: 0x4100 });

    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    await adapter.readROM(0x5000, {
      mbcType: 'MBC3',
      baseAddress: 0x0000,
      romPageSize: 0x4000,
      cfiInfo: createCfiInfo(),
    });
    expect(mockGbcRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual([
      [0x4000, 0x0000],
      [0x1000, 0x4000],
    ]);
    expect(switchSpy.mock.calls.map(([b, t]) => [b, t])).toEqual([
      [0, 'MBC3'],
      [1, 'MBC3'],
    ]);

    mockGbcRead.mockClear();
    switchSpy.mockClear();

    await adapter.readROM(0x5000, {
      mbcType: 'MBC5',
      baseAddress: 0x0000,
      romPageSize: 0x4000,
      cfiInfo: createCfiInfo(),
    });
    expect(mockGbcRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual([
      [0x4000, 0x4000],
      [0x1000, 0x4000],
    ]);
    expect(switchSpy.mock.calls.map(([b, t]) => [b, t])).toEqual([
      [0, 'MBC5'],
      [1, 'MBC5'],
    ]);
  });

  it('switches GBA ROM bank across 32MiB (1 << 25) boundary and retries transient read failures', async () => {
    const adapter = new GBAAdapter(createDevice());
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    AdvancedSettings.romReadRetryCount = 1;

    let calls = 0;
    mockRomRead.mockImplementation((_t, size: number) => {
      calls++;
      if (calls === 2) {
        return Promise.reject(new Error('transient gba read error'));
      }
      return Promise.resolve(new Uint8Array(size).fill(0x33));
    });

    const result = await adapter.readROM(0x2000, {
      baseAddress: 0x01fff000,
      romPageSize: 0x1000,
      cfiInfo: createCfiInfo(0x04000000),
    });

    expect(result.success).toBe(true);
    expect(mockRomRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual([
      [0x1000, 0x01fff000],
      [0x1000, 0x02000000],
      [0x1000, 0x02000000],
    ]);
    // Bank 0 initially, bank 1 at 0x02000000, then bank 1 restored on retry
    expect(switchSpy).toHaveBeenCalledWith(0);
    expect(switchSpy).toHaveBeenCalledWith(1);
    expect(switchSpy).toHaveBeenCalledTimes(3);
  });

  it('splits large ROM read chunks into smaller sub-chunks when retrying after a read timeout', async () => {
    const adapter = new GBAAdapter(createDevice());
    AdvancedSettings.romReadRetryCount = 1;

    let calls = 0;
    mockRomRead.mockImplementation((_t, size: number) => {
      calls++;
      if (calls === 1) {
        return Promise.reject(new Error('Read package timeout in 3000ms (read#1, expected=4098B, received=4084B)'));
      }
      return Promise.resolve(new Uint8Array(size).fill(0x55));
    });

    const result = await adapter.readROM(0x1000, {
      baseAddress: 0x01749000,
      romPageSize: 0x1000,
      cfiInfo: createCfiInfo(0x02000000),
    });

    expect(result.success).toBe(true);
    expect(mockRomRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual([
      [0x1000, 0x01749000],
      [0x0800, 0x01749000],
      [0x0800, 0x01749800],
    ]);
  });

  it('applies platform-optimal STM32 GBA read chunk sizes for windows, macos, and linux', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    try {
      const cases = [
        {
          platform: 'Win32',
          expectedCalls: [[0x1000, 0x00000000]],
        },
        {
          platform: 'MacIntel',
          expectedCalls: [
            [0x0c00, 0x00000000],
            [0x0400, 0x00000c00],
          ],
        },
        {
          platform: 'Linux x86_64',
          expectedCalls: [
            [0x0c00, 0x00000000],
            [0x0400, 0x00000c00],
          ],
        },
      ] as const;

      for (const testCase of cases) {
        mockRomRead.mockReset();
        Object.defineProperty(navigator, 'platform', { value: testCase.platform, configurable: true });

        const adapter = new GBAAdapter(createDevice(STM_FIRMWARE_PROFILE));
        mockRomRead.mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x11)));

        const result = await adapter.readROM(0x1000, {
          baseAddress: 0x00000000,
          romPageSize: 0x1000,
          cfiInfo: createCfiInfo(0x02000000),
        });

        expect(result.success).toBe(true);
        expect(mockRomRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual(testCase.expectedCalls);
      }
    } finally {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      } else {
        delete (navigator as { platform?: string }).platform;
      }
    }
  });

  it('applies platform-optimal STC8 GBA read chunk sizes (8KiB on Windows, 4KiB on macOS/Linux)', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    try {
      const cases = [
        {
          platform: 'Win32',
          expectedCalls: [[0x2000, 0x00000000]],
        },
        {
          platform: 'MacIntel',
          expectedCalls: [
            [0x1000, 0x00000000],
            [0x1000, 0x00001000],
          ],
        },
        {
          platform: 'Linux x86_64',
          expectedCalls: [
            [0x1000, 0x00000000],
            [0x1000, 0x00001000],
          ],
        },
      ] as const;

      for (const testCase of cases) {
        mockRomRead.mockReset();
        Object.defineProperty(navigator, 'platform', { value: testCase.platform, configurable: true });
        AdvancedSettings.resetToDefaults();

        const adapter = new GBAAdapter(createDevice(STC_FIRMWARE_PROFILE));
        mockRomRead.mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x22)));

        const result = await adapter.readROM(0x2000, {
          baseAddress: 0x00000000,
          cfiInfo: createCfiInfo(0x02000000),
        });

        expect(result.success).toBe(true);
        expect(mockRomRead.mock.calls.map(([, size, addr]) => [size, addr])).toEqual(testCase.expectedCalls);
      }
    } finally {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      } else {
        delete (navigator as { platform?: string }).platform;
      }
    }
  });

  it('rejects 5V power on STM before cart_power and restores 3.3V on STC', async () => {
    const stmAdapter = new MBC5Adapter(createDevice(STM_FIRMWARE_PROFILE));
    const stmLogs: string[] = [];
    const stmAdapterWithLog = new MBC5Adapter(createDevice(STM_FIRMWARE_PROFILE), (m) => {
      stmLogs.push(typeof m === 'string' ? m : m.message);
    });
    const stmResult = await stmAdapterWithLog.readROM(0x100, {
      mbcType: 'MBC5',
      enable5V: true,
      cfiInfo: createCfiInfo(),
    });
    expect(stmResult.success).toBe(false);
    expect(mockCartPower).not.toHaveBeenCalled();
    expect(stmLogs).toEqual([]);
    expect(stmAdapter).toBeDefined();

    const stcAdapter = new MBC5Adapter(createDevice(STC_FIRMWARE_PROFILE));
    vi.spyOn(stcAdapter, 'switchROMBank').mockResolvedValue(undefined);
    const stcResult = await stcAdapter.readROM(0x100, {
      mbcType: 'MBC5',
      enable5V: true,
      cfiInfo: createCfiInfo(),
    });
    expect(stcResult.success).toBe(true);
    expect(mockCartPower.mock.calls.map((c) => c[1])).toEqual([0, 2, 1]);
  });

  it('throws unimplemented error for MBC1 and MBC2 bank switching', async () => {
    const adapter = new MBC5Adapter(createDevice());
    await expect(adapter.switchROMBank(1, 'MBC1')).rejects.toThrow('MBC1 ROM bank switching not yet implemented');
    await expect(adapter.switchROMBank(1, 'MBC2')).rejects.toThrow('MBC2 ROM bank switching not yet implemented');
  });
});
