export type RamType = 'SRAM' | 'FLASH';

export interface CommandOptions {
  ramType?: RamType,
  baseAddress?: number,
  romSize?: number,
  useDirectWrite?: boolean,
}
