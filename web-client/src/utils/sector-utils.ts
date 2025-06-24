export function calcSectorUsage(
  eraseSectorBlocks: [number, number, number][],
  size: number,
  baseAddress = 0x00,
): { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[] {
  const result: { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[] = [];
  let remaining = size;
  let address = baseAddress;

  for (const [sectorSize, sectorCount] of eraseSectorBlocks) {
    if (remaining <= 0) break;
    const usableCount = Math.min(sectorCount, Math.ceil(remaining / sectorSize));
    if (usableCount > 0) {
      result.push({
        startAddress: address,
        endAddress: address + sectorSize * usableCount - 1,
        sectorSize,
        sectorCount: usableCount,
      });
      address += sectorSize * usableCount;
      remaining -= sectorSize * usableCount;
    } else {
      address += sectorSize * sectorCount;
    }
  }

  return result;
}
