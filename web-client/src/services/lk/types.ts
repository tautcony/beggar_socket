// types.ts - 类型定义

export const appVersion = '1.2';
export const defaultFile = 'LK_MULTIMENU_<CODE>.gba';

export interface CartridgeType {
  name: string;
  flash_size: number;
  sector_size: number;
  block_size: number;
}

export const cartridgeTypes: CartridgeType[] = [
  { name: 'None', flash_size: 0, sector_size: 0, block_size: 0 },
  { name: 'MSP55LV100S or S29GL512', flash_size: 0x4000000, sector_size: 0x20000, block_size: 0x80000 },
  { name: '6600M0U0BE', flash_size: 0x10000000, sector_size: 0x40000, block_size: 0x80000 },
  { name: 'MSP54LV100 or S29GL01G', flash_size: 0x8000000, sector_size: 0x20000, block_size: 0x80000 },
  { name: 'F0095H0', flash_size: 0x20000000, sector_size: 0x40000, block_size: 0x80000 },
  { name: 'S70GL02G', flash_size: 0x10000000, sector_size: 0x20000, block_size: 0x80000 },
];

export interface GameConfig {
  enabled: boolean;
  file: string;
  title: string;
  title_font: number;
  save_slot: number;
  map_256m?: boolean;
  keys?: string[];
  index?: number;
  size?: number;
  sector_count?: number;
  save_type?: number;
  block_offset?: number;
  block_count?: number;
  sector_offset?: number;
  save_slot_index?: number;
  missing?: boolean;
  keysValue?: number;
}

export interface CartridgeConfig {
  type: number;
  battery_present: boolean;
  min_rom_size: number;
}

export interface FullConfig {
  cartridge: CartridgeConfig;
  games: GameConfig[];
}

export interface BuildOptions {
  split: boolean;
  noLog: boolean;
  bgImage?: ArrayBuffer;
  output: string;
}

export interface BuildInput {
  config: FullConfig;
  menuRom: ArrayBuffer;
  romFiles: Map<string, ArrayBuffer>;
  saveFiles: Map<string, ArrayBuffer>;
  options: BuildOptions;
}

export interface BuildResult {
  rom: ArrayBuffer;
  log: string;
  code: string;
}
