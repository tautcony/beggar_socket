import { describe, expect, it, vi } from 'vitest';

import { addRomData, buildRom, generateItemList, importSaveDataAndAddRom, logp, prepareCompilation } from '@/services/lk/romBuilder';
import type { BuildInput } from '@/services/lk/types';

import { assertBinaryEqual } from './helpers/binary-assertion';

function makeInput(title: string): BuildInput {
  return {
    config: {
      cartridge: { type: 1, battery_present: true, min_rom_size: 0x400000 },
      games: [{ enabled: true, file: 'game.gba', title, title_font: 1, save_slot: 1, keys: ['A'] }],
    },
    menuRom: new Uint8Array(0x200).buffer,
    romFiles: new Map([['game.gba', new Uint8Array(0x400000).buffer]]),
    saveFiles: new Map([['game.sav', new Uint8Array([1, 2, 3, 4]).buffer]]),
    options: { split: false, noLog: true, output: 'test_<CODE>.gba' },
  };
}

describe('LK build context', () => {
  it('preserves the fixed timestamp golden ROM including imported save bytes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    try {
      // Pre-refactor fixture: one hidden A-key game, first save slot, zero-filled ROM.
      const result = await buildRom(makeInput('First'));
      const expected = new Uint8Array(0x800000).fill(0xFF);
      expected.fill(0, 0, 0x200);
      expected.set(new TextEncoder().encode('2026-07-31T00:00:00.000Z'), 0x210);
      expected.set([0x4C, 0x45, 0x37, 0x38], 0xAC); // LE78
      expected[0xBD] = 0xE7;
      const item = new Uint8Array(0x70);
      item.set([0, 5, 8, 0, 8, 0, 2, 0, 1, 0]);
      item.set([0x46, 0, 0x69, 0, 0x72, 0, 0x73, 0, 0x74, 0], 16);
      expected.set(item, 0x40000);
      expected.set([0x4B, 0x55, 0x4D, 0x41, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0x60000);
      expected.fill(0, 0x80000, 0xA0000);
      expected.set([1, 2, 3, 4], 0x80000);
      expected.fill(0, 0x400000);
      assertBinaryEqual(new Uint8Array(result.rom), expected);
      expect(result.code).toBe('LE78');
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it('isolates concurrent results across a controlled hash suspension', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    const firstInput = makeInput('First');
    const secondInput = makeInput('Second');
    for (const [input, title] of [[firstInput, 'First overflow'], [secondInput, 'Second overflow']] as const) {
      input.config.cartridge.min_rom_size = 0x8000000;
      input.config.games.push({ enabled: true, file: 'overflow.gba', title, title_font: 1, save_slot: 1 });
      input.romFiles.set('overflow.gba', new Uint8Array(1).buffer);
    }
    const originalFirst = structuredClone(firstInput.config);
    const originalSecond = structuredClone(secondInput.config);
    let release!: () => void;
    let entered!: () => void;
    const suspended = new Promise<void>((resolve) => { entered = resolve; });
    const resume = new Promise<void>((resolve) => { release = resolve; });
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let firstPending: ReturnType<typeof buildRom> | undefined;
    try {
      const firstBaseline = await buildRom(firstInput);
      const secondBaseline = await buildRom(secondInput);
      expect(firstBaseline.code).not.toBe(secondBaseline.code);
      let pauseNext = true;
      vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
        if (pauseNext) {
          pauseNext = false;
          entered();
          await resume;
        }
        return digest(algorithm, data);
      });
      firstPending = buildRom(firstInput);
      await suspended;
      logp('Public helper log outside a build');
      const second = await buildRom(secondInput);
      release();
      const first = await firstPending;
      expect(first.log).toBe(firstBaseline.log);
      expect(second.log).toBe(secondBaseline.log);
      expect(first.log).toContain('First overflow');
      expect(first.log).not.toContain('Second overflow');
      expect(second.log).toContain('Second overflow');
      expect(second.log).not.toContain('First overflow');
      expect(first.code).toBe(firstBaseline.code);
      expect(second.code).toBe(secondBaseline.code);
      assertBinaryEqual(new Uint8Array(first.rom), new Uint8Array(firstBaseline.rom));
      assertBinaryEqual(new Uint8Array(second.rom), new Uint8Array(secondBaseline.rom));
      expect(firstInput.config).toEqual(originalFirst);
      expect(secondInput.config).toEqual(originalSecond);
    } finally {
      release();
      await firstPending;
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  }, 15_000);

  it('omits disabled and missing games without affecting valid ROM or save bytes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    try {
      const input = makeInput('First');
      const baseline = await buildRom(input);
      input.config.games.unshift(
        { enabled: false, file: 'disabled.gba', title: 'Disabled', title_font: 1, save_slot: 1 },
        { enabled: true, file: 'missing.gba', title: 'Missing', title_font: 1, save_slot: 1 },
      );
      const result = await buildRom(input);
      assertBinaryEqual(new Uint8Array(result.rom), new Uint8Array(baseline.rom));
      const expectedSave = new Uint8Array(0x20000);
      expectedSave.set([1, 2, 3, 4]);
      assertBinaryEqual(new Uint8Array(result.rom, 0x80000, 0x20000), expectedSave);
      expect(result.code).toBe(baseline.code);
      expect(result.log).not.toContain('Disabled');
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it('rejects incomplete allocated metadata at the public encoding boundary', () => {
    const game = { ...makeInput('First').config.games[0], sector_offset: 1, index: 0, keysValue: 0 };
    expect(() => generateItemList([game], [0], true, 0x80000, 0x20000, 2)).toThrow('block_offset');
  });

  it('retains mutable public preparation and allocation helpers', async () => {
    const input = makeInput('First');
    const { compilation, sector_map, sector_size, block_size } = prepareCompilation(1);
    const game = input.config.games[0];
    const prepared = importSaveDataAndAddRom(input.config.games, sector_size, 0x400000, true, compilation, sector_map, 4, input.romFiles, input.saveFiles);
    expect(prepared.games[0]).toBe(game);
    expect(game.save_slot).toBe(0);
    expect(game.title_font).toBe(0);
    expect(await addRomData(prepared.games, compilation, sector_map, sector_size, block_size, prepared.save_end_offset, true, input.romFiles)).toBe(true);
    expect(game.sector_offset).toBe(32);
    expect(game.block_offset).toBe(8);
    expect(game.block_count).toBe(8);
    const item = generateItemList(prepared.games, prepared.roms_keys, true, block_size, sector_size, 4);
    assertBinaryEqual(item.subarray(0, 10), new Uint8Array([0, 5, 8, 0, 8, 0, 2, 0, 1, 0]));
  });

  it('ignores stale computed fields on caller configuration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    try {
      const input = makeInput('First');
      const baseline = await buildRom(input);
      Object.assign(input.config.games[0], {
        index: 99, size: 1, sector_count: 0, keysValue: 1023, missing: true,
        save_type: 99, sector_offset: 0, block_offset: 0, block_count: 0,
      });
      const original = structuredClone(input.config);
      const result = await buildRom(input);
      assertBinaryEqual(new Uint8Array(result.rom), new Uint8Array(baseline.rom));
      expect(result.code).toBe(baseline.code);
      expect(input.config).toEqual(original);
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it('preserves result and console logging for both noLog option values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const input = makeInput('First');
      const quietOption = await buildRom(input);
      const quietConsole = consoleLog.mock.calls.map(args => args.join(' '));
      consoleLog.mockClear();
      input.options.noLog = false;
      const normalOption = await buildRom(input);
      expect(normalOption.log).toBe(quietOption.log);
      expect(quietOption.log).toContain('Output ROM Code: LE78');
      expect(consoleLog.mock.calls.map(args => args.join(' '))).toEqual(quietConsole);
    } finally {
      consoleLog.mockRestore();
      vi.useRealTimers();
    }
  }, 15_000);
});
