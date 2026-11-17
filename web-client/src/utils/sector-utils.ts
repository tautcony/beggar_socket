import { SectorProgressInfo, type SectorProgressState } from '@/types/progress-info';
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

  const sortedBlocks = eraseSectorBlocks
    .filter((block) => block.sectorCount > 0 && block.sectorSize > 0 && block.totalSize > 0)
    .slice()
    .sort((a, b) => a.startAddress - b.startAddress);

  const deviceSize = sortedBlocks.reduce(
    (maxEnd, block) => Math.max(maxEnd, block.startAddress + block.totalSize),
    0,
  );

  // 检查写入范围是否越过设备末尾
  if (baseAddress < 0 || baseAddress + size > deviceSize) {
    throw new Error(
      `Insufficient sector space: need ${size} bytes at 0x${baseAddress.toString(16)}, but device size is ${deviceSize} bytes`,
    );
  }

  const rangeStart = baseAddress;
  const rangeEnd = baseAddress + size;
  const result: SectorBlock[] = [];

  for (const block of sortedBlocks) {
    const blockStart = block.startAddress;
    const blockEnd = blockStart + block.totalSize;
    if (blockEnd <= rangeStart || blockStart >= rangeEnd) {
      continue;
    }

    const firstIndex = Math.max(0, Math.floor((rangeStart - blockStart) / block.sectorSize));
    const lastIndex = Math.min(
      block.sectorCount - 1,
      Math.floor((rangeEnd - 1 - blockStart) / block.sectorSize),
    );
    const sectorCount = lastIndex - firstIndex + 1;
    if (sectorCount <= 0) {
      continue;
    }

    const startAddress = blockStart + firstIndex * block.sectorSize;
    const totalSize = sectorCount * block.sectorSize;
    const endAddress = startAddress + totalSize - 1;

    const prev = result[result.length - 1];
    if (prev?.sectorSize === block.sectorSize && prev.endAddress + 1 === startAddress) {
      prev.sectorCount += sectorCount;
      prev.totalSize += totalSize;
      prev.endAddress = endAddress;
    } else {
      result.push({
        startAddress,
        endAddress,
        sectorSize: block.sectorSize,
        sectorCount,
        totalSize,
      });
    }
  }

  return result;
}

/**
 * 计算扇区擦除范围中超出目标写入区间的额外字节数（首/尾部分覆盖）
 */
export function getExtraErasedBytes(
  sectorBlocks: SectorBlock[],
  baseAddress: number,
  size: number,
): { headExtra: number; tailExtra: number; eraseStart: number; eraseEnd: number } | null {
  if (sectorBlocks.length === 0 || size <= 0) {
    return null;
  }
  const eraseStart = sectorBlocks[0].startAddress;
  const eraseEnd = sectorBlocks[sectorBlocks.length - 1].endAddress + 1;
  const headExtra = Math.max(0, baseAddress - eraseStart);
  const tailExtra = Math.max(0, eraseEnd - (baseAddress + size));
  if (headExtra === 0 && tailExtra === 0) {
    return null;
  }
  return { headExtra, tailExtra, eraseStart, eraseEnd };
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
