import type { MbcType } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';
import { calcSectorUsage } from '@/utils/sector-utils';

import type { BurnerOperationContext, BurnerReadCartResult } from './types';

export interface GameDetectionResult {
  startAddress: number;
  desc: string;
  romInfo: RomInfo;
}

export interface BurnerUseCase {
  readCart(adapter: BurnerOperationContext['adapter'], enable5V: boolean): Promise<BurnerReadCartResult>;
  eraseChip(context: BurnerOperationContext): Promise<CommandResult>;
  writeRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  readRom(context: BurnerOperationContext & { size: number; showProgress?: boolean }): Promise<CommandResult>;
  verifyRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  writeRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  readRam(context: BurnerOperationContext & { size: number }): Promise<CommandResult>;
  verifyRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult>;
  resetCommandBuffer(adapter: BurnerOperationContext['adapter']): Promise<void>;
  scanMultiCart(
    adapter: BurnerOperationContext['adapter'],
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]>;
}

export class BurnerUseCaseImpl implements BurnerUseCase {
  constructor(
    private readonly translate: (key: string) => string,
    private readonly formatHex: (value: number, length?: number) => string,
  ) {}

  async readCart(adapter: BurnerOperationContext['adapter'], enable5V: boolean): Promise<BurnerReadCartResult> {
    try {
      const info = await adapter.getCartInfo(enable5V);
      if (!info) {
        return {
          success: false,
          message: this.translate('messages.operation.readCartFailed'),
        };
      }

      return {
        success: true,
        message: this.translate('messages.operation.readCartSuccess'),
        cfiInfo: info,
        chipId: info.flashId ? Array.from(info.flashId) : undefined,
        romSizeHex: this.formatHex(info.deviceSize, 4),
      };
    } catch (error) {
      return {
        success: false,
        message: `${this.translate('messages.operation.readCartFailed')}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async eraseChip(context: BurnerOperationContext): Promise<CommandResult> {
    const { adapter, cfiInfo, options, signal } = context;
    const sectorInfo = calcSectorUsage(cfiInfo.eraseSectorBlocks, cfiInfo.deviceSize, 0x00);
    return adapter.eraseSectors(sectorInfo, options, signal);
  }

  writeRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return context.adapter.writeROM(context.data, context.options, context.signal);
  }

  readRom(context: BurnerOperationContext & { size: number; showProgress?: boolean }): Promise<CommandResult> {
    return context.adapter.readROM(context.size, context.options, context.signal, context.showProgress ?? true);
  }

  verifyRom(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    if (!context.signal) {
      throw new Error('verifyRom requires abort signal');
    }
    return context.adapter.verifyROM(context.data, context.options, context.signal);
  }

  writeRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return context.adapter.writeRAM(context.data, context.options);
  }

  readRam(context: BurnerOperationContext & { size: number }): Promise<CommandResult> {
    return context.adapter.readRAM(context.size, context.options);
  }

  verifyRam(context: BurnerOperationContext & { data: Uint8Array }): Promise<CommandResult> {
    return context.adapter.verifyRAM(context.data, context.options);
  }

  resetCommandBuffer(adapter: BurnerOperationContext['adapter']): Promise<void> {
    return adapter.resetCommandBuffer();
  }

  async scanMultiCart(
    adapter: BurnerOperationContext['adapter'],
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]> {
    if (mode === 'GBA') {
      return this.readGBAMultiCartRoms(adapter, cfiInfo.deviceSize, cfiInfo);
    }

    return this.readMBC5MultiCartRoms(adapter, cfiInfo.deviceSize, cfiInfo, mbcType, enable5V);
  }

  private async readGBAMultiCartRoms(
    adapter: BurnerOperationContext['adapter'],
    deviceSize: number,
    cfi: CFIInfo,
  ): Promise<GameDetectionResult[]> {
    const results: GameDetectionResult[] = [];
    const bankCount = Math.floor(deviceSize / 0x400000);

    for (let i = 0; i < bankCount; i++) {
      const baseAddress = i * 0x400000;
      const headerResult = await adapter.readROM(0x150, { baseAddress, cfiInfo: cfi }, undefined, false);

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
    adapter: BurnerOperationContext['adapter'],
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

      const fullHeaderResult = await adapter.readROM(0x150, {
        baseAddress: range.from,
        cfiInfo: cfi,
        mbcType,
        enable5V,
      }, undefined, false);

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

export interface BurnerFacade {
  readCart(adapter: BurnerOperationContext['adapter'], enable5V: boolean): Promise<BurnerReadCartResult>;
  eraseChip(
    adapter: BurnerOperationContext['adapter'],
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
    signal?: AbortSignal,
  ): Promise<CommandResult>;
  writeRom(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
  ): Promise<CommandResult>;
  readRom(
    adapter: BurnerOperationContext['adapter'],
    size: number,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<CommandResult>;
  verifyRom(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal: AbortSignal,
  ): Promise<CommandResult>;
  writeRam(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  readRam(
    adapter: BurnerOperationContext['adapter'],
    size: number,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  verifyRam(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult>;
  resetCommandBuffer(adapter: BurnerOperationContext['adapter']): Promise<void>;
  scanMultiCart(
    adapter: BurnerOperationContext['adapter'],
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]>;
}

export class BurnerFacadeImpl implements BurnerFacade {
  constructor(private readonly useCase: BurnerUseCase) {}

  readCart(adapter: BurnerOperationContext['adapter'], enable5V: boolean): Promise<BurnerReadCartResult> {
    return this.useCase.readCart(adapter, enable5V);
  }

  eraseChip(
    adapter: BurnerOperationContext['adapter'],
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.eraseChip({
      adapter,
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
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.writeRom({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      data,
      signal,
    });
  }

  readRom(
    adapter: BurnerOperationContext['adapter'],
    size: number,
    options: BurnerOperationContext['options'],
    signal?: AbortSignal,
    showProgress?: boolean,
  ): Promise<CommandResult> {
    return this.useCase.readRom({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      size,
      signal,
      showProgress,
    });
  }

  verifyRom(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
    signal: AbortSignal,
  ): Promise<CommandResult> {
    return this.useCase.verifyRom({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      data,
      signal,
    });
  }

  writeRam(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.writeRam({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      data,
    });
  }

  readRam(
    adapter: BurnerOperationContext['adapter'],
    size: number,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.readRam({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      size,
    });
  }

  verifyRam(
    adapter: BurnerOperationContext['adapter'],
    data: Uint8Array,
    options: BurnerOperationContext['options'],
  ): Promise<CommandResult> {
    return this.useCase.verifyRam({
      adapter,
      cfiInfo: options.cfiInfo,
      options,
      data,
    });
  }

  resetCommandBuffer(adapter: BurnerOperationContext['adapter']): Promise<void> {
    return this.useCase.resetCommandBuffer(adapter);
  }

  scanMultiCart(
    adapter: BurnerOperationContext['adapter'],
    mode: 'GBA' | 'MBC5',
    cfiInfo: CFIInfo,
    mbcType: MbcType,
    enable5V: boolean,
  ): Promise<GameDetectionResult[]> {
    return this.useCase.scanMultiCart(adapter, mode, cfiInfo, mbcType, enable5V);
  }
}
