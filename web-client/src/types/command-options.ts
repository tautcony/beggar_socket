import { CFIInfo } from '@/utils/parsers/cfi-parser';

export type RamType = 'SRAM' | 'FLASH' | 'FRAM' | 'BATLESS';

export interface CommandOptions {
  size?: number,
  ramType?: RamType,
  baseAddress?: number,
  endAddress?: number,
  cfiInfo: CFIInfo,
  romPageSize?: number;
  ramPageSize?: number;
  framLatency?: number;
}
