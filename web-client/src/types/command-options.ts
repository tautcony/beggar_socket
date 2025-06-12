export type RamType = 'SRAM' | 'FLASH';

export interface CommandOptions {
  romSize?: number,
  ramType?: RamType,
  ramSize?: number,
  baseAddress?: number,
  size?: number,
  bufferSize?: number,
}
