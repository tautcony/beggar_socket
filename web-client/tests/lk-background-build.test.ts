import { Jimp } from 'jimp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateBackgroundImage } from '@/services/lk/imageUtils';
import { buildRom } from '@/services/lk/romBuilder';
import type { BuildInput } from '@/services/lk/types';

import { assertBinaryEqual } from './helpers/binary-assertion';

function input(bgImage: ArrayBuffer): BuildInput {
  const menu = new Uint8Array(0xA000);
  menu.set([0x52, 0x54, 0x46, 0x4E, 0xFF, 0xFE], 0x9800);
  return {
    config: { cartridge: { type: 1, battery_present: false, min_rom_size: 0x400000 }, games: [] },
    menuRom: menu.buffer,
    romFiles: new Map(), saveFiles: new Map(),
    options: { split: false, noLog: true, output: 'image.gba', bgImage },
  };
}

describe('LK real background build', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('copies real encoded PNG bitmap/palette bytes while preserving inputs', async () => {
    const png = await new Jimp({ width: 240, height: 160, color: 0xFF0000FF }).getBuffer('image/png');
    const bg = Uint8Array.from(png).buffer;
    const source = input(bg);
    const original = structuredClone(source);
    const expectedMenu = new Uint8Array(source.menuRom.slice(0));
    await updateBackgroundImage(expectedMenu, bg);
    const result = await buildRom(source);
    const output = new Uint8Array(result.rom);
    // The builder owns its header code/checksum; compare every image byte outside it.
    assertBinaryEqual(output.subarray(0xBE, 0x9800), expectedMenu.subarray(0xBE, 0x9800));
    const view = new DataView(output.buffer);
    expect(view.getUint16(0x9600 + output[0] * 2, true)).toBe(0x001F); // RGB555 red
    expect(source).toEqual(original);
  }, 15_000);

  it('rejects malformed PNGs without modifying caller-owned inputs', async () => {
    const source = input(new Uint8Array([1, 2, 3]).buffer);
    const original = structuredClone(source);
    await expect(buildRom(source)).rejects.toThrow();
    expect(source).toEqual(original);
  });

  it('retains the background marker validation after successful PNG decoding', async () => {
    const png = await new Jimp({ width: 240, height: 160, color: 0xFF0000FF }).getBuffer('image/png');
    const source = input(Uint8Array.from(png).buffer);
    new Uint8Array(source.menuRom).fill(0);
    const original = structuredClone(source);
    await expect(buildRom(source)).rejects.toThrow('Background marker not found');
    expect(source).toEqual(original);
  }, 15_000);
});
