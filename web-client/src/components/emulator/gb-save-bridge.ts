import { copyBytes } from '@/components/emulator/gba-save-bridge';

export interface GbSaveDescriptor {
  capacity: number;
}

export interface GbSaveCore {
  getExtRamSize: () => number;
  readExtRam: () => Uint8Array;
  writeExtRam: (data: Uint8Array) => void;
}

export interface GbSaveCheckpoint {
  descriptor: GbSaveDescriptor;
  data: Uint8Array;
  baseline?: Uint8Array;
}

interface GbSaveImageState {
  /** Full raw output, including bytes outside the core's addressable window. */
  data: Uint8Array;
  /** Original imported raw bytes, or the core's initial backing for a blank save. */
  baseline: Uint8Array;
  /** Bytes in the native backing before importing or gameplay. */
  initialBacking: Uint8Array;
}

const saveImages = new WeakMap<GbSaveCore, GbSaveImageState>();

export function inspectGbSave(core: GbSaveCore): GbSaveDescriptor | null {
  const capacity = core.getExtRamSize();
  if (capacity <= 0) return null;
  return { capacity };
}

export function validateGbSaveImport(_descriptor: GbSaveDescriptor, source: ArrayBuffer | ArrayBufferView): Uint8Array {
  const data = copyBytes(source);
  if (data.byteLength === 0) {
    throw new Error('The RAM file is empty. Select a non-empty RAM file.');
  }
  return data;
}

function copySaveImage(source: Uint8Array, initialBacking: Uint8Array, windowCapacity: number): Uint8Array {
  const length = Math.max(source.byteLength, windowCapacity);
  const output = new Uint8Array(length);
  output.set(initialBacking.subarray(0, Math.min(initialBacking.byteLength, length)));
  output.set(source);
  return output;
}

function saveImageState(core: GbSaveCore): GbSaveImageState {
  let state = saveImages.get(core);
  if (!state) {
    const capacity = core.getExtRamSize();
    if (capacity <= 0) throw new Error('The ROM RAM is unavailable.');
    const initialBacking = copyBytes(core.readExtRam());
    state = { data: new Uint8Array(0), baseline: new Uint8Array(0), initialBacking };
    saveImages.set(core, state);
  }
  return state;
}

export function importGbSave(core: GbSaveCore, source: ArrayBuffer | ArrayBufferView): GbSaveCheckpoint {
  const descriptor = inspectGbSave(core);
  if (!descriptor) {
    throw new Error('The ROM RAM type is unknown or its RAM is unavailable.');
  }
  const data = validateGbSaveImport(descriptor, source);
  const state = saveImageState(core);
  const normalized = copySaveImage(data, state.initialBacking, descriptor.capacity);
  const nativeBacking = new Uint8Array(state.initialBacking);
  nativeBacking.set(data.subarray(0, nativeBacking.byteLength));
  core.writeExtRam(nativeBacking);
  state.data = copyBytes(normalized);
  state.baseline = copyBytes(normalized);
  return {
    descriptor,
    data: copyBytes(normalized),
    baseline: copyBytes(normalized),
  };
}

export function captureGbSave(core: GbSaveCore): GbSaveCheckpoint {
  const descriptor = inspectGbSave(core);
  if (!descriptor) {
    throw new Error('The ROM RAM type is unknown or its RAM is unavailable.');
  }
  const state = saveImageState(core);
  const coreBytes = core.readExtRam();
  const effectiveCapacity = descriptor.capacity;
  if (effectiveCapacity > coreBytes.byteLength) {
    throw new Error('The RAM window exceeds available RAM.');
  }

  const outputLength = Math.max(state.data.byteLength, effectiveCapacity);
  const output = new Uint8Array(outputLength);
  output.set(state.data);
  if (outputLength > state.data.byteLength) {
    output.set(state.initialBacking.subarray(state.data.byteLength, outputLength), state.data.byteLength);
  }
  output.set(coreBytes.subarray(0, effectiveCapacity));

  const baselineLength = Math.max(state.baseline.byteLength, effectiveCapacity);
  const baseline = new Uint8Array(baselineLength);
  baseline.set(state.baseline);
  if (baselineLength > state.baseline.byteLength) {
    baseline.set(state.initialBacking.subarray(state.baseline.byteLength, baselineLength), state.baseline.byteLength);
  }

  state.data = copyBytes(output);
  state.baseline = copyBytes(baseline);

  return {
    descriptor,
    data: output,
    baseline,
  };
}
