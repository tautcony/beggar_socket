import type { CartridgeAdapter } from '@/services/cartridge-adapter';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';

import { mapDomainError } from '../application/domain/error-mapping';
import type { BurnerProtocolPort, BurnerProtocolSession } from '../application/domain/ports';
import { failureResult, successResult, type BurnerDomainResult } from '../application/domain/result';

class CartridgeProtocolSessionAdapter implements BurnerProtocolSession {
  readonly id: string;

  constructor(private readonly adapter: CartridgeAdapter, idSuffix: string) {
    this.id = `cartridge:${idSuffix}`;
  }

  getCartInfo(enable5V?: boolean): Promise<CFIInfo | false> {
    return this.adapter.getCartInfo(enable5V);
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

function normalizeCommandResult(stage: 'protocol' | 'transport', result: CommandResult): BurnerDomainResult<CommandResult> {
  if (result.success) {
    return successResult(result);
  }

  return failureResult(mapDomainError(stage, new Error(result.message), result.message));
}

async function wrapRuntimeCall<TData>(
  stage: 'protocol' | 'transport',
  fallbackMessage: string,
  operation: () => Promise<TData>,
): Promise<BurnerDomainResult<TData>> {
  try {
    return successResult(await operation());
  } catch (error) {
    return failureResult(mapDomainError(stage, error, fallbackMessage));
  }
}

export class CartridgeProtocolPortAdapter implements BurnerProtocolPort {
  async readCartInfo(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerDomainResult<CFIInfo>> {
    const result = await wrapRuntimeCall('protocol', 'Read cart info failed', () => session.getCartInfo(enable5V));
    if (!result.ok) {
      return result;
    }

    if (!result.data) {
      return failureResult(mapDomainError('protocol', new Error('No cart info returned'), 'No cart info returned'));
    }

    return successResult(result.data);
  }

  async eraseSectors(
    session: BurnerProtocolSession,
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('protocol', 'Erase sectors failed', () => session.eraseSectors(sectorInfo, options, signal));
    return runtimeResult.ok ? normalizeCommandResult('protocol', runtimeResult.data) : runtimeResult;
  }

  async writeRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: CommandOptions,
    signal?: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('transport', 'Write ROM failed', () => session.writeROM(data, options, signal));
    return runtimeResult.ok ? normalizeCommandResult('transport', runtimeResult.data) : runtimeResult;
  }

  async readRom(
    session: BurnerProtocolSession,
    size: number,
    options: CommandOptions,
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('transport', 'Read ROM failed', () => session.readROM(size, options, signal, showProgress));
    return runtimeResult.ok ? normalizeCommandResult('transport', runtimeResult.data) : runtimeResult;
  }

  async verifyRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: CommandOptions,
    signal: AbortSignal,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('protocol', 'Verify ROM failed', () => session.verifyROM(data, options, signal));
    return runtimeResult.ok ? normalizeCommandResult('protocol', runtimeResult.data) : runtimeResult;
  }

  async writeRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options?: CommandOptions,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('transport', 'Write RAM failed', () => session.writeRAM(data, options));
    return runtimeResult.ok ? normalizeCommandResult('transport', runtimeResult.data) : runtimeResult;
  }

  async readRam(session: BurnerProtocolSession, size: number, options?: CommandOptions): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('transport', 'Read RAM failed', () => session.readRAM(size, options));
    return runtimeResult.ok ? normalizeCommandResult('transport', runtimeResult.data) : runtimeResult;
  }

  async verifyRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options?: CommandOptions,
  ): Promise<BurnerDomainResult<CommandResult>> {
    const runtimeResult = await wrapRuntimeCall('protocol', 'Verify RAM failed', () => session.verifyRAM(data, options));
    return runtimeResult.ok ? normalizeCommandResult('protocol', runtimeResult.data) : runtimeResult;
  }

  async resetCommandBuffer(session: BurnerProtocolSession): Promise<BurnerDomainResult<void>> {
    return wrapRuntimeCall('transport', 'Reset command buffer failed', () => session.resetCommandBuffer());
  }
}

export function createCartridgeProtocolSession(
  adapter: CartridgeAdapter,
  idSuffix = Math.random().toString(36).slice(2),
): BurnerProtocolSession {
  return new CartridgeProtocolSessionAdapter(adapter, idSuffix);
}
