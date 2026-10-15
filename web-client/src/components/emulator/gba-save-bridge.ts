export type GbaSaveKind = 'SRAM' | 'FLASH512' | 'FLASH1M' | 'EEPROM';

export interface GbaSaveDescriptor {
  kind: GbaSaveKind;
  capacity: 32768 | 65536 | 131072 | 512 | 8192;
  detectedType: string;
}

interface SaveMemory {
  buffer: ArrayBuffer;
  writePending?: boolean;
  realSize?: number;
  addressBits?: number;
  command?: number;
  commandBitsRemaining?: number;
  pendingCommand?: number;
  first?: number;
  second?: number;
  idMode?: boolean;
}

export interface GbaSaveCore {
  pause: () => void;
  runStable: () => void;
  rom: { saveType?: unknown } | null;
  mmu: {
    cart?: { saveType?: unknown };
    save: SaveMemory | null;
  };
  seenSave?: boolean;
  storeSavedata: () => void;
  setSavedata: (buffer: ArrayBuffer) => void;
}

export interface SaveCheckpoint {
  descriptor: GbaSaveDescriptor;
  data: Uint8Array;
  baseline?: Uint8Array;
}

interface SaveImageState {
  /** Full raw output, including bytes outside the core's addressable window. */
  data: Uint8Array;
  /** Original imported raw bytes, or the core's initial backing for a blank save. */
  baseline: Uint8Array;
  /** Bytes in the native backing before importing or gameplay. */
  initialBacking: Uint8Array;
}

const saveImages = new WeakMap<GbaSaveCore, SaveImageState>();

export function copyBytes(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source.slice(0));
  }
  return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
}

function getDetectedType(core: GbaSaveCore): string {
  const detected = core.mmu.cart?.saveType ?? core.rom?.saveType;
  return typeof detected === 'string' ? detected : '';
}

export function inspectGbaSave(core: GbaSaveCore): GbaSaveDescriptor | null {
  const detectedType = getDetectedType(core);
  const save = core.mmu.save;
  if (!detectedType || !save) return null;

  if (detectedType === 'SRAM_V' && save.buffer.byteLength === 32768) {
    return { kind: 'SRAM', capacity: 32768, detectedType };
  }
  if ((detectedType === 'FLASH_V' || detectedType === 'FLASH512_V') && save.buffer.byteLength === 65536) {
    return { kind: 'FLASH512', capacity: 65536, detectedType };
  }
  if (detectedType === 'FLASH1M_V' && save.buffer.byteLength === 131072) {
    return { kind: 'FLASH1M', capacity: 131072, detectedType };
  }
  if (detectedType === 'EEPROM_V' && save.buffer.byteLength >= 8192) {
    return { kind: 'EEPROM', capacity: 8192, detectedType };
  }
  return null;
}

export function validateGbaSaveImport(_descriptor: GbaSaveDescriptor, source: ArrayBuffer | ArrayBufferView): Uint8Array {
  const data = copyBytes(source);
  if (data.byteLength === 0) throw new Error('The RAM file is empty. Select a non-empty RAM file.');
  return data;
}

function copySaveImage(source: Uint8Array, initialBacking: Uint8Array, windowCapacity: number): Uint8Array {
  const length = Math.max(source.byteLength, windowCapacity);
  const output = new Uint8Array(length);
  output.set(initialBacking.subarray(0, Math.min(initialBacking.byteLength, length)));
  output.set(source);
  return output;
}

function saveImageState(core: GbaSaveCore): SaveImageState {
  let state = saveImages.get(core);
  if (!state) {
    const save = core.mmu.save;
    if (!save) throw new Error('The ROM RAM is unavailable.');
    const initialBacking = new Uint8Array(save.buffer.slice(0));
    // With no selected file, the exported raw length is established by the
    // effective core window. The native allocation alone must not make a
    // 512-byte EEPROM export look like an 8 KiB file.
    state = { data: new Uint8Array(0), baseline: new Uint8Array(0), initialBacking };
    saveImages.set(core, state);
  }
  return state;
}

function eepromImportHint(sourceLength: number): 512 | 8192 {
  return sourceLength === 512 ? 512 : 8192;
}

export function importGbaSave(core: GbaSaveCore, source: ArrayBuffer | ArrayBufferView): SaveCheckpoint {
  const descriptor = inspectGbaSave(core);
  if (!descriptor) {
    throw new Error('The ROM RAM type is unknown or its RAM is unavailable.');
  }
  const data = validateGbaSaveImport(descriptor, source);
  const save = core.mmu.save;
  if (!save) throw new Error('The ROM RAM is unavailable.');
  const state = saveImageState(core);
  const windowCapacity = descriptor.kind === 'EEPROM' ? eepromImportHint(data.byteLength) : descriptor.capacity;
  const normalized = copySaveImage(data, state.initialBacking, windowCapacity);
  const nativeBacking = new Uint8Array(state.initialBacking);
  nativeBacking.set(data.subarray(0, nativeBacking.byteLength));
  core.setSavedata(nativeBacking.buffer);
  state.data = copyBytes(normalized);
  state.baseline = copyBytes(normalized);
  return {
    descriptor: descriptor.kind === 'EEPROM'
      ? { ...descriptor, capacity: windowCapacity }
      : descriptor,
    data: copyBytes(normalized),
    baseline: copyBytes(normalized),
  };
}

function protocolIsIdle(save: SaveMemory, kind: GbaSaveKind): boolean {
  if (save.writePending) return false;
  if (kind === 'EEPROM') {
    return save.command === 0 && (save.commandBitsRemaining ?? 0) === 0;
  }
  if (kind === 'FLASH512' || kind === 'FLASH1M') {
    return save.command === 0 && (save.pendingCommand ?? 0) === 0
      && (save.first ?? 0) === 0 && (save.second ?? 0) === 0;
  }
  return true;
}

export function isGbaSaveSettled(core: GbaSaveCore): boolean {
  const save = core.mmu.save;
  if (core.seenSave || save?.writePending) return false;
  if (!save) return true;
  const descriptor = inspectGbaSave(core);
  if (!descriptor) {
    return (save.command ?? 0) === 0 && (save.commandBitsRemaining ?? 0) === 0
      && (save.pendingCommand ?? 0) === 0 && (save.first ?? 0) === 0
      && (save.second ?? 0) === 0;
  }
  return protocolIsIdle(save, descriptor.kind);
}

export function captureGbaSave(core: GbaSaveCore, importedCapacity?: number, allowSeenSave = false): SaveCheckpoint {
  const descriptor = inspectGbaSave(core);
  const save = core.mmu.save;
  if (!descriptor || !save) throw new Error('The ROM RAM type is unknown or its RAM is unavailable.');
  // Snapshot the blank backing before unresolved EEPROM width or pending-save
  // checks can throw. The first later checkpoint must not become its baseline.
  const state = saveImageState(core);
  if (core.seenSave && !allowSeenSave) throw new Error('A RAM write burst has not settled yet.');
  if (!protocolIsIdle(save, descriptor.kind)) throw new Error('A RAM protocol command is still pending.');

  let effectiveCapacity: number = descriptor.capacity;
  if (descriptor.kind === 'EEPROM') {
    const width = save.addressBits;
    const runtimeCapacity = width === 6 ? 512 : width === 14 ? 8192 : undefined;
    effectiveCapacity = runtimeCapacity ?? importedCapacity ?? 0;
    if (!effectiveCapacity) throw new Error('EEPROM capacity is unresolved; RAM export is unavailable.');
  }
  if (effectiveCapacity > save.buffer.byteLength) throw new Error('The RAM window exceeds available RAM.');

  const outputLength = Math.max(state.data.byteLength, effectiveCapacity);
  const output = new Uint8Array(outputLength);
  output.set(state.data);
  if (outputLength > state.data.byteLength) {
    output.set(state.initialBacking.subarray(state.data.byteLength, outputLength), state.data.byteLength);
  }
  output.set(new Uint8Array(save.buffer, 0, effectiveCapacity));

  const baselineLength = Math.max(state.baseline.byteLength, effectiveCapacity);
  const baseline = new Uint8Array(baselineLength);
  baseline.set(state.baseline);
  if (baselineLength > state.baseline.byteLength) {
    baseline.set(state.initialBacking.subarray(state.baseline.byteLength, baselineLength), state.baseline.byteLength);
  }
  state.data = copyBytes(output);
  state.baseline = copyBytes(baseline);

  return {
    descriptor: { ...descriptor, capacity: effectiveCapacity as GbaSaveDescriptor['capacity'] },
    data: output,
    baseline,
  };
}

export function attachSettledSaveListener(
  core: GbaSaveCore,
  generationIsCurrent: () => boolean,
  importedCapacity: () => number | undefined,
  onCheckpoint: (checkpoint: SaveCheckpoint) => void,
  onError: (error: Error) => void,
): () => void {
  saveImageState(core);
  const original = core.storeSavedata;
  let disposed = false;
  const wrapped = function (this: GbaSaveCore) {
    original.call(this);
    if (disposed || !generationIsCurrent()) return;
    try {
      // gbats calls this from advanceFrame while seenSave is still true, then
      // clears seenSave after the callback. writePending and protocol state
      // are the usable settled indicators at this synchronous hook boundary.
      onCheckpoint(captureGbaSave(core, importedCapacity(), true));
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  };
  core.storeSavedata = wrapped;

  return () => {
    if (disposed) return;
    disposed = true;
    if (core.storeSavedata === wrapped) core.storeSavedata = original;
  };
}
