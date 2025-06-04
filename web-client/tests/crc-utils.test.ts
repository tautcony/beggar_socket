import { describe, expect, it } from 'vitest';
import { modbusCRC16, modbusCRC16_lut } from '../src/utils/crc-utils';

describe('crc-utils', () => {
  describe('CRC16 算法正确性', () => {
    it('应该对空数组返回0xFFFF', () => {
      const emptyData = new Uint8Array(0);
      expect(modbusCRC16(emptyData)).toBe(0xFFFF);
      expect(modbusCRC16_lut(emptyData)).toBe(0xFFFF);
    });

    it('应该正确计算单字节数据的CRC', () => {
      const testCases = [
        { data: [0x00], expected: 0x40BF },
        { data: [0x01], expected: 0x807E },
        { data: [0xFF], expected: 0x00FF },
        { data: [0x55], expected: 0x7F7F },
        { data: [0xAA], expected: 0x3F3F },
      ];

      testCases.forEach(({ data, expected }) => {
        const input = new Uint8Array(data);
        expect(modbusCRC16(input)).toBe(expected);
        expect(modbusCRC16_lut(input)).toBe(expected);
      });
    });

    it('应该正确计算多字节数据的CRC', () => {
      const testCases = [
        { data: [0x01, 0x02], expected: 0xE181 },
        { data: [0x12, 0x34], expected: 0xC70C },
        { data: [0x01, 0x02, 0x03], expected: 0x6161 },
        { data: [0xAB, 0xCD, 0xEF], expected: 0x3C15 },
      ];

      testCases.forEach(({ data, expected }) => {
        const input = new Uint8Array(data);
        expect(modbusCRC16(input)).toBe(expected);
        expect(modbusCRC16_lut(input)).toBe(expected);
      });
    });

    it('应该正确计算较长数据的CRC', () => {
      const longData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        longData[i] = i;
      }

      const result1 = modbusCRC16(longData);
      const result2 = modbusCRC16_lut(longData);

      expect(result1).toBe(result2);
      expect(result1).toBe(0xde6c); // 预期的CRC值
    });

    it('两种算法应该产生相同的结果', () => {
      // 测试各种数据模式
      const testPatterns = [
        new Uint8Array([]),
        new Uint8Array([0]),
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array(100).fill(0),
        new Uint8Array(100).fill(0xFF),
        new Uint8Array(1000).map((_, i) => i % 256),
        new Uint8Array(Array.from({ length: 50 }, () => Math.floor(Math.random() * 256))),
      ];

      testPatterns.forEach((data, index) => {
        const result1 = modbusCRC16(data);
        const result2 = modbusCRC16_lut(data);
        expect(result1).toBe(result2);
      });
    });
  });

  describe('边界条件测试', () => {
    it('应该处理全0数据', () => {
      const sizes = [1, 10, 100, 1000];

      sizes.forEach(size => {
        const zeroData = new Uint8Array(size).fill(0);
        const result1 = modbusCRC16(zeroData);
        const result2 = modbusCRC16_lut(zeroData);

        expect(result1).toBe(result2);
        expect(result1).toBeGreaterThan(0);
      });
    });

    it('应该处理全1数据', () => {
      const sizes = [1, 10, 100, 1000];

      sizes.forEach(size => {
        const onesData = new Uint8Array(size).fill(0xFF);
        const result1 = modbusCRC16(onesData);
        const result2 = modbusCRC16_lut(onesData);

        expect(result1).toBe(result2);
        expect(result1).toBeGreaterThan(0);
      });
    });

    it('应该处理递增序列', () => {
      const incrementalData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        incrementalData[i] = i;
      }

      const result1 = modbusCRC16(incrementalData);
      const result2 = modbusCRC16_lut(incrementalData);

      expect(result1).toBe(result2);
    });

    it('应该处理递减序列', () => {
      const decrementalData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        decrementalData[i] = 255 - i;
      }

      const result1 = modbusCRC16(decrementalData);
      const result2 = modbusCRC16_lut(decrementalData);

      expect(result1).toBe(result2);
    });
  });

  describe('数据完整性验证', () => {
    it('相同数据应该产生相同的CRC', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const copy1 = new Uint8Array(testData);
      const copy2 = new Uint8Array(testData);

      expect(modbusCRC16(copy1)).toBe(modbusCRC16(copy2));
      expect(modbusCRC16_lut(copy1)).toBe(modbusCRC16_lut(copy2));
    });

    it('不同数据应该产生不同的CRC（高概率）', () => {
      const data1 = new Uint8Array([1, 2, 3, 4, 5]);
      const data2 = new Uint8Array([1, 2, 3, 4, 6]);

      const crc1 = modbusCRC16(data1);
      const crc2 = modbusCRC16(data2);

      expect(crc1).not.toBe(crc2);
    });

    it('数据顺序改变应该影响CRC', () => {
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([3, 2, 1]);

      const crc1 = modbusCRC16(data1);
      const crc2 = modbusCRC16(data2);

      expect(crc1).not.toBe(crc2);
    });
  });

  describe('返回值范围验证', () => {
    it('CRC值应该在有效范围内', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);

      const result1 = modbusCRC16(testData);
      const result2 = modbusCRC16_lut(testData);

      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result1).toBeLessThanOrEqual(0xFFFF);
      expect(result2).toBeGreaterThanOrEqual(0);
      expect(result2).toBeLessThanOrEqual(0xFFFF);
    });
  });
});
