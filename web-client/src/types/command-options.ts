import { CFIInfo } from '@/utils/parsers/cfi-parser';

export type RamType = 'SRAM' | 'FLASH' | 'FRAM' | 'BATLESS';
export type MbcType = 'MBC1' | 'MBC2' | 'MBC3' | 'MBC5';

export interface CommandOptions {
  size?: number;
  ramType?: RamType;
  baseAddress?: number;
  endAddress?: number;
  cfiInfo: CFIInfo;
  romPageSize?: number;
  ramPageSize?: number;
  framLatency?: number;
  mbcType?: MbcType;
  enable5V?: boolean;
}
