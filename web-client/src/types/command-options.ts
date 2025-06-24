import { CFIInfo } from '@/utils/cfi-parser';

export type RamType = 'SRAM' | 'FLASH';

export interface CommandOptions {
  size?: number,
  ramType?: RamType,
  baseAddress?: number,
  endAddress?: number,
  cfiInfo: CFIInfo,
}
