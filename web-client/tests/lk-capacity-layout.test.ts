import { afterEach, describe, expect, it, vi } from 'vitest';

import { addRomData, buildRom, generateItemList, importSaveDataAndAddRom, prepareCompilation } from '@/services/lk/romBuilder';
import { type BuildInput, cartridgeTypes, type GameConfig } from '@/services/lk/types';

import { assertBinaryEqual } from './helpers/binary-assertion';

const sectorSize = 0x20000;
const blockSize = 0x80000;
const originalCartridge = { ...cartridgeTypes[1] };

function game(overrides: Partial<GameConfig> = {}): GameConfig {
  return { enabled: true, file: 'game.gba', title: 'Game', title_font: 1, save_slot: 1, ...overrides };
}

function input(): BuildInput {
  return {
    config: { cartridge: { type: 1, battery_present: true, min_rom_size: 0x400000 }, games: [game()] },
    menuRom: new Uint8Array(0x200).buffer,
    romFiles: new Map([['game.gba', new Uint8Array(0x10000).fill(0xA5).buffer]]),
    saveFiles: new Map(),
    options: { split: false, noLog: true, output: 'test.gba' },
  };
}

function prepare(games: GameConfig[], saves = new Map<string, ArrayBuffer>()) {
  const compilation = new Uint8Array(0x200000).fill(0xFF);
  const map = Array(compilation.length / sectorSize).fill('.') as string[];
  map[3] = 'C';
  const roms = new Map(games.map(g => [g.file, new Uint8Array(0x10000).buffer]));
  const result = importSaveDataAndAddRom(games, sectorSize, blockSize, true, compilation, map, 4, roms, saves);
  return { ...result, compilation, map };
}

afterEach(() => {
  Object.assign(cartridgeTypes[1], originalCartridge);
  vi.restoreAllMocks();
});

describe('LK capacity and layout boundaries', () => {
  it.each([0, 1.5, NaN])('rejects unsupported cartridge type %s', type => {
    expect(() => prepareCompilation(type)).toThrow('Invalid cartridge type');
  });

  it('records supported capacity and geometry without allocating their flash images', () => {
    expect(cartridgeTypes.slice(1).map(type => type.flash_size / 0x100000)).toEqual([64, 256, 128, 512, 256]);
    expect(cartridgeTypes.slice(1).every(type => type.block_size === blockSize && [sectorSize, sectorSize * 2].includes(type.sector_size))).toBe(true);
    // With the GUI minimum of 4 MiB even the largest flash cannot reach 1170 list entries.
    expect(Math.max(...cartridgeTypes.map(type => type.flash_size)) / 0x400000).toBe(128);
  });

  it('rejects invalid sector geometry before allocating a compilation', () => {
    cartridgeTypes[1].sector_size = 0;
    expect(() => prepareCompilation(1)).toThrow('geometry');
  });

  it('keeps no-save slot zero away from status', () => {
    const result = prepare([game({ save_slot: 0 })]);
    expect(result.games[0].save_type).toBe(0);
    expect(result.games[0].save_slot).toBe(0);
    expect(result.map[3]).toBe('C');
    assertBinaryEqual(result.compilation.subarray(3 * sectorSize, 4 * sectorSize), new Uint8Array(sectorSize).fill(0xFF));
  });

  it('reserves high slots with no imported save and tracks their full end', () => {
    const result = prepare([game({ save_slot: 10 })]);
    expect(result.save_end_offset).toBe(14);
    expect(result.map[13]).toBe('S');
    assertBinaryEqual(result.compilation.subarray(13 * sectorSize, 14 * sectorSize), new Uint8Array(sectorSize));
  });

  it('accepts a save slot ending exactly at the flash boundary', () => {
    const result = prepare([game({ save_slot: 12 })]);
    expect(result.save_end_offset).toBe(result.map.length);
    expect(result.games[0].save_slot).toBe(11);
    expect(result.map[15]).toBe('S');
  });

  it('retains imported shared-slot bytes and lets a later available file initialize a slot', () => {
    const first = game({ file: 'first.gba' });
    const second = game({ file: 'second.gba' });
    const saves = new Map([['second.sav', new Uint8Array([5, 6]).buffer]]);
    const result = prepare([first, second, game({ file: 'third.gba' })], saves);
    const expected = new Uint8Array(sectorSize);
    expected.set([5, 6]);
    assertBinaryEqual(result.compilation.subarray(4 * sectorSize, 5 * sectorSize), expected);
    expect(result.saves_read).toEqual([0]);
    expect(result.save_end_offset).toBe(5);
  });

  it.each([-1, 1.5, 257, NaN, 13])('rejects invalid or out-of-flash save slot %s', save_slot => {
    expect(() => prepare([game({ save_slot })])).toThrow('save slot');
  });

  it('skips a short ROM whose padded logical span extends past the tail', async () => {
    const compilation = new Uint8Array(0x600000).fill(0xFF);
    const map = Array(compilation.length / sectorSize).fill('.') as string[];
    map.fill('R', 0, 32);
    const prepared = game({ index: 0, size: 0x400000, sector_count: 32, save_type: 0, keysValue: 0 });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await addRomData([prepared], compilation, map, sectorSize, blockSize, 32, true, new Map([['game.gba', new Uint8Array(0x10000).buffer]]));
    expect(prepared.sector_offset).toBeUndefined();
    expect(map).toHaveLength(48);
    expect(map.slice(32).every(mark => mark === '.')).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('available cartridge space'));
  });

  it('preserves 64 KiB input padding, font and hidden-key grouping in an 8 MiB build', async () => {
    cartridgeTypes[1].flash_size = 0x800000;
    const fixture = input();
    fixture.config.games[0].title_font = 2;
    fixture.config.games[0].keys = ['L', 'A'];
    const result = new Uint8Array((await buildRom(fixture)).rom);
    assertBinaryEqual(result.subarray(0x400000, 0x410000), new Uint8Array(0x10000).fill(0xA5));
    expect(result[0x40000]).toBe(1);
    expect(new DataView(result.buffer).getUint16(0x40008, true)).toBe(513);
    expect(result.length).toBe(0x800000);
  });

  it.each([0x10000, -1, 0x90000, NaN])('rejects unsafe minimum ROM size %s', min_rom_size => {
    cartridgeTypes[1].flash_size = 0x800000;
    const fixture = input();
    fixture.config.cartridge.min_rom_size = min_rom_size;
    return expect(buildRom(fixture)).rejects.toThrow('minimum ROM size');
  });

  it('defaults the minimum size in legacy configuration with an absent field', async () => {
    cartridgeTypes[1].flash_size = 0x800000;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    try {
      const fixture = input();
      const baseline = await buildRom(fixture);
      Reflect.deleteProperty(fixture.config.cartridge, 'min_rom_size');
      const legacy = await buildRom(fixture);
      assertBinaryEqual(new Uint8Array(legacy.rom), new Uint8Array(baseline.rom));
      expect(legacy.code).toBe(baseline.code);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects invalid fonts and empty ROM files', async () => {
    cartridgeTypes[1].flash_size = 0x800000;
    const fixture = input();
    fixture.config.games[0].title_font = 256;
    await expect(buildRom(fixture)).rejects.toThrow('title font');
    fixture.config.games[0].title_font = 1;
    fixture.romFiles.set('game.gba', new ArrayBuffer(0));
    await expect(buildRom(fixture)).rejects.toThrow('empty');
  });

  it('groups visible and hidden allocated entries in menu key order', () => {
    const metadata = { title_font: 0, sector_offset: 8, block_offset: 2, block_count: 1, save_type: 0, save_slot: 0 };
    const hidden = game({ ...metadata, index: 0, title: 'Hidden', keysValue: 513 });
    const visible = game({ ...metadata, index: 1, title: 'Visible', keysValue: 0 });
    const list = generateItemList([hidden, visible], [0, 513], false, blockSize, sectorSize, 2);
    const view = new DataView(list.buffer);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(0x78, true)).toBe(513);
    expect(view.getUint16(16, true)).toBe('V'.charCodeAt(0));
    expect(view.getUint16(0x80, true)).toBe('H'.charCodeAt(0));
  });

  it('rejects fixed metadata layout that cannot fit after the menu', async () => {
    cartridgeTypes[1].flash_size = 0x80000;
    const fixture = input();
    fixture.menuRom = new Uint8Array(0x60000).buffer;
    await expect(buildRom(fixture)).rejects.toThrow('layout');
  });

  it.each([0x20000, 0x40000])('bounds actual allocated menu entries to one %s-byte sector', size => {
    const serialized = game({ title_font: 0, index: 0, sector_offset: 8, block_offset: 2, block_count: 1, keysValue: 0, save_type: 0, save_slot: 0 });
    const capacity = Math.floor(size / 0x70);
    const games = Array.from({ length: capacity }, (_, index) => ({ ...serialized, index }));
    expect(generateItemList(games, [0], false, blockSize, size, 2)).toHaveLength(capacity * 0x70);
    games.push({ ...serialized, index: capacity });
    expect(() => generateItemList(games, [0], false, blockSize, size, 2)).toThrow('item list');
  });
});
