import type { CommandOptions, MbcType } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';
import { calcSectorUsage } from '@/utils/sector-utils';

import { mapDomainError } from './domain/error-mapping';
import type { BurnerProtocolSession } from './domain/ports';
import type { BurnerErrorStage } from './domain/result';

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

export class BurnerUseCaseImpl implements BurnerUseCase {
  constructor(
    private readonly translate: (key: string) => string,
    private readonly formatHex: (value: number, length?: number) => string,
  ) {}

  private ensureSessionActive(session: BurnerProtocolSession): CommandResult | null {
    if (session.isActive && !session.isActive()) {
      return {
        success: false,
        message: 'Device not connected',
        errorCode: 'not_connected',
        errorStage: 'session',
      };
    }

    return null;
  }

  private async executeSessionCommand(
    session: BurnerProtocolSession,
    stage: BurnerErrorStage,
    fallbackMessage: string,
    operation: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      return inactive;
    }

    try {
      return await operation();
    } catch (error) {
      const mapped = mapDomainError(stage, error, fallbackMessage);
      return {
        success: false,
        message: mapped.message,
        errorCode: mapped.code,
        errorStage: mapped.stage,
      };
    }
  }

  async readCart(session: BurnerProtocolSession, enable5V: boolean): Promise<BurnerReadCartResult> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      return inactive;
    }

    try {
      const cfiInfo = await session.getCartInfo(enable5V);
      if (!cfiInfo) {
        const cause = session.getLastCartInfoError?.();
        const message = cause
          ? `${this.translate('messages.operation.readCartFailed')}: ${cause}`
          : this.translate('messages.operation.readCartFailed');
        const mapped = cause
          ? mapDomainError('protocol', new Error(cause), cause)
          : { code: 'runtime_error', stage: 'protocol' };
        return {
          success: false,
          message,
          errorCode: mapped.code,
          errorStage: mapped.stage,
        };
      }

      return {
        success: true,
        message: this.translate('messages.operation.readCartSuccess'),
        cfiInfo,
        chipId: cfiInfo.flashId ? Array.from(cfiInfo.flashId) : undefined,
        romSizeHex: this.formatHex(cfiInfo.deviceSize, 4),
      };
    } catch (error) {
      const mapped = mapDomainError('protocol', error, this.translate('messages.operation.readCartFailed'));
      return {
        success: false,
        message: `${this.translate('messages.operation.readCartFailed')}: ${mapped.message}`,
        errorCode: mapped.code,
        errorStage: mapped.stage,
      };
    }
  }

  async eraseChip(context: BurnerOperationContext): Promise<CommandResult> {
    const { session, cfiInfo, options, signal } = context;
    const sectorInfo = calcSectorUsage(cfiInfo.eraseSectorBlocks, cfiInfo.deviceSize, 0x00);
    return this.executeSessionCommand(
      session,
      'protocol',
      this.translate('messages.operation.eraseFailed'),
      () => session.eraseSectors(sectorInfo, options, signal),
    );
  }

  async writeRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return this.executeSessionCommand(
      context.session,
      'transport',
      this.translate('messages.rom.writeFailed'),
      () => context.session.writeROM(context.data, context.options, context.signal),
    );
  }

  async readRom(context: BurnerOperationContext & { size: number; showProgress?: boolean }): Promise<CommandResult> {
    return this.executeSessionCommand(
      context.session,
      'transport',
      this.translate('messages.rom.readFailed'),
      () => context.session.readROM(
        context.size,
        context.options,
        context.signal,
        context.showProgress ?? true,
      ),
    );
  }

  async verifyRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    if (!context.signal) {
      throw new Error('verifyRom requires abort signal');
    }

    return this.executeSessionCommand(
      context.session,
      'protocol',
      this.translate('messages.rom.verifyFailed'),
      () => context.session.verifyROM(context.data, context.options, context.signal!),
    );
  }

  async writeRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return this.executeSessionCommand(
      context.session,
      'transport',
      this.translate('messages.ram.writeFailed'),
      () => context.session.writeRAM(context.data, context.options),
    );
  }

  async readRam(context: BurnerOperationContext & { size: number }): Promise<CommandResult> {
    return this.executeSessionCommand(
      context.session,
      'transport',
      this.translate('messages.ram.readFailed'),
      () => context.session.readRAM(context.size, context.options),
    );
  }

  async verifyRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return this.executeSessionCommand(
      context.session,
      'protocol',
      this.translate('messages.ram.verifyFailed'),
      () => context.session.verifyRAM(context.data, context.options),
    );
  }

  async resetCommandBuffer(session: BurnerProtocolSession): Promise<void> {
    const inactive = this.ensureSessionActive(session);
    if (inactive) {
      throw new Error(inactive.message);
    }

    try {
      await session.resetCommandBuffer();
    } catch (error) {
      const mapped = mapDomainError('transport', error, 'Reset command buffer failed');
      throw new Error(mapped.message);
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
      const headerResult = await this.readRom({
        session,
        cfiInfo: cfi,
        size: 0x150,
        options: {
          baseAddress,
          cfiInfo: cfi,
          mbcType: 'MBC5',
          enable5V: false,
          skipChannelStabilize: i > 0,
        },
        showProgress: false,
      });

      if (headerResult.success && headerResult.data) {
        const romInfo = parseRom(headerResult.data);
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

    for (let index = 0; index < multiCardRanges.length; index++) {
      const range = multiCardRanges[index];
      if (range.from >= deviceSize) break;

      const fullHeaderResult = await this.readRom({
        session,
        cfiInfo: cfi,
        size: 0x150,
        options: {
          baseAddress: range.from,
          cfiInfo: cfi,
          mbcType,
          enable5V,
          skipChannelStabilize: index > 0,
        },
        showProgress: false,
      });

      if (fullHeaderResult.success && fullHeaderResult.data) {
        const romInfo = parseRom(fullHeaderResult.data);
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
