import { describe, expect, it, vi } from 'vitest';

import { buildRom, generateItemList, ITEM_TITLE_CODE_UNIT_LIMIT, prepareCompilation } from '@/services/lk/romBuilder';
import type { BuildInput, GameConfig } from '@/services/lk/types';

function makeSerializedGame(title: string): GameConfig {
  return {
    enabled: true,
    file: 'game.gba',
    title,
    title_font: 0,
    save_slot: 0,
    index: 0,
    block_offset: 1,
    block_count: 1,
    sector_offset: 1,
    keysValue: 0,
    save_type: 2,
  };
}

describe('LK ROM builder', () => {
  it('rejects cartridge types that are not present in the shared registry', () => {
    expect(() => prepareCompilation(6)).toThrow('Invalid cartridge type: 6');
  });

  it.each([
    ['ASCII', 'A'.repeat(ITEM_TITLE_CODE_UNIT_LIMIT + 12), ITEM_TITLE_CODE_UNIT_LIMIT],
    ['CJK', '游'.repeat(ITEM_TITLE_CODE_UNIT_LIMIT + 12), ITEM_TITLE_CODE_UNIT_LIMIT],
    ['surrogate pair', `${'A'.repeat(ITEM_TITLE_CODE_UNIT_LIMIT - 1)}🎮`, ITEM_TITLE_CODE_UNIT_LIMIT - 1],
  ])('stores a bounded %s title length', (_label, title, expectedLength) => {
    const itemList = generateItemList([makeSerializedGame(title)], [0], true, 0x80000, 0x20000, 2);

    expect(itemList[1]).toBe(expectedLength);
    expect(itemList).toHaveLength(0x30 * 2 + 16);
  });

  it('does not mutate caller game configuration across builds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00.000Z'));

    const gameData = new Uint8Array(0x400000).buffer;
    const input: BuildInput = {
      config: {
        cartridge: { type: 1, battery_present: true, min_rom_size: 0x400000 },
        games: [{
          enabled: true,
          file: 'game.gba',
          title: 'Game',
          title_font: 1,
          save_slot: 1,
        }],
      },
      menuRom: new Uint8Array(0x200).buffer,
      romFiles: new Map([['game.gba', gameData]]),
      saveFiles: new Map(),
      options: { split: false, noLog: true, output: 'test_<CODE>.gba' },
    };
    const originalConfig = structuredClone(input.config);

    try {
      const first = await buildRom(input);
      const second = await buildRom(input);

      expect(input.config).toEqual(originalConfig);
      expect(new Uint8Array(second.rom)).toEqual(new Uint8Array(first.rom));
      expect(second.code).toBe(first.code);
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);
});
