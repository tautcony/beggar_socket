import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseCFI, swapD0D1 } from '@/utils/parsers/cfi-parser';
import { calcSectorUsage } from '@/utils/sector-utils';

// Query fields transcribed from Infineon GL-T table 28 and S29AL032D tables 13–14.
// These are datasheet fixtures, not physical captures. Primary URLs are in change design.md.
function query(exponent = 26, regions = [[0xff, 1, 0, 2]], boot = 0) {
  const buffer = new Uint8Array(0x100);
  buffer[0x20] = 0x51;
  buffer[0x22] = 0x52;
  buffer[0x24] = 0x59;
  buffer[0x36] = 0x27;
  buffer[0x38] = 0x36;
  buffer[0x4e] = exponent;
  buffer[0x54] = 9;
  buffer[0x58] = regions.length;
  regions.forEach((region, i) => {
    region.forEach((value, j) => { buffer[0x5a + i * 8 + j * 2] = value; });
  });
  const pri = regions.length > 4 ? 0xc0 : 0x80;
  buffer[0x2a] = pri / 2;
  buffer[pri] = 0x50;
  buffer[pri + 2] = 0x52;
  buffer[pri + 4] = 0x49;
  buffer[pri + 0x1e] = boot;
  return buffer;
}

describe('CFI geometry contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([[26, 1, 512], [27, 3, 1024]])('decodes GL-T capacity exponent %i', (exponent, countHigh, count) => {
    const result = parseCFI(query(exponent, [[0xff, countHigh, 0, 2]]));
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected datasheet CFI');
    expect(result.deviceSize).toBe(2 ** exponent);
    expect(result.bufferSize).toBe(512);
    expect(result.eraseSectorBlocks).toEqual([{ sectorCount: count, sectorSize: 131072, totalSize: 2 ** exponent, startAddress: 0, endAddress: 2 ** exponent - 1 }]);
    expect(result.info).not.toMatch(/NaN|Infinity/);
  });

  it.each([2, 3])('decodes AL032D boot flag %i with inclusive contiguous bounds', (boot) => {
    const buffer = query(22, [[7, 0, 0x20, 0], [0x3e, 0, 0, 1]], boot);
    buffer[0x54] = 0;
    const result = parseCFI(buffer);
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected boot CFI');
    const [first, last] = result.eraseSectorBlocks;
    expect(first.sectorSize).toBe(boot === 2 ? 8192 : 65536);
    expect(first.startAddress).toBe(0);
    expect(last.startAddress).toBe(first.endAddress + 1);
    expect(last.endAddress).toBe(2 ** 22 - 1);
    expect(result.info).toContain('0x3FFFFF');
  });

  it('corrects all query bytes for swapped data lines without mutating input', () => {
    const buffer = query().map(swapD0D1);
    const original = buffer.slice();
    const result = parseCFI(buffer);
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected swapped CFI');
    expect(result.isSwapD0D1).toBe(true);
    expect(result.deviceSize).toBe(2 ** 26);
    expect(result.eraseSectorBlocks[0].sectorCount).toBe(512);
    expect(buffer).toEqual(original);
  });

  it('decodes zero sector encoding as 128 bytes (Microchip CoreCFI table 4-4)', () => {
    const buffer = query(18, [[0xff, 7, 0, 0]]);
    buffer[0x54] = 7;
    const result = parseCFI(buffer);
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected 128-byte CFI');
    expect(result.eraseSectorBlocks[0]).toEqual({ sectorCount: 2048, sectorSize: 128, totalSize: 262144, startAddress: 0, endAddress: 262143 });
  });

  it('preserves valid bulk-only detection without inventing erasable sectors', () => {
    const result = parseCFI(query(26, []));
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected bulk-only CFI');
    expect(result.deviceSize).toBe(2 ** 26);
    expect(result.eraseSectorRegions).toBe(0);
    expect(result.eraseSectorBlocks).toEqual([]);
    expect(() => calcSectorUsage(result.eraseSectorBlocks, 1, 0)).toThrow();
  });

  it.each([53, 255])('rejects unsafe device exponent %i', (exponent) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseCFI(query(exponent))).toBe(false);
  });

  it.each([53, 1024, 0xffff])('rejects unsafe/nonfinite buffer exponent %i', (exponent) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const buffer = query();
    buffer[0x54] = exponent & 0xff;
    buffer[0x56] = exponent >> 8;
    expect(parseCFI(buffer)).toBe(false);
  });

  it('rejects a buffer larger than device capacity', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const buffer = query();
    buffer[0x54] = 27;
    expect(parseCFI(buffer)).toBe(false);
  });

  it.each([0, 2])('rejects inconsistent region total (count high %i)', (countHigh) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseCFI(query(26, [[0xff, countHigh, 0, 2]]))).toBe(false);
  });

  it('parses all five complete declared regions rather than truncating at four', () => {
    const regions = [[0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [3, 0, 0, 1]];
    const result = parseCFI(query(19, regions).slice(0, 0x81));
    expect(result).not.toBe(false);
    if (!result) throw new Error('Expected five regions');
    expect(result.eraseSectorBlocks).toHaveLength(5);
    expect(result.eraseSectorBlocks[4].endAddress).toBe(2 ** 19 - 1);
  });

  it('rejects a fifth region missing its last descriptor byte', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseCFI(query(19, Array.from({ length: 5 }, () => [0, 0, 0, 1])).slice(0, 0x80))).toBe(false);
    expect(error).toHaveBeenCalledWith('Incomplete CFI erase descriptors: 5 regions, 128 bytes');
  });

  it('rejects a declared descriptor table extending beyond the buffer', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const buffer = query();
    buffer[0x58] = 255;
    expect(parseCFI(buffer)).toBe(false);
    expect(error).toHaveBeenCalledWith('Incomplete CFI erase descriptors: 255 regions, 256 bytes');
  });

  it('bounds bad magic diagnostics even for a large input', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const buffer = new Uint8Array(1024 * 1024);
    expect(parseCFI(buffer)).toBe(false);
    expect(log.mock.calls.length).toBeLessThan(25);
  });
});
