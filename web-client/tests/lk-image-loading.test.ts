import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BuildInput } from '@/services/lk/types';

const image = vi.hoisted(() => ({ loads: vi.fn(), update: vi.fn() }));

function input(bgImage?: ArrayBuffer): BuildInput {
  return {
    config: { cartridge: { type: 1, battery_present: false, min_rom_size: 0x400000 }, games: [] },
    menuRom: new Uint8Array(0x200).buffer,
    romFiles: new Map(), saveFiles: new Map(),
    options: { split: false, noLog: true, output: 'test.gba', bgImage },
  };
}

describe('LK background demand loading', () => {
  beforeEach(() => {
    vi.resetModules();
    image.loads.mockClear();
    image.update.mockReset();
    vi.doUnmock('@/services/lk/imageUtils');
    vi.doMock('@/services/lk/imageUtils', () => {
      image.loads();
      return { updateBackgroundImage: image.update };
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not evaluate the image module for a build without a background', async () => {
    const { buildRom } = await import('@/services/lk/romBuilder');
    await buildRom(input());
    expect(image.loads).not.toHaveBeenCalled();
    expect(image.update).not.toHaveBeenCalled();
  });

  it('loads and awaits processing before copying the menu into output', async () => {
    const bg = new Uint8Array([1, 2, 3]).buffer;
    const source = input(bg);
    image.update.mockImplementation(async (menu: Uint8Array, received: ArrayBuffer) => {
      expect(received).toBe(bg);
      await Promise.resolve();
      menu[0x100] = 0x77;
    });
    const { buildRom } = await import('@/services/lk/romBuilder');
    const result = await buildRom(source);
    expect(image.loads).toHaveBeenCalledOnce();
    expect(image.update).toHaveBeenCalledOnce();
    expect(new Uint8Array(result.rom)[0x100]).toBe(0x77);
    expect(new Uint8Array(source.menuRom)[0x100]).toBe(0);
    expect([...new Uint8Array(bg)]).toEqual([1, 2, 3]);
  });

  it('preserves processing error identity and caller buffers after partial menu changes', async () => {
    const source = input(new Uint8Array([4, 5]).buffer);
    const error = new Error('image decode failed');
    const original = structuredClone(source);
    image.update.mockImplementation(async (menu: Uint8Array) => {
      menu[0] = 99;
      await Promise.resolve();
      throw error;
    });
    const { buildRom } = await import('@/services/lk/romBuilder');
    await expect(buildRom(source)).rejects.toBe(error);
    expect(image.loads).toHaveBeenCalledOnce();
    expect(source).toEqual(original);
  });
});
