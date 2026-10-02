import type { CommandOptions, MbcType, RamType } from '@/types/command-options';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

export interface BurnerCommandSelection {
  cfiInfo: CFIInfo;
  baseAddress?: string;
  size?: string;
  mbcType: MbcType;
  enable5V: boolean;
  ramType?: RamType;
}

export interface PreparedBurnerCommand {
  options: CommandOptions;
  size: number;
  data: Uint8Array;
}

/** CFI contains mutable byte buffers, tuples and sector records, including Vue proxies. */
export function snapshotCfi(cfi: CFIInfo): CFIInfo {
  return {
    ...cfi,
    flashId: new Uint8Array(cfi.flashId),
    dataSwap: cfi.dataSwap?.map(([from, to]) => [from, to]) ?? null,
    magicValues: cfi.magicValues ? { ...cfi.magicValues } : undefined,
    eraseSectorBlocks: cfi.eraseSectorBlocks.map(block => ({ ...block })),
  };
}

export function prepareCommand(
  selection: BurnerCommandSelection,
  data?: Uint8Array | null,
  preparation?: 'pad-rom' | 'read-rom' | 'read-ram' | number,
): PreparedBurnerCommand {
  const size = preparation === 'read-ram' && data ? data.length : parseInt(selection.size ?? '0', 16);
  const options: CommandOptions = {
    cfiInfo: snapshotCfi(selection.cfiInfo),
    mbcType: selection.mbcType,
    enable5V: selection.enable5V,
    ...(selection.baseAddress !== undefined ? { baseAddress: parseInt(selection.baseAddress, 16) } : {}),
    ...(selection.size !== undefined && preparation !== 'read-ram' && preparation !== 'read-rom' ? { size } : {}),
    ...(selection.ramType !== undefined ? { ramType: selection.ramType } : {}),
  };
  let preparedData: Uint8Array;
  if (typeof preparation === 'number') {
    preparedData = new Uint8Array(size).fill(preparation);
  } else if (preparation === 'pad-rom' && data && data.length < size) {
    preparedData = new Uint8Array(size).fill(0xff);
    preparedData.set(data);
  } else {
    // Imported files are replaced as a whole. Capture their buffer identity at admission;
    // only padding and blank verification need a fresh full-size allocation.
    preparedData = data ?? new Uint8Array();
  }
  return { options, size, data: preparedData };
}
