import { Wrapper } from 'gbats';
import { describe, expect, it, vi } from 'vitest';

import {
  attachSettledSaveListener,
  captureGbaSave,
  copyBytes,
  type GbaSaveCore,
  importGbaSave,
  inspectGbaSave,
  isGbaSaveSettled,
  type SaveCheckpoint,
  validateGbaSaveImport,
} from '@/components/emulator/gba-save-bridge';

function syntheticWrapper(signature: string): Wrapper {
  const rom = new Uint8Array(1024);
  rom[0xb2] = 0x96;
  for (let i = 0; i < signature.length; i += 1) rom[0xe4 + i] = signature.charCodeAt(i);
  return new Wrapper({ rom: rom.buffer, updateMethod: 'manual' });
}

function coreOf(wrapper: Wrapper): GbaSaveCore {
  return wrapper.emulator;
}

function memoryOf(core: GbaSaveCore) {
  if (!core.mmu.save) throw new Error('Expected save memory.');
  return core.mmu.save;
}

function sendEepromWrite(core: GbaSaveCore, addressBits: 6 | 14, bytes: Uint8Array) {
  const save = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { store16: (offset: number, value: number) => void; dma: { count: number } };
  save.dma.count = addressBits + 67;
  const bits = [1, 0, ...Array.from({ length: addressBits }, () => 0)];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((byte >> bit) & 1);
  }
  bits.push(0);
  for (const bit of bits) save.store16(0, bit);
}

function sendEepromRead(core: GbaSaveCore, addressBits: 6 | 14): number[] {
  const save = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { store16: (offset: number, value: number) => void; loadU16: (offset: number) => number; dma: { count: number; enable: boolean } };
  save.dma.count = addressBits + 3;
  const address = Array.from({ length: addressBits }, () => 0);
  for (const bit of [1, 1, ...address, 0]) save.store16(0, bit);
  save.dma.enable = true;
  return Array.from({ length: 68 }, () => save.loadU16(0));
}

describe('GBA save bridge', () => {
  it('copies exactly the visible range of sliced views and isolates mutations', () => {
    const source = new Uint8Array([9, 1, 2, 3, 8]);
    const copied = copyBytes(source.subarray(1, 4));
    source[2] = 99;
    expect(copied).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('recognizes only explicit gbats save signatures, not fallback SRAM', () => {
    const unknown = syntheticWrapper('NO_SAVE_TAG');
    expect(inspectGbaSave(coreOf(unknown))).toBeNull();
    const known = syntheticWrapper('SRAM_V123');
    expect(inspectGbaSave(coreOf(known))).toMatchObject({ kind: 'SRAM', capacity: 32768 });
    const absent = coreOf(known);
    absent.mmu.save = null;
    expect(inspectGbaSave(absent)).toBeNull();
    unknown.emulator.pause();
    known.emulator.pause();
  });

  it('accepts arbitrary non-empty raw lengths while keeping the native core window', () => {
    const cases = [
      ['SRAM_V123', 32768],
      ['FLASH512_V123', 65536],
      ['FLASH1M_V123', 131072],
      ['EEPROM_V123', 512],
      ['EEPROM_V123', 8192],
    ] as const;
    for (const [signature, capacity] of cases) {
      const wrapper = syntheticWrapper(signature);
      const core = coreOf(wrapper);
      const descriptor = inspectGbaSave(core);
      if (!descriptor) throw new Error(`Missing descriptor for ${signature}`);
      const source = new Uint8Array(capacity + 123).fill(0x5a);
      const imported = importGbaSave(core, source);
      source[0] = 0;
      expect(imported.data[0]).toBe(0x5a);
      const nativeWindow = descriptor.kind === 'EEPROM' ? 8192 : capacity;
      expect(imported.data).toHaveLength(Math.max(capacity + 123, nativeWindow));
      expect(new Uint8Array(memoryOf(core).buffer)[0]).toBe(0x5a);
      expect(memoryOf(core).buffer.byteLength).toBe(descriptor.capacity);
      if (signature !== 'EEPROM_V123') {
        const memory = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { writePending: boolean; store8: (offset: number, value: number) => void };
        if (descriptor.kind === 'SRAM') {
          memory.store8(0x123, 0x42);
        } else {
          memory.store8(0x5555, 0xaa);
          memory.store8(0x2aaa, 0x55);
          memory.store8(0x5555, 0xa0);
          memory.store8(0x123, 0x42);
        }
        memory.writePending = false;
        const captured = captureGbaSave(core, imported.descriptor.capacity);
        expect(captured.data).toHaveLength(capacity + 123);
        expect(captured.data[0x123]).toBe(0x42);
        expect(captured.data.slice(capacity)).toEqual(imported.data.slice(capacity));
      }
      expect(validateGbaSaveImport(descriptor, new Uint8Array(9))).toHaveLength(9);
      expect(() => validateGbaSaveImport(descriptor, new Uint8Array())).toThrow(/empty/);
      wrapper.emulator.pause();
    }
  });

  it('pads short input from the original core backing and preserves its normalized baseline', () => {
    const wrapper = syntheticWrapper('SRAM_V123');
    const core = coreOf(wrapper);
    memoryOf(core).buffer = new Uint8Array(32768).fill(0x7e).buffer;
    const imported = importGbaSave(core, new Uint8Array([0x11, 0x22, 0x33]));
    expect(imported.data).toHaveLength(32768);
    expect(imported.data.slice(0, 4)).toEqual(new Uint8Array([0x11, 0x22, 0x33, 0x7e]));
    expect(imported.baseline).toEqual(imported.data);
    const output = captureGbaSave(core);
    expect(output.data).toEqual(output.baseline);
    wrapper.emulator.pause();
  });

  it('uses EEPROM address width for the core window while preserving arbitrary file tails', () => {
    const wrapper = syntheticWrapper('EEPROM_V123');
    const core = coreOf(wrapper);
    expect(() => captureGbaSave(core)).toThrow(/unresolved/);
    const source = new Uint8Array(8192 + 17).fill(0x5a);
    const imported = importGbaSave(core, source);
    const save = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { addressBits: number; realSize: number };
    expect(imported.descriptor.capacity).toBe(8192);
    expect(captureGbaSave(core, 8192).data).toHaveLength(source.length);
    save.addressBits = 6;
    sendEepromWrite(core, 6, new Uint8Array([0xa5, ...new Array(7).fill(0x5a)]));
    memoryOf(core).writePending = false;
    save.realSize = 131072; // gbats reports this misleading value for the 8 KiB protocol.
    const shortWindow = captureGbaSave(core, imported.descriptor.capacity);
    expect(shortWindow.descriptor.capacity).toBe(512);
    expect(shortWindow.data).toHaveLength(source.length);
    expect(shortWindow.data[0]).toBe(0xa5);
    expect(shortWindow.data.slice(512)).toEqual(source.slice(512));
    save.addressBits = 14;
    const longWindow = captureGbaSave(core, imported.descriptor.capacity);
    expect(longWindow.descriptor.capacity).toBe(8192);
    expect(longWindow.data).toHaveLength(source.length);
    expect(longWindow.data.slice(8192)).toEqual(source.slice(8192));
    wrapper.emulator.pause();
  });

  it('keeps an unimported EEPROM export at its runtime window and retains any later expansion', () => {
    const wrapper = syntheticWrapper('EEPROM_V123');
    const core = coreOf(wrapper);
    const save = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { addressBits: number };
    expect(() => captureGbaSave(core)).toThrow(/unresolved/);
    save.addressBits = 6;
    new Uint8Array(save.buffer)[0] = 0x42;
    const small = captureGbaSave(core);
    expect(small.data).toHaveLength(512);
    expect(small.baseline).toHaveLength(512);
    expect(small.data[0]).toBe(0x42);
    expect(small.baseline?.[0]).toBe(0);
    save.addressBits = 14;
    expect(captureGbaSave(core).data).toHaveLength(8192);
    save.addressBits = 6;
    expect(captureGbaSave(core).data).toHaveLength(8192);
    wrapper.emulator.pause();
  });

  it('imports a 128 KiB SRAM raw file through a 32 KiB window and round-trips its nonuniform tail', () => {
    const wrapper = syntheticWrapper('SRAM_V123');
    const core = coreOf(wrapper);
    const source = new Uint8Array(131072);
    for (let index = 0; index < source.length; index += 1) source[index] = (index * 17 + 3) & 0xff;
    const originalTail = source.slice(32768);
    const imported = importGbaSave(core, source);
    expect(memoryOf(core).buffer.byteLength).toBe(32768);
    const sram = memoryOf(core) as NonNullable<GbaSaveCore['mmu']['save']> & { store8: (offset: number, value: number) => void; writePending: boolean };
    sram.store8(0x12, 0xa4);
    sram.writePending = false;
    const checkpoint = vi.fn<(value: SaveCheckpoint) => void>();
    const dispose = attachSettledSaveListener(core, () => true, () => imported.descriptor.capacity, checkpoint, vi.fn<(error: Error) => void>());
    core.storeSavedata();
    expect(checkpoint.mock.calls[0][0].data).toHaveLength(131072);
    const output = captureGbaSave(core, imported.descriptor.capacity);
    expect(output.descriptor.capacity).toBe(32768);
    expect(output.data).toHaveLength(131072);
    expect(output.data[0x12]).toBe(0xa4);
    expect(output.data.slice(32768)).toEqual(originalTail);

    dispose();
    wrapper.resetEmulator('manual');
    const resetCore = coreOf(wrapper);
    const reloaded = importGbaSave(resetCore, output.data);
    expect(reloaded.data).toEqual(output.data);
    expect(new Uint8Array(memoryOf(resetCore).buffer)).toEqual(output.data.slice(0, 32768));
    wrapper.emulator.pause();
  });

  it('allows stable Flash ID mode snapshots because ID reads do not alter saved bytes', () => {
    const wrapper = syntheticWrapper('FLASH512_V123');
    const core = coreOf(wrapper);
    importGbaSave(core, new Uint8Array(65536).fill(0x5a));
    const save = core.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { store8: (offset: number, value: number) => void; idMode?: boolean };
    save.store8(0x5555, 0xaa);
    save.store8(0x2aaa, 0x55);
    save.store8(0x5555, 0x90);
    expect(save.idMode).toBe(true);
    expect(isGbaSaveSettled(core)).toBe(true);
    expect(captureGbaSave(core, 65536).data[0]).toBe(0x5a);
    wrapper.emulator.pause();
  });

  it('notifies from the synchronous settled hook before seenSave is cleared and restores once', () => {
    const wrapper = syntheticWrapper('SRAM_V123');
    const core = coreOf(wrapper);
    const callback = vi.fn();
    const errors = vi.fn();
    const originalStore = core.storeSavedata;
    const dispose = attachSettledSaveListener(core, () => true, () => 32768, callback, errors);
    core.seenSave = true;
    memoryOf(core).writePending = false;
    core.storeSavedata();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    expect(core.seenSave).toBe(true);
    dispose();
    dispose();
    expect(core.storeSavedata).toBe(originalStore);
    core.storeSavedata();
    expect(callback).toHaveBeenCalledTimes(1);
    wrapper.emulator.pause();
  });

  it('ignores callbacks from an old generation', () => {
    const wrapper = syntheticWrapper('SRAM_V123');
    const core = coreOf(wrapper);
    const callback = vi.fn();
    const errors = vi.fn();
    attachSettledSaveListener(core, () => false, () => undefined, callback, errors);
    core.storeSavedata();
    expect(callback).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    wrapper.emulator.pause();
  });

  it('probes SRAM, both Flash banks, EEPROM serial IO, reset loss, and reinjection in gbats', () => {
    const sram = syntheticWrapper('SRAM_V123');
    const sramCore = coreOf(sram);
    importGbaSave(sramCore, new Uint8Array(32768).fill(0x11));
    (sramCore.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { store8: (offset: number, value: number) => void }).store8(0, 0x42);
    expect(new Uint8Array(memoryOf(sramCore).buffer)[0]).toBe(0x42);
    memoryOf(sramCore).writePending = false;
    const saved = captureGbaSave(sramCore, 32768).data;
    sram.resetEmulator('manual');
    expect(new Uint8Array(memoryOf(coreOf(sram)).buffer)[0]).toBe(0);
    importGbaSave(coreOf(sram), saved);
    expect(new Uint8Array(memoryOf(coreOf(sram)).buffer)[0]).toBe(0x42);

    for (const [signature, capacity] of [['FLASH512_V123', 65536], ['FLASH1M_V123', 131072]] as const) {
      const flash = syntheticWrapper(signature);
      const flashCore = coreOf(flash);
      importGbaSave(flashCore, new Uint8Array(capacity).fill(0xff));
      const save = flashCore.mmu.save as NonNullable<GbaSaveCore['mmu']['save']> & { store8: (offset: number, value: number) => void };
      const unlock = () => { save.store8(0x5555, 0xaa); save.store8(0x2aaa, 0x55); };
      unlock(); save.store8(0x5555, 0xa0); save.store8(0x123, 0x42);
      expect(new Uint8Array(save.buffer)[0x123]).toBe(0x42);
      if (capacity === 131072) {
        unlock(); save.store8(0x5555, 0xb0); save.store8(0, 1);
        unlock(); save.store8(0x5555, 0xa0); save.store8(0x123, 0x24);
        expect(new Uint8Array(save.buffer)[0x10123]).toBe(0x24);
      }
      flash.emulator.pause();
    }

    for (const addressBits of [6, 14] as const) {
      const eeprom = syntheticWrapper('EEPROM_V123');
      const eepromCore = coreOf(eeprom);
      const capacity = addressBits === 6 ? 512 : 8192;
      importGbaSave(eepromCore, new Uint8Array(capacity));
      sendEepromWrite(eepromCore, addressBits, new Uint8Array([0xa5, 0x5a, ...new Array(6).fill(0x33)]));
      memoryOf(eepromCore).writePending = false;
      const readback = sendEepromRead(eepromCore, addressBits);
      const bits = readback.slice(4, 68);
      const firstByte = bits.slice(0, 8).reduce((value, bit) => (value << 1) | bit, 0);
      expect(firstByte).toBe(0xa5);
      const output = captureGbaSave(eepromCore, capacity);
      expect(output.data).toHaveLength(capacity);
      expect(output.data[0]).toBe(0xa5);
      eeprom.emulator.pause();
    }

    sram.emulator.pause();
  });
});
