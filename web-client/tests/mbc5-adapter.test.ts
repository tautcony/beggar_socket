import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions, MbcType } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const { mockCartPower, mockGbcRead, mockGbcRomProgram, mockGbcRomEraseSector } = vi.hoisted(() => ({
  mockCartPower: vi.fn(),
  mockGbcRead: vi.fn(),
  mockGbcRomProgram: vi.fn(),
  mockGbcRomEraseSector: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    cart_power: mockCartPower,
    gbc_read: mockGbcRead,
    gbc_rom_program: mockGbcRomProgram,
    gbc_rom_erase_sector: mockGbcRomEraseSector,
  };
});

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

function createCfiInfo(): CFIInfo {
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
    deviceSize: 0x8000,
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

function createOptions(
  mbcType: MbcType,
  overrides: Partial<CommandOptions> = {},
): CommandOptions {
  return {
    mbcType,
    baseAddress: 0x4000,
    romPageSize: 1,
    cfiInfo: createCfiInfo(),
    size: 1,
    ...overrides,
  };
}

describe('MBC5Adapter.verifyROM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGbcRead.mockReset();
    mockCartPower.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
  });

  it.each([
    'MBC3',
    'MBC1',
  ] as const)('passes resolved %s type into bank switching during verify', async (mbcType) => {
    const adapter = new MBC5Adapter({ port: null, connection: null, transport: null });
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const result = await adapter.verifyROM(new Uint8Array([0xab]), createOptions(mbcType));

    expect(result.success).toBe(true);
    expect(switchSpy).toHaveBeenCalledWith(1, mbcType);
  });
});

describe('MBC5Adapter.writeROM recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGbcRead.mockReset();
    mockCartPower.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romEraseRetryCount = 1;
    AdvancedSettings.romWriteRetryCount = 1;
  });

  it('skips the prepare erase when blank sampling passes', async () => {
    const logs: string[] = [];
    const adapter = new MBC5Adapter(
      { port: null, connection: null, transport: null },
      (message) => {
        if (typeof message === 'string') {
          logs.push(message);
          return;
        }
        logs.push(message.message);
        if (message.details) {
          logs.push(message.details);
        }
      },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).not.toHaveBeenCalled();
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(1);
    expect(logs).toContain('messages.operation.eraseSector');
    expect(logs).toContain('messages.operation.eraseSectorSkipped');
  });

  it('fully erases the target range before starting to program when sampling finds data', async () => {
    const logs: string[] = [];
    const adapter = new MBC5Adapter(
      { port: null, connection: null, transport: null },
      (message) => { logs.push(typeof message === 'string' ? message : message.message); },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(1);
    expect(mockGbcRomEraseSector.mock.invocationCallOrder[0]).toBeLessThan(mockGbcRomProgram.mock.invocationCallOrder[0]);
    expect(logs.some((entry) => entry.includes('ROM erase sample found programmed data'))).toBe(false);
    expect(logs.some((entry) => entry.includes('ROM erase skipped after blank sample'))).toBe(false);
  });

  it('retries the current sector from its start after a program failure', async () => {
    const adapter = new MBC5Adapter({ port: null, connection: null, transport: null });
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff]));
    mockGbcRomProgram
      .mockRejectedValueOnce(new Error('program timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(2);
  });

  it('rolls back to the sector start after a dirty partial write', async () => {
    const adapter = new MBC5Adapter({ port: null, connection: null, transport: null });
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff]));
    mockGbcRomProgram
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('chunk timeout'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const fileData = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const result = await adapter.writeROM(
      fileData,
      createOptions('MBC5', { romPageSize: 2, size: 4 }),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(4);
    expect(mockGbcRomProgram.mock.calls.map(([_, chunk]) => Array.from(chunk as Uint8Array))).toEqual([
      [0x11, 0x22],
      [0x33, 0x44],
      [0x11, 0x22],
      [0x33, 0x44],
    ]);
  });

  it('fails deterministically when erase retries are exhausted', async () => {
    const adapter = new MBC5Adapter({ port: null, connection: null, transport: null });
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    AdvancedSettings.romEraseRetryCount = 1;
    mockGbcRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockGbcRomEraseSector.mockRejectedValue(new Error('erase timeout'));

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('retry exhausted');
    expect(result.message).toContain('erase timeout');
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(2);
  });
});

describe('MBC5Adapter firmware capability gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCartPower.mockReset();
    mockGbcRead.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
  });

  it('rejects 5V power control on STM firmware before cart_power', async () => {
    const adapter = new MBC5Adapter({
      port: null,
      connection: null,
      transport: null,
      firmwareProfile: STM_FIRMWARE_PROFILE,
    });

    const result = await adapter.readROM(1, createOptions('MBC5', { enable5V: true }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('MBC 5V power control');
    expect(result.message).toContain('丐中丐 firmware');
    expect(mockCartPower).not.toHaveBeenCalled();
  });

  it('allows 5V power control on carbon firmware', async () => {
    const adapter = new MBC5Adapter({
      port: null,
      connection: null,
      transport: {
        send: vi.fn(),
        read: vi.fn(),
        sendAndReceive: vi.fn(),
        setSignals: vi.fn(),
        flushInput: vi.fn(),
      },
      firmwareProfile: STC_FIRMWARE_PROFILE,
    });
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockCartPower.mockResolvedValue(true);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const result = await adapter.readROM(1, createOptions('MBC5', { enable5V: true }));

    expect(result.success).toBe(true);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 0);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 1);
  });
});
