import { SectorProgressInfo } from '@/types/progress-info';
import { SectorBlock } from '@/utils/parsers/cfi-parser';

export function calcSectorUsage(
  eraseSectorBlocks: SectorBlock[],
  size: number,
  baseAddress = 0x00,
): SectorBlock[] {
  // 如果不需要任何空间，返回空数组
  if (size <= 0) {
    return [];
  }

  // 计算总可用空间
  const totalAvailable = eraseSectorBlocks.reduce((sum, block) => sum + block.totalSize, 0);

  // 检查空间是否足够
  if (totalAvailable < size) {
    throw new Error(`Insufficient sector space: need ${size} bytes, but only ${totalAvailable} bytes available`);
  }

  const result: SectorBlock[] = [];
  let remaining = size;
  let currentAddress = baseAddress;

  for (const block of eraseSectorBlocks) {
    if (remaining <= 0) break;
    if (block.sectorCount === 0) continue; // 跳过空扇区块

    // 计算需要使用的扇区数量
    const sectorsNeeded = Math.ceil(remaining / block.sectorSize);
    const sectorsToUse = Math.min(sectorsNeeded, block.sectorCount);

    if (sectorsToUse > 0) {
      const totalSize = sectorsToUse * block.sectorSize;
      result.push({
        startAddress: currentAddress,
        endAddress: currentAddress + totalSize - 1,
        sectorSize: block.sectorSize,
        sectorCount: sectorsToUse,
        totalSize,
      });

      currentAddress += totalSize;
      remaining -= totalSize;
    }
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
        state: 'pending',
      });
    }
  }

  return sectors;
}
