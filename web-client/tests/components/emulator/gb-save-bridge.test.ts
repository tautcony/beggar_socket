import { describe, expect, it } from 'vitest';

import { captureGbSave, type GbSaveCore, importGbSave, inspectGbSave } from '@/components/emulator/gb-save-bridge';

function createFakeGbCore(capacity: number, initialFill = 0xff): GbSaveCore & { ram: Uint8Array } {
  const ram = new Uint8Array(capacity).fill(initialFill);
  return {
    ram,
    getExtRamSize: () => capacity,
    readExtRam: () => new Uint8Array(ram),
    writeExtRam: (data: Uint8Array) => {
      ram.set(data.subarray(0, capacity));
    },
  };
}

describe('gb-save-bridge', () => {
  it('returns null descriptor when ROM has no external RAM', () => {
    const core = createFakeGbCore(0);
    expect(inspectGbSave(core)).toBeNull();
    expect(() => importGbSave(core, new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('rejects empty RAM files', () => {
    const core = createFakeGbCore(32768);
    expect(inspectGbSave(core)).toEqual({ capacity: 32768 });
    expect(() => importGbSave(core, new Uint8Array(0))).toThrow(/empty/i);
  });

  it('normalizes short raw saves from initial backing and preserves trailing bytes on oversized saves', () => {
    const core = createFakeGbCore(8192, 0xff);
    const shortInput = new Uint8Array([0x11, 0x22, 0x33]);
    const shortImported = importGbSave(core, shortInput);
    expect(shortImported.data.byteLength).toBe(8192);
    expect(Array.from(shortImported.data.subarray(0, 4))).toEqual([0x11, 0x22, 0x33, 0xff]);
    expect(Array.from(core.ram.subarray(0, 4))).toEqual([0x11, 0x22, 0x33, 0xff]);

    const oversizedCore = createFakeGbCore(8192, 0x00);
    const oversizedInput = new Uint8Array(10000);
    oversizedInput[0] = 0xaa;
    oversizedInput[8191] = 0xbb;
    oversizedInput[9999] = 0xcc;
    const imported = importGbSave(oversizedCore, oversizedInput);
    expect(imported.descriptor.capacity).toBe(8192);
    expect(imported.data.byteLength).toBe(10000);
    expect(oversizedCore.ram[0]).toBe(0xaa);
    expect(oversizedCore.ram[8191]).toBe(0xbb);

    // Simulate in-game write to core RAM
    oversizedCore.ram[0] = 0x55;
    const captured = captureGbSave(oversizedCore);
    expect(captured.data.byteLength).toBe(10000);
    expect(captured.data[0]).toBe(0x55);
    expect(captured.data[8191]).toBe(0xbb);
    expect(captured.data[9999]).toBe(0xcc);
    expect(captured.baseline?.[0]).toBe(0xaa);
  });
});
