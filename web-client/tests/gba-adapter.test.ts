import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GBAAdapter } from '@/services/gba-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const { mockRomRead, mockRomProgram, mockRomEraseSector } = vi.hoisted(() => ({
  mockRomRead: vi.fn(),
  mockRomProgram: vi.fn(),
  mockRomEraseSector: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    rom_read: mockRomRead,
    rom_program: mockRomProgram,
    rom_erase_sector: mockRomEraseSector,
  };
});

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

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

function createOptions(overrides: Partial<CommandOptions> = {}): CommandOptions {
  const cfiInfo = overrides.cfiInfo ?? createCfiInfo();
  return {
    baseAddress: 0,
    romPageSize: 1,
    cfiInfo,
    size: 1,
    ...overrides,
  };
}

describe('GBAAdapter.writeROM recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRomRead.mockReset();
    mockRomProgram.mockReset();
    mockRomEraseSector.mockReset();
    mockRomRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romEraseRetryCount = 1;
    AdvancedSettings.romWriteRetryCount = 1;
  });

  it('skips the prepare erase when blank sampling passes', async () => {
    const logs: string[] = [];
    const adapter = new GBAAdapter(
      { port: null, connection: null, transport: null } as DeviceInfo,
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

    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).not.toHaveBeenCalled();
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
    expect(logs).toContain('messages.operation.eraseSector');
    expect(logs).toContain('messages.operation.eraseSectorSkipped');
  });

  it('fully erases the target range before starting to program when sampling finds data', async () => {
    const logs: string[] = [];
    const adapter = new GBAAdapter(
      { port: null, connection: null, transport: null } as DeviceInfo,
      (message) => { logs.push(typeof message === 'string' ? message : message.message); },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
    expect(mockRomEraseSector.mock.invocationCallOrder[0]).toBeLessThan(mockRomProgram.mock.invocationCallOrder[0]);
    expect(logs.some((entry) => entry.includes('ROM erase sample found programmed data'))).toBe(false);
    expect(logs.some((entry) => entry.includes('ROM erase skipped after blank sample'))).toBe(false);
  });

  it('retries the current sector after a program failure on a multi-bank cartridge', async () => {
    const adapter = new GBAAdapter({ port: null, connection: null, transport: null } as DeviceInfo);
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff]));
    mockRomProgram
      .mockRejectedValueOnce(new Error('program timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions({
        baseAddress: 1 << 25,
        cfiInfo: createCfiInfo(1 << 26),
      }),
    );

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(2);
    expect(switchSpy).toHaveBeenCalledWith(1);
  });

  it('rolls back to the sector start after a dirty partial write', async () => {
    const adapter = new GBAAdapter({ port: null, connection: null, transport: null } as DeviceInfo);
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff]));
    mockRomProgram
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('chunk timeout'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const fileData = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const result = await adapter.writeROM(
      fileData,
      createOptions({ romPageSize: 2, size: 4 }),
    );

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(4);
    expect(mockRomProgram.mock.calls.map(([_, chunk]) => Array.from(chunk as Uint8Array))).toEqual([
      [0x11, 0x22],
      [0x33, 0x44],
      [0x11, 0x22],
      [0x33, 0x44],
    ]);
  });

  it('fails deterministically when erase retries are exhausted', async () => {
    const adapter = new GBAAdapter({ port: null, connection: null, transport: null } as DeviceInfo);
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockRomEraseSector.mockRejectedValue(new Error('erase timeout'));

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(false);
    expect(result.message).toContain('retry exhausted');
    expect(result.message).toContain('erase timeout');
    expect(mockRomEraseSector).toHaveBeenCalledTimes(2);
  });
});

describe('GBAAdapter firmware capability gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRomRead.mockReset();
    mockRomProgram.mockReset();
    mockRomEraseSector.mockReset();
    AdvancedSettings.resetToDefaults();
  });

  it('rejects sector erase on carbon firmware before sending unsupported command', async () => {
    const adapter = new GBAAdapter({
      port: null,
      connection: null,
      transport: null,
      firmwareProfile: STC_FIRMWARE_PROFILE,
    } as DeviceInfo);

    const result = await adapter.eraseSectors(createCfiInfo().eraseSectorBlocks, createOptions());

    expect(result.success).toBe(false);
    expect(result.message).toContain('碳酸丐 firmware');
    expect(mockRomEraseSector).not.toHaveBeenCalled();
  });

  it('rejects GBA FRAM RAM operations on carbon firmware', async () => {
    const adapter = new GBAAdapter({
      port: null,
      connection: null,
      transport: null,
      firmwareProfile: STC_FIRMWARE_PROFILE,
    } as DeviceInfo);

    const result = await adapter.writeRAM(new Uint8Array([0xaa]), createOptions({ ramType: 'FRAM' }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('GBA FRAM RAM write');
    expect(result.message).toContain('碳酸丐 firmware');
  });

  it('allows STC ROM writes when blank sampling can skip unsupported sector erase', async () => {
    const adapter = new GBAAdapter({
      port: null,
      connection: null,
      transport: null,
      firmwareProfile: STC_FIRMWARE_PROFILE,
    } as DeviceInfo);
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).not.toHaveBeenCalled();
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
  });
});
