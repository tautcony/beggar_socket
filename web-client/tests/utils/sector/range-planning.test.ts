import { describe, expect, it } from 'vitest';

import type { SectorBlock } from '@/utils/parsers/cfi-parser';
import { calcSectorUsage, createSectorProgressInfo } from '@/utils/sector-utils';

function region(startAddress: number, sectorSize: number, sectorCount: number): SectorBlock {
  const totalSize = sectorSize * sectorCount;
  return { startAddress, endAddress: startAddress + totalSize - 1, sectorSize, sectorCount, totalSize };
}

const bottomBoot = [region(0, 8192, 8), region(65536, 65536, 15)];

describe('physical sector range planning', () => {
  it('skips bottom boot regions already consumed by the base address', () => {
    expect(calcSectorUsage(bottomBoot, 65536, 0x20000)).toEqual([region(0x20000, 65536, 1)]);
  });

  it('selects the full first and last sectors across a mixed-size boundary', () => {
    expect(calcSectorUsage(bottomBoot, 12, 65530)).toEqual([
      region(57344, 8192, 1), region(65536, 65536, 1),
    ]);
  });

  it('respects top boot addresses, sorting a copy without mutating geometry', () => {
    const blocks = [region(0xf0000, 8192, 8), region(0, 65536, 15)];
    const original = structuredClone(blocks);
    blocks.forEach(block => Object.freeze(block));
    Object.freeze(blocks);
    expect(calcSectorUsage(blocks, 8204, 0xefffa)).toEqual([
      region(0xe0000, 65536, 1), region(0xf0000, 8192, 2),
    ]);
    expect(blocks).toEqual(original);
  });

  it('handles non-power-of-two sector sizes and counts', () => {
    expect(calcSectorUsage([region(0, 300, 7)], 301, 301)).toEqual([region(300, 300, 2)]);
  });

  it('accepts a range ending exactly at capacity and rejects one byte beyond it', () => {
    expect(calcSectorUsage(bottomBoot, 65536, 0xf0000)).toEqual([region(0xf0000, 65536, 1)]);
    expect(() => calcSectorUsage(bottomBoot, 65537, 0xf0000)).toThrow('Insufficient sector space');
    expect(() => calcSectorUsage(bottomBoot, 1, 0x100000)).toThrow('Insufficient sector space');
  });

  it('keeps physical sector progress addresses and sizes for a partial range', () => {
    expect(createSectorProgressInfo(calcSectorUsage(bottomBoot, 12, 65530))).toEqual([
      { address: 57344, size: 8192, state: 'pending_erase' },
      { address: 65536, size: 65536, state: 'pending_erase' },
    ]);
  });

  it('returns an empty result for a valid zero-size request without geometry', () => {
    expect(calcSectorUsage([], 0, 42)).toEqual([]);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid size/base %s', (value) => {
    expect(() => calcSectorUsage(bottomBoot, value)).toThrow();
    expect(() => calcSectorUsage(bottomBoot, 1, value)).toThrow();
    expect(() => calcSectorUsage([], 0, value)).toThrow();
  });

  it('rejects unsafe range addition', () => {
    expect(() => calcSectorUsage(bottomBoot, 2, Number.MAX_SAFE_INTEGER)).toThrow();
  });

  it.each([
    { sectorSize: 0 }, { sectorSize: NaN }, { sectorSize: Infinity }, { sectorSize: 0.5 },
    { sectorCount: 0 }, { sectorCount: -1 }, { sectorCount: 1.5 },
    { totalSize: 1 }, { endAddress: 65536 }, { startAddress: -1 },
    { startAddress: Number.MAX_SAFE_INTEGER },
    { sectorSize: Number.MAX_SAFE_INTEGER, sectorCount: 2 },
  ])('rejects inconsistent or unsafe region fields %j', (overrides) => {
    expect(() => calcSectorUsage([{ ...region(0, 8192, 8), ...overrides }], 1)).toThrow('Invalid sector geometry');
  });

  it.each([65535, 65537])('rejects overlapping/gapped regions even outside the requested range (%i)', (start) => {
    expect(() => calcSectorUsage([bottomBoot[0], region(start, 65536, 15)], 1)).toThrow('Invalid sector geometry');
  });

  it('does not relocate nonzero physical geometry', () => {
    const blocks = [region(4096, 1024, 3)];
    expect(calcSectorUsage(blocks, 1, 5121)).toEqual([region(5120, 1024, 1)]);
    expect(() => calcSectorUsage(blocks, 1, 0)).toThrow('Insufficient sector space');
  });
});
