import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGbcRead } = vi.hoisted(() => ({
  mockGbcRead: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    gbc_read: mockGbcRead,
  };
});

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

import { MBC5Adapter } from '@/services/mbc5-adapter';
import type { CommandOptions, MbcType } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

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

function createOptions(mbcType: MbcType): CommandOptions {
  return {
    mbcType,
    baseAddress: 0x4000,
    romPageSize: 1,
    cfiInfo: createCfiInfo(),
    size: 1,
  };
}

describe('MBC5Adapter.verifyROM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGbcRead.mockReset();
  });

  it.each([
    'MBC3',
    'MBC1',
  ] as const)('passes resolved %s type into bank switching during verify', async (mbcType) => {
    const adapter = new MBC5Adapter({ port: null, connection: null, transport: null } as DeviceInfo);
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const result = await adapter.verifyROM(new Uint8Array([0xab]), createOptions(mbcType));

    expect(result.success).toBe(true);
    expect(switchSpy).toHaveBeenCalledWith(1, mbcType);
  });
});
