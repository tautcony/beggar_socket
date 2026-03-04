import type { CommandOptions, MbcType } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';
import { calcSectorUsage } from '@/utils/sector-utils';

import type { BurnerProtocolPort, BurnerProtocolSession } from './domain/ports';
import type { BurnerDomainResult } from './domain/result';

export interface GameDetectionResult {
  startAddress: number;
  desc: string;
  romInfo: RomInfo;
}

export interface BurnerReadCartResult extends CommandResult {
  cfiInfo?: CFIInfo;
  chipId?: number[];
  romSizeHex?: string;
}

export interface BurnerUseCase {
  readCart(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerReadCartResult>;
  eraseChip(context: BurnerOperationContext): Promise<CommandResult>;
  writeRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  readRom(context: BurnerOperationContext & { size: number; showProgress?: boolean }): Promise<CommandResult>;
  verifyRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  writeRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  readRam(context: BurnerOperationContext & { size: number }): Promise<CommandResult>;
  verifyRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  resetCommandBuffer(session: BurnerProtocolSession): Promise<void>;
  scanMultiCart(
    session: BurnerProtocolSession,
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]>;
}

export interface BurnerOperationContext {
  session: BurnerProtocolSession;
  cfiInfo: CFIInfo;
  options: CommandOptions;
  signal?: AbortSignal;
}

function toFailureResult(result: BurnerDomainResult<unknown>, fallbackMessage: string): CommandResult {
  if (result.ok) {
    return {
      success: true,
      message: fallbackMessage,
    };
  }

  return {
    success: false,
    message: result.error.message || fallbackMessage,
  };
}

function toCommandResult(result: BurnerDomainResult<CommandResult>, fallbackMessage: string): CommandResult {
  if (result.ok) {
    return result.data;
  }

  return {
    success: false,
    message: result.error.message || fallbackMessage,
  };
}

export class BurnerUseCaseImpl implements BurnerUseCase {
  constructor(
    private readonly protocolPort: BurnerProtocolPort,
    private readonly translate: (key: string) => string,
    private readonly formatHex: (value: number, length?: number) => string,
  ) {}

  private ensureSessionActive(session: BurnerProtocolSession): CommandResult | null {
    if (session.isActive && !session.isActive()) {
      return {
        success: false,
        message: 'Device not connected',
      };
    }

    return null;
  }

  async readCart(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerReadCartResult> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.readCartInfo(session, enable5V);
    if (!result.ok) {
      return {
        success: false,
        message: `${this.translate('messages.operation.readCartFailed')}: ${result.error.message}`,
      };
    }

    return {
      success: true,
      message: this.translate('messages.operation.readCartSuccess'),
      cfiInfo: result.data,
      chipId: result.data.flashId ? Array.from(result.data.flashId) : undefined,
      romSizeHex: this.formatHex(result.data.deviceSize, 4),
    };
  }

  async eraseChip(context: BurnerOperationContext): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const { session, cfiInfo, options, signal } = context;
    const sectorInfo = calcSectorUsage(cfiInfo.eraseSectorBlocks, cfiInfo.deviceSize, 0x00);
    const result = await this.protocolPort.eraseSectors(session, sectorInfo, options, signal);
    return toCommandResult(result, this.translate('messages.operation.eraseFailed'));
  }

  async writeRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.writeRom(context.session, context.data, context.options, context.signal);
    return toCommandResult(result, this.translate('messages.rom.writeFailed'));
  }

  async readRom(context: BurnerOperationContext & { size: number; showProgress?: boolean }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.readRom(
      context.session,
      context.size,
      context.options,
      context.signal,
      context.showProgress ?? true,
    );
    return toCommandResult(result, this.translate('messages.rom.readFailed'));
  }

  async verifyRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    if (!context.signal) {
      throw new Error('verifyRom requires abort signal');
    }

    const result = await this.protocolPort.verifyRom(context.session, context.data, context.options, context.signal);
    return toCommandResult(result, this.translate('messages.rom.verifyFailed'));
  }

  async writeRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.writeRam(context.session, context.data, context.options);
    return toCommandResult(result, this.translate('messages.ram.writeFailed'));
  }

  async readRam(context: BurnerOperationContext & { size: number }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.readRam(context.session, context.size, context.options);
    return toCommandResult(result, this.translate('messages.ram.readFailed'));
  }

  async verifyRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(context.session);
    if (inactive) {
      return inactive;
    }

    const result = await this.protocolPort.verifyRam(context.session, context.data, context.options);
    return toCommandResult(result, this.translate('messages.ram.verifyFailed'));
  }

  async resetCommandBuffer(session: BurnerProtocolSession): Promise<void> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      throw new Error(inactive.message);
    }

    const result = await this.protocolPort.resetCommandBuffer(session);
    if (!result.ok) {
      throw new Error(toFailureResult(result, 'Reset command buffer failed').message);
    }
  }

  async scanMultiCart(
    session: BurnerProtocolSession,
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      return [];
    }

    if (mode === 'GBA') {
      return this.readGBAMultiCartRoms(session, cfiInfo.deviceSize, cfiInfo);
    }

    return this.readMBC5MultiCartRoms(session, cfiInfo.deviceSize, cfiInfo, mbcType, enable5V);
  }

  private async readGBAMultiCartRoms(
    session: BurnerProtocolSession,
    deviceSize: number,
    cfi: CFIInfo,
  ): Promise<GameDetectionResult[]> {
    const results: GameDetectionResult[] = [];
    const bankCount = Math.floor(deviceSize / 0x400000);

    for (let i = 0; i < bankCount; i++) {
      const baseAddress = i * 0x400000;
      const headerResult = await this.protocolPort.readRom(
        session,
        0x150,
        { baseAddress, cfiInfo: cfi, mbcType: 'MBC5', enable5V: false },
        undefined,
        false,
      );

      if (headerResult.ok && headerResult.data.success && headerResult.data.data) {
        const romInfo = parseRom(headerResult.data.data);
        if (romInfo.isValid) {
          results.push({
            startAddress: baseAddress,
            desc: `Bank ${i.toString().padStart(2, '0')}`,
            romInfo,
          });
        }
      }
    }

    return results;
  }

  private async readMBC5MultiCartRoms(
    session: BurnerProtocolSession,
    deviceSize: number,
    cfi: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]> {
    const results: GameDetectionResult[] = [];
    const multiCardRanges = [{ from: 0x000000, name: 'Menu/GM' }, { from: 0x100000, name: 'Game 01' }];
    for (let i = 1; i < 16; ++i) {
      multiCardRanges.push({ from: 0x200000 * i, name: `Game ${(i + 1).toString().padStart(2, '0')}` });
    }

    for (const range of multiCardRanges) {
      if (range.from >= deviceSize) break;

      const fullHeaderResult = await this.protocolPort.readRom(
        session,
        0x150,
        {
          baseAddress: range.from,
          cfiInfo: cfi,
          mbcType,
          enable5V,
        },
        undefined,
        false,
      );

      if (fullHeaderResult.ok && fullHeaderResult.data.success && fullHeaderResult.data.data) {
        const romInfo = parseRom(fullHeaderResult.data.data);
        if (romInfo.isValid) {
          results.push({
            startAddress: range.from,
            desc: range.name,
            romInfo,
          });
        }
      }
    }

    return results;
  }
}

export interface BurnerFacade {
  readCart(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerReadCartResult>;
  eraseChip(
    session: BurnerProtocolSession,
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
    signal?: AbortSignal,
  ): Promise<CommandResult>;
  writeRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
  ): Promise<CommandResult>;
  readRom(
    session: BurnerProtocolSession,
    size: number,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<CommandResult>;
  verifyRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal: AbortSignal,
  ): Promise<CommandResult>;
  writeRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  readRam(
    session: BurnerProtocolSession,
    size: number,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  verifyRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  resetCommandBuffer(session: BurnerProtocolSession): Promise<void>;
  scanMultiCart(
    session: BurnerProtocolSession,
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]>;
}

export class BurnerFacadeImpl implements BurnerFacade {
  constructor(private readonly useCase: BurnerUseCase) {}

  readCart(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerReadCartResult> {
    return this.useCase.readCart(session, enable5V);
  }

  eraseChip(
    session: BurnerProtocolSession,
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.eraseChip({
      session,
      cfiInfo,
      signal,
      options: {
        cfiInfo,
        mbcType,
        enable5V,
      },
    });
  }

  writeRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.writeRom({
      session,
      cfiInfo: options.cfiInfo,
      options,
      data,
      signal,
    });
  }

  readRom(
    session: BurnerProtocolSession,
    size: number,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<CommandResult> {
    return this.useCase.readRom({
      session,
      cfiInfo: options.cfiInfo,
      options,
      size,
      signal,
      showProgress,
    });
  }

  verifyRom(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.verifyRom({
      session,
      cfiInfo: options.cfiInfo,
      options,
      data,
      signal,
    });
  }

  writeRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.writeRam({
      session,
      cfiInfo: options.cfiInfo,
      options,
      data,
    });
  }

  readRam(
    session: BurnerProtocolSession,
    size: number,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.readRam({
      session,
      cfiInfo: options.cfiInfo,
      options,
      size,
    });
  }

  verifyRam(
    session: BurnerProtocolSession,
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.verifyRam({
      session,
      cfiInfo: options.cfiInfo,
      options,
      data,
    });
  }

  resetCommandBuffer(session: BurnerProtocolSession): Promise<void> {
    return this.useCase.resetCommandBuffer(session);
  }

  scanMultiCart(
    session: BurnerProtocolSession,
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]> {
    return this.useCase.scanMultiCart(session, mode, cfiInfo, mbcType, enable5V);
  }
}
