import { MBC5_ROM_BASE_ADDRESS } from '@/utils/address-utils';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';

export interface DetectedSplitGame {
  startAddress: number;
  endAddress: number;
  calculatedSize: number;
  desc: string;
  romInfo: RomInfo;
  data: Uint8Array;
}

export interface MultiRomDetectionResult {
  platformType: 'GBA' | 'MBC5' | null;
  games: DetectedSplitGame[];
  isMultiCart: boolean;
}

/**
 * 解析 ROM 镜像中的多合一子游戏分段（GBA 按 4 MiB Bank，GB/GBC 按 MBC5_ROM_BASE_ADDRESS）
 */
export function detectMultiRoms(fileData: Uint8Array): MultiRomDetectionResult {
  const mainRomInfo = parseRom(fileData);
  if (!mainRomInfo.isValid) {
    return { platformType: null, games: [], isMultiCart: false };
  }

  const games: DetectedSplitGame[] = [];

  if (mainRomInfo.type === 'GBA') {
    const bankSize = 0x400000;
    const bankCount = Math.floor(fileData.length / bankSize);
    const validGames: { startAddress: number; romInfo: RomInfo; desc: string }[] = [];

    for (let i = 0; i < bankCount; i++) {
      const startAddress = i * bankSize;
      if (startAddress + 0x150 > fileData.length) {
        continue;
      }

      const headerEndAddress = Math.min(startAddress + 0x200, fileData.length);
      const parsedRomInfo = parseRom(fileData.subarray(startAddress, headerEndAddress));
      if (parsedRomInfo.isValid) {
        validGames.push({
          startAddress,
          romInfo: parsedRomInfo,
          desc: `Bank ${i.toString().padStart(2, '0')}`,
        });
      }
    }

    for (let i = 0; i < validGames.length; i++) {
      const game = validGames[i];
      const endAddressExclusive = i < validGames.length - 1
        ? validGames[i + 1].startAddress
        : fileData.length;
      const calculatedSize = endAddressExclusive - game.startAddress;

      games.push({
        startAddress: game.startAddress,
        endAddress: endAddressExclusive,
        calculatedSize,
        desc: game.desc,
        romInfo: {
          ...game.romInfo,
          romSize: calculatedSize,
        },
        data: fileData.slice(game.startAddress, endAddressExclusive),
      });
    }

    return {
      platformType: 'GBA',
      games,
      isMultiCart: games.length > 1,
    };
  }

  if (mainRomInfo.type === 'GB' || mainRomInfo.type === 'GBC') {
    const multiCardRanges = [0x000000, ...MBC5_ROM_BASE_ADDRESS];

    for (let i = 0; i < multiCardRanges.length; i++) {
      const baseAddress = multiCardRanges[i];
      if (baseAddress >= fileData.length) {
        break;
      }

      const headerEndAddress = Math.min(baseAddress + 0x150, fileData.length);
      if (headerEndAddress - baseAddress < 0x150) {
        continue;
      }

      const parsedRomInfo = parseRom(fileData.subarray(baseAddress, headerEndAddress));
      if (parsedRomInfo.isValid) {
        const nextBase = i === multiCardRanges.length - 1 ? fileData.length : multiCardRanges[i + 1];
        const endAddress = Math.min(nextBase, fileData.length);
        const calculatedSize = endAddress - baseAddress;

        games.push({
          startAddress: baseAddress,
          endAddress,
          calculatedSize,
          desc: i === 0 ? 'Menu' : `Game ${i.toString().padStart(2, '0')}`,
          romInfo: {
            ...parsedRomInfo,
            romSize: calculatedSize,
          },
          data: fileData.slice(baseAddress, endAddress),
        });
      }
    }

    const onlyMenuDetected = games.length === 1 && games[0].startAddress === 0;
    if (onlyMenuDetected) {
      return { platformType: 'MBC5', games: [], isMultiCart: false };
    }

    return {
      platformType: 'MBC5',
      games,
      isMultiCart: games.length > 1 || (games.length === 1 && games[0].startAddress > 0),
    };
  }

  return { platformType: null, games: [], isMultiCart: false };
}
