import { describe, expect, it } from 'vitest';

import type { FileInfo, RomSlot } from '../src/types/rom-assembly';
import {
  canPlaceFile,
  checkConsecutiveSlots,
  createEmptySlots,
  getRequiredSlots,
  getRomAssemblyConfig,
} from '../src/utils/rom/rom-assembly-utils';

describe('rom-assembly-utils', () => {
  describe('getRomAssemblyConfig', () => {
    it('should return GBA configuration', () => {
      const config = getRomAssemblyConfig('GBA');

      expect(config).toEqual({
        totalSize: 0x08000000, // 128MB
        alignment: 0x400000, // 4MB对齐
        slotSize: 0x400000, // 4MB每个槽位
        maxSlots: 32,
        type: 'GBA',
      });
    });

    it('should return MBC5 configuration with variable slots', () => {
      const config = getRomAssemblyConfig('MBC5');

      expect(config.totalSize).toBe(0x02000000); // 32MB
      expect(config.alignment).toBe(0x200000); // 2MB对齐
      expect(config.slotSize).toBe(0x200000); // 2MB每个槽位
      expect(config.maxSlots).toBe(32);
      expect(config.type).toBe('MBC5');
      expect(config.variableSlots).toBe(true);
      expect(config.slotConfigs).toBeDefined();

      // Check first two slots are 1MB
      expect(config.slotConfigs?.[0]).toEqual({ size: 0x100000, alignment: 0x100000 });
      expect(config.slotConfigs?.[1]).toEqual({ size: 0x100000, alignment: 0x100000 });

      // Check subsequent slots are 2MB
      expect(config.slotConfigs?.[2]).toEqual({ size: 0x200000, alignment: 0x200000 });
    });
  });

  describe('createEmptySlots', () => {
    it('should create slots for GBA configuration', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      expect(slots).toHaveLength(32);

      // Check first slot
      expect(slots[0]).toEqual({
        id: 'slot-0',
        name: 'Slot 0',
        offset: 0,
        size: 0x400000,
        color: expect.any(String) as string,
      });

      // Check second slot
      expect(slots[1]).toEqual({
        id: 'slot-1',
        name: 'Slot 1',
        offset: 0x400000,
        size: 0x400000,
        color: expect.any(String) as string,
      });
    });

    it('should create variable slots for MBC5 configuration', () => {
      const config = getRomAssemblyConfig('MBC5');
      const slots = createEmptySlots(config);

      expect(slots.length).toBeGreaterThan(0);

      // Check first two slots are 1MB
      expect(slots[0].size).toBe(0x100000);
      expect(slots[1].size).toBe(0x100000);
      expect(slots[1].offset).toBe(0x100000);

      // Check subsequent slots are 2MB
      if (slots.length > 2) {
        expect(slots[2].size).toBe(0x200000);
        expect(slots[2].offset).toBe(0x200000);
      }
    });

    it('should generate unique colors for each slot', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      const colors = slots.map(slot => slot.color);
      const uniqueColors = new Set(colors);

      // Should have some color variation (at least not all the same)
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe('canPlaceFile', () => {
    const config = getRomAssemblyConfig('GBA');
    const slots = createEmptySlots(config);

    const smallFile: FileInfo = {
      name: 'test.rom',
      size: 0x200000, // 2MB
      data: new Uint8Array(0x200000),
    };

    const largeFile: FileInfo = {
      name: 'large.rom',
      size: 0x10000000, // 256MB (larger than total capacity)
      data: new Uint8Array(0x10000000),
    };

    it('should allow placing small file in empty slot', () => {
      const result = canPlaceFile(smallFile, slots[0], config, 0);
      expect(result).toBe(true);
    });

    it('should reject file larger than total capacity', () => {
      const result = canPlaceFile(largeFile, slots[0], config, 0);
      expect(result).toBe(false);
    });

    it('should reject placing file in occupied slot', () => {
      const occupiedSlot: RomSlot = {
        ...slots[0],
        file: smallFile,
      };

      const result = canPlaceFile(smallFile, occupiedSlot, config, 0);
      expect(result).toBe(false);
    });

    it('should check alignment requirements', () => {
      const misalignedSlot: RomSlot = {
        ...slots[0],
        offset: 0x100000, // Not aligned to 4MB for GBA
      };

      const result = canPlaceFile(smallFile, misalignedSlot, config, 0);
      expect(result).toBe(false);
    });
  });

  describe('getRequiredSlots', () => {
    it('should calculate required slots for GBA (fixed size)', () => {
      const config = getRomAssemblyConfig('GBA');

      // 2MB file in 4MB slots = 1 slot
      expect(getRequiredSlots(0x200000, config)).toBe(1);

      // 6MB file in 4MB slots = 2 slots
      expect(getRequiredSlots(0x600000, config)).toBe(2);

      // Exactly 4MB = 1 slot
      expect(getRequiredSlots(0x400000, config)).toBe(1);
    });

    it('should calculate required slots for MBC5 (variable size)', () => {
      const config = getRomAssemblyConfig('MBC5');

      // 0.5MB from start = 1 slot (first 1MB slot)
      expect(getRequiredSlots(0x80000, config, 0)).toBe(1);

      // 1.5MB from start = 2 slots (first 1MB + second 1MB)
      expect(getRequiredSlots(0x180000, config, 0)).toBe(2);

      // 3MB from start = 3 slots (1MB + 1MB + 2MB)
      expect(getRequiredSlots(0x300000, config, 0)).toBe(3);

      // Starting from slot 2 (2MB slots)
      expect(getRequiredSlots(0x200000, config, 2)).toBe(1);
      expect(getRequiredSlots(0x300000, config, 2)).toBe(2);
    });
  });

  describe('checkConsecutiveSlots', () => {
    it('should return true for available consecutive slots', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      expect(checkConsecutiveSlots(0, 3, slots)).toBe(true);
      expect(checkConsecutiveSlots(5, 2, slots)).toBe(true);
    });

    it('should return false when not enough slots available', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      expect(checkConsecutiveSlots(30, 5, slots)).toBe(false); // Would exceed array bounds
    });

    it('should return false when slots are occupied', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      // Occupy middle slot
      const file: FileInfo = {
        name: 'test.rom',
        size: 0x400000,
        data: new Uint8Array(0x400000),
      };
      slots[1].file = file;

      expect(checkConsecutiveSlots(0, 3, slots)).toBe(false); // Slot 1 is occupied
      expect(checkConsecutiveSlots(2, 2, slots)).toBe(true); // Slots 2-3 are free
    });

    it('should handle edge cases', () => {
      const config = getRomAssemblyConfig('GBA');
      const slots = createEmptySlots(config);

      expect(checkConsecutiveSlots(0, 0, slots)).toBe(true); // 0 slots needed
      expect(checkConsecutiveSlots(32, 1, slots)).toBe(false); // Start beyond array
    });
  });
});
