import { describe, expect, it } from 'vitest';

import { planBankChunk } from '@/services/bank-chunk-planner';

describe('planBankChunk', () => {
  it.each(['MBC1', 'MBC2', 'MBC3', 'MBC5'] as const)('preserves %s ROM window mapping', (mbcType) => {
    expect(planBankChunk(0, 100, 32, { platform: 'mbc', memory: 'rom', mbcType })).toMatchObject({
      bank: 0, cartAddress: mbcType === 'MBC3' ? 0 : 0x4000, chunkSize: 32, addressUnitBytes: 1,
    });
    expect(planBankChunk(0x7ff0, 128 * 1024, 8192, { platform: 'mbc', memory: 'rom', mbcType })).toMatchObject({
      bank: 1, cartAddress: 0x7ff0, chunkSize: 16, windowRemaining: 16,
    });
    expect(planBankChunk(0x8000, 3, 8192, { platform: 'mbc', memory: 'rom', mbcType })).toMatchObject({
      bank: 2, cartAddress: 0x4000, chunkSize: 3,
    });
  });

  it('plans MBC RAM independently of controller ROM mapping', () => {
    expect(planBankChunk(0x5ff0, 128 * 1024, 8192, { platform: 'mbc', memory: 'ram', mbcType: 'MBC3' })).toMatchObject({
      bank: 2, cartAddress: 0xbff0, windowRemaining: 16, chunkSize: 16, addressUnitBytes: 1,
    });
  });

  it('preserves GBA ROM byte addresses and exposes the bus word unit', () => {
    expect(planBankChunk((1 << 26) - 16, 128 * 1024, 8192, { platform: 'gba', memory: 'rom' })).toEqual({
      bank: 1, cartAddress: (1 << 26) - 16, windowRemaining: 16, chunkSize: 16, addressUnitBytes: 2,
    });
  });

  it('plans both GBA RAM banks and clips the last sixteen bytes of 128 KiB', () => {
    expect(planBankChunk(0xfff0, 0x10010, 8192, { platform: 'gba', memory: 'ram' })).toMatchObject({
      bank: 0, cartAddress: 0xfff0, chunkSize: 16,
    });
    expect(planBankChunk(0x10000, 0x10000, 8192, { platform: 'gba', memory: 'ram' })).toMatchObject({
      bank: 1, cartAddress: 0, chunkSize: 8192,
    });
    expect(planBankChunk(0x1fff0, 16, 8192, { platform: 'gba', memory: 'ram' })).toMatchObject({
      bank: 1, cartAddress: 0xfff0, chunkSize: 16, windowRemaining: 16, addressUnitBytes: 1,
    });
  });
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid logical address %s', (address) => {
    expect(() => planBankChunk(address, 1, 1, { platform: 'gba', memory: 'ram' })).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity, 0.5])('rejects invalid remaining length %s', (remaining) => {
    expect(() => planBankChunk(0, remaining, 1, { platform: 'gba', memory: 'ram' })).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity, 0.5])('rejects a non-progressing page size %s', (pageSize) => {
    expect(() => planBankChunk(0, 1, pageSize, { platform: 'gba', memory: 'ram' })).toThrow(RangeError);
  });

  it('permits an exhausted transfer without issuing a chunk', () => {
    expect(planBankChunk(0, 0, 1, { platform: 'gba', memory: 'ram' }).chunkSize).toBe(0);
  });
});
