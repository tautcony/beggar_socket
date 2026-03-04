import type { MbcType } from '@/types/command-options';
import type { FileInfo } from '@/types/file-info';

export interface ChipOperationsProps {
  mode?: 'GBA' | 'MBC5';
  deviceReady: boolean;
  busy: boolean;
  chipId?: number[];
  deviceSize?: number;
  sectorCounts?: number[];
  sectorSizes?: number[];
  bufferWriteBytes?: number;
  selectedMbcType?: MbcType;
  mbcPower5V?: boolean;
}

export const CHIP_OPERATION_EVENTS = [
  'read-id',
  'erase-chip',
  'read-rom-info',
  'mbc-type-change',
  'mbc-power-change',
] as const;

export interface RomOperationsProps {
  mode: 'MBC5' | 'GBA';
  deviceReady: boolean;
  busy: boolean;
  romFileData?: Uint8Array | null;
  romFileName?: string;
  selectedRomSize?: string;
  selectedBaseAddress?: string;
}

export const ROM_OPERATION_EVENTS = [
  'file-selected',
  'file-cleared',
  'mode-switch-required',
  'rom-size-change',
  'base-address-change',
  'write-rom',
  'read-rom',
  'verify-rom',
  'verify-blank',
] as const;

export interface RamOperationsProps {
  mode: string;
  deviceReady: boolean;
  busy: boolean;
  ramFileData?: Uint8Array | null;
  ramFileName?: string;
  selectedRamSize?: string;
  selectedRamType?: string;
  selectedBaseAddress?: string;
}

export const RAM_OPERATION_EVENTS = [
  'file-selected',
  'file-cleared',
  'write-ram',
  'read-ram',
  'verify-ram',
  'verify-blank',
  'ram-size-change',
  'ram-type-change',
  'base-address-change',
] as const;

export type OperationFileEventPayload = FileInfo | FileInfo[];
