import { describe, expect, it } from 'vitest';

import { GBA_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';
import { detectMultiRoms } from '@/utils/rom/rom-split-utils';

function writeGbaHeader(target: Uint8Array, offset: number, title: string, code: string) {
  // GBA 固定特征字节 0x96 在 0xB2，以及 0x00..0x03 分支指令
  target[offset + 0] = 0x00;
  target[offset + 1] = 0x00;
  target[offset + 2] = 0x00;
  target[offset + 3] = 0xea;
  target.set(GBA_NINTENDO_LOGO, offset + 0x04);
  target[offset + 0xb2] = 0x96;

  for (let i = 0; i < Math.min(12, title.length); i++) {
    target[offset + 0xa0 + i] = title.charCodeAt(i);
  }
  for (let i = 0; i < Math.min(4, code.length); i++) {
    target[offset + 0xac + i] = code.charCodeAt(i);
  }

  let checksum = 0;
  for (let i = 0xa0; i <= 0xbc; i++) {
    checksum = (checksum - target[offset + i]) | 0;
  }
  target[offset + 0xbd] = (checksum - 0x19) & 0xff;
}

describe('rom-split-utils', () => {
  it('detects multiple GBA games across 4MiB banks and slices their data', () => {
    const bankSize = 0x400000;
    const rom = new Uint8Array(bankSize * 2);
    writeGbaHeader(rom, 0, 'GAMEONE', 'AGB1');
    writeGbaHeader(rom, bankSize, 'GAMETWO', 'AGB2');
    rom[bankSize + 0x300] = 0x5a;

    const result = detectMultiRoms(rom);
    expect(result.platformType).toBe('GBA');
    expect(result.isMultiCart).toBe(true);
    expect(result.games).toHaveLength(2);
    expect(result.games[0].startAddress).toBe(0);
    expect(result.games[0].calculatedSize).toBe(bankSize);
    expect(result.games[0].romInfo.title).toBe('GAMEONE');
    expect(result.games[1].startAddress).toBe(bankSize);
    expect(result.games[1].romInfo.title).toBe('GAMETWO');
    expect(result.games[1].data[0x300]).toBe(0x5a);
  });

  it('marks single-game GBA ROM as non-multicart', () => {
    const rom = new Uint8Array(0x400000);
    writeGbaHeader(rom, 0, 'SOLO', 'SOLO');

    const result = detectMultiRoms(rom);
    expect(result.platformType).toBe('GBA');
    expect(result.isMultiCart).toBe(false);
    expect(result.games).toHaveLength(1);
  });
});
