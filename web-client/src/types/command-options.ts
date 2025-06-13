export type RamType = 'SRAM' | 'FLASH';

export interface CommandOptions {
  size?: number,
  ramType?: RamType,
  sectorSize?: number,
  baseAddress?: number,
  endAddress?: number,
  // command info
  bufferSize?: number,
}
