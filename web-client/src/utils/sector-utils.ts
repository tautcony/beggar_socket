import { SectorProgressInfo, type SectorProgressState } from '@/types/progress-info';
import { SectorBlock } from '@/utils/parsers/cfi-parser';

export function calcSectorUsage(
  eraseSectorBlocks: SectorBlock[],
  size: number,
  baseAddress = 0x00,
): SectorBlock[] {
  if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(baseAddress) || baseAddress < 0) {
    throw new Error('Invalid sector range: size and baseAddress must be nonnegative safe integers');
  }
  const rangeEnd = baseAddress + size;
  if (!Number.isSafeInteger(rangeEnd)) {
    throw new Error('Invalid sector range: end address exceeds safe integer bounds');
  }
  // Empty requests do not require erase geometry.
  if (size === 0) return [];

  const blocks = [...eraseSectorBlocks].sort((a, b) => a.startAddress - b.startAddress);
  let previousEnd: number | undefined;
  for (const block of blocks) {
    const { sectorSize, sectorCount, totalSize, startAddress, endAddress } = block;
    const calculatedSize = sectorSize * sectorCount;
    const endExclusive = startAddress + calculatedSize;
    if (
      !Number.isSafeInteger(sectorSize) || sectorSize <= 0
      || !Number.isSafeInteger(sectorCount) || sectorCount <= 0
      || !Number.isSafeInteger(totalSize) || totalSize !== calculatedSize
      || !Number.isSafeInteger(calculatedSize)
      || !Number.isSafeInteger(startAddress) || startAddress < 0
      || !Number.isSafeInteger(endAddress) || endAddress !== endExclusive - 1
      || !Number.isSafeInteger(endExclusive)
      || (previousEnd !== undefined && startAddress !== previousEnd)
    ) {
      throw new Error('Invalid sector geometry: regions must contain contiguous physical sectors with consistent safe integer bounds');
    }
    previousEnd = endExclusive;
  }

  const geometryStart = blocks[0]?.startAddress ?? 0;
  const geometryEnd = previousEnd ?? 0;
  if (blocks.length === 0 || baseAddress < geometryStart || rangeEnd > geometryEnd) {
    const available = baseAddress >= geometryStart ? Math.max(0, geometryEnd - baseAddress) : 0;
    throw new Error(`Insufficient sector space: need ${size} bytes, but only ${available} bytes available`);
  }

  const result: SectorBlock[] = [];
  for (const block of blocks) {
    const overlapStart = Math.max(baseAddress, block.startAddress);
    const overlapEnd = Math.min(rangeEnd, block.endAddress + 1);
    if (overlapStart >= overlapEnd) continue;
    const firstSector = Math.floor((overlapStart - block.startAddress) / block.sectorSize);
    const endSector = Math.ceil((overlapEnd - block.startAddress) / block.sectorSize);
    const sectorCount = endSector - firstSector;
    const startAddress = block.startAddress + firstSector * block.sectorSize;
    const totalSize = sectorCount * block.sectorSize;
    result.push({
      startAddress,
      endAddress: startAddress + totalSize - 1,
      sectorSize: block.sectorSize,
      sectorCount,
      totalSize,
    });
  }
  return result;
}

/**
 * 创建扇区级别的进度信息对象（用于擦除操作的可视化）
 * @param sectorInfo - 扇区信息数组
 * @returns 初始的扇区进度信息（按物理地址从低到高排序）
 */
export function createSectorProgressInfo(
  sectorInfo: SectorBlock[],
  initialState: SectorProgressState = 'pending_erase',
): SectorProgressInfo[] {
  const sectors: SectorProgressInfo[] = [];

  // 按照从低地址到高地址的顺序处理扇区段，保持物理顺序
  const sortedSectorInfo = [...sectorInfo].sort((a, b) => a.startAddress - b.startAddress);

  for (const { startAddress, sectorSize, sectorCount } of sortedSectorInfo) {
    // 在当前扇区段内从低地址向高地址创建扇区信息
    for (let i = 0; i < sectorCount; i++) {
      const address = startAddress + i * sectorSize;
      sectors.push({
        address,
        size: sectorSize,
        state: initialState,
      });
    }
  }

  return sectors;
}
