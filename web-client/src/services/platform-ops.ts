import type { FlashCommandSet, ProtocolTransportInput } from '@/protocol';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

export interface PlatformOps {
  readonly platformId: 'gba' | 'mbc5';
  readonly flashCmdSet: FlashCommandSet;
  readonly cfiEntryAddress: number;

  romProgram(device: ProtocolTransportInput, data: Uint8Array, address: number, bufferSize: number): Promise<void>;
  romEraseSector(device: ProtocolTransportInput, address: number): Promise<boolean>;
  cfiGetId(device: ProtocolTransportInput): Promise<Uint8Array>;

  toRomBank(address: number, options: CommandOptions): { bank: number; cartAddress: number };
  switchRomBank(device: DeviceInfo, bank: number, options: CommandOptions): Promise<void>;
  needsRomBankSwitch(cfiInfo: CFIInfo): boolean;
}
