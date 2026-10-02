import type { FlashCommandSet, ProtocolTransportInput } from '@/protocol';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { DeviceInfo } from '@/types/device-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

import type { BankWindowPolicy } from './bank-chunk-planner';

/** Active hardware operation used by ROM reads, verification and write sampling. */
export interface RomReadOps {
  read: FlashCommandSet['read'];
}

/** Per-operation hardware policy; address units remain owned by the chunk planner/protocol. */
export interface RomReadStrategy {
  platformId: 'gba' | 'mbc5';
  bankWindow: BankWindowPolicy;
  resolveBankSwitch: () => ((bank: number) => Promise<void>) | undefined;
  withPowerConfig: (read: () => Promise<CommandResult>) => Promise<CommandResult>;
  throttleMs: number;
}

/**
 * @deprecated Legacy type retained for external source compatibility. Concrete adapters
 * now construct RomReadOps only and provide RomReadStrategy for each public ROM read.
 * These legacy fields are not a supported execution configuration for the shared loop.
 */
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
