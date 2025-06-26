export interface RomSlot {
  id: string;
  name: string;
  offset: number;
  size: number;
  file?: FileInfo;
  color?: string;
  // 多槽位文件支持
  isFirstSlot?: boolean; // 是否为文件的第一个槽位
  slotIndex?: number; // 在文件中的槽位索引（0, 1, 2...）
  totalSlots?: number; // 文件占用的总槽位数
}

export interface SlotConfig {
  size: number;
  alignment: number;
}

export interface RomAssemblyConfig {
  totalSize: number;
  alignment: number; // 默认对齐，用于向后兼容
  slotSize: number; // 默认槽位大小，用于向后兼容
  maxSlots: number;
  type: 'MBC5' | 'GBA';
  // 变长槽位支持
  variableSlots?: boolean;
  slotConfigs?: SlotConfig[];
}

export interface AssembledRom {
  data: Uint8Array;
  slots: RomSlot[];
  totalSize: number;
}

export interface FileInfo {
  name: string;
  data: Uint8Array;
  size: number;
}
