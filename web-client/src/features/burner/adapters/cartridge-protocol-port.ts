import type { CartridgeAdapter } from '@/services/cartridge-adapter';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';

import type { BurnerProtocolSession } from '../application/domain/ports';

class CartridgeProtocolSessionAdapter implements BurnerProtocolSession {
  readonly id: string;
  readonly isActive?: () => boolean;

  constructor(private readonly adapter: CartridgeAdapter, idSuffix: string, isActive?: () => boolean) {
    this.id = `cartridge:${idSuffix}`;
    this.isActive = isActive;
  }

  getCartInfo(enable5V?: boolean): Promise<CFIInfo | false> {
    return this.adapter.getCartInfo(enable5V);
  }

  getLastCartInfoError(): string | undefined {
    return this.adapter.getLastCartInfoError();
  }

  eraseSectors(sectorInfo: SectorBlock[], options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    return this.adapter.eraseSectors(sectorInfo, options, signal);
  }

  writeROM(data: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    return this.adapter.writeROM(data, options, signal);
  }

  readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress?: boolean): Promise<CommandResult> {
    return this.adapter.readROM(size, options, signal, showProgress);
  }

  verifyROM(data: Uint8Array, options: CommandOptions, signal: AbortSignal): Promise<CommandResult> {
    return this.adapter.verifyROM(data, options, signal);
  }

  writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    return this.adapter.writeRAM(data, options);
  }

  readRAM(size: number, options?: CommandOptions): Promise<CommandResult> {
    return this.adapter.readRAM(size, options);
  }

  verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    return this.adapter.verifyRAM(data, options);
  }

  resetCommandBuffer(): Promise<void> {
    return this.adapter.resetCommandBuffer();
  }
}

export function createCartridgeProtocolSession(
  adapter: CartridgeAdapter,
  idSuffix = Math.random().toString(36).slice(2),
  options?: {
    isActive?: () => boolean;
  },
): BurnerProtocolSession {
  return new CartridgeProtocolSessionAdapter(adapter, idSuffix, options?.isActive);
}
