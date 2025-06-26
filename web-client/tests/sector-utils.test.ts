import { describe, expect, it } from 'vitest';

import { calcSectorUsage } from '../src/utils/sector-utils';

describe('sector-utils', () => {
  describe('calcSectorUsage', () => {
    it('应该正确计算简单的单扇区使用情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 16, 16384], // 16个1KB扇区
      ];
      const size = 512; // 需要512字节

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0x3FF, // 1024 - 1 (完整扇区)
        sectorSize: 1024,
        sectorCount: 1, // 使用1个扇区
      });
    });

    it('应该正确处理跨多个扇区的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 4, 4096], // 4个1KB扇区
      ];
      const size = 2560; // 需要2.5KB，跨3个扇区

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0xBFF, // 3 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 3, // 使用3个连续扇区
      });
    });

    it('应该正确处理多种扇区大小的块', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [4096, 2, 8192], // 2个4KB扇区
        [32768, 2, 65536], // 2个32KB扇区
      ];
      const size = 40960; // 需要40KB

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(2);

      // 使用2个4KB扇区
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0x1FFF, // 2 * 4096 - 1
        sectorSize: 4096,
        sectorCount: 2,
      });

      // 使用1个32KB扇区
      expect(result[1]).toEqual({
        startAddress: 0x2000,
        endAddress: 0x9FFF, // 8192 + 32768 - 1
        sectorSize: 32768,
        sectorCount: 1,
      });
    });

    it('应该支持自定义起始地址', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 4, 4096],
      ];
      const size = 1536; // 需要1.5KB
      const baseAddress = 0x8000000;

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x8000000,
        endAddress: 0x80007FF, // baseAddress + 2 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 2, // 使用2个连续扇区
      });
    });

    it('应该正确处理非零基址下的多扇区块情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [4096, 2, 8192], // 2个4KB扇区
        [32768, 2, 65536], // 2个32KB扇区
      ];
      const size = 40960; // 需要40KB
      const baseAddress = 0x10000; // 64KB起始地址

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(2);

      // 使用2个4KB扇区
      expect(result[0]).toEqual({
        startAddress: 0x10000,
        endAddress: 0x11FFF, // 0x10000 + 2 * 4096 - 1
        sectorSize: 4096,
        sectorCount: 2,
      });

      // 使用1个32KB扇区
      expect(result[1]).toEqual({
        startAddress: 0x12000, // 0x10000 + 2 * 4096
        endAddress: 0x19FFF, // 0x12000 + 32768 - 1
        sectorSize: 32768,
        sectorCount: 1,
      });
    });

    it('应该正确处理大基址的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [65536, 3, 196608], // 3个64KB扇区
      ];
      const size = 131072; // 需要128KB
      const baseAddress = 0xFF000000; // 大基址

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0xFF000000,
        endAddress: 0xFF01FFFF, // 0xFF000000 + 2 * 65536 - 1
        sectorSize: 65536,
        sectorCount: 2,
      });
    });

    it('应该正确处理基址对齐的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 8, 8192],
      ];
      const size = 2048; // 需要2KB
      const baseAddress = 0x400; // 1KB对齐的基址

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x400,
        endAddress: 0xBFF, // 0x400 + 2 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 2,
      });
    });

    it('应该正确处理基址为0的默认情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [2048, 4, 4096],
      ];
      const size = 3000; // 需要约3KB

      // 不传递baseAddress参数，应该默认为0
      const result1 = calcSectorUsage(eraseSectorBlocks, size);
      // 显式传递baseAddress为0
      const result2 = calcSectorUsage(eraseSectorBlocks, size, 0);

      // 两种调用方式应该产生相同结果
      expect(result1).toEqual(result2);
      expect(result1).toHaveLength(1);
      expect(result1[0]).toEqual({
        startAddress: 0,
        endAddress: 4095, // 2 * 2048 - 1
        sectorSize: 2048,
        sectorCount: 2,
      });
    });

    it('应该正确跳过无法使用的扇区块（基址测试）', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 2, 2048], // 2个1KB扇区
        [4096, 0, 0], // 0个4KB扇区（应该跳过）
        [512, 4, 2048], // 4个512B扇区
      ];
      const size = 1536; // 需要1.5KB
      const baseAddress = 0x10000;

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);

      // 使用2个1KB扇区（算法会使用第一个可用的扇区块）
      expect(result[0]).toEqual({
        startAddress: 0x10000,
        endAddress: 0x107FF, // 0x10000 + 2 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 2,
      });
    });

    it('应该正确处理基址溢出边界情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 2, 2048],
      ];
      const size = 1024;
      const baseAddress = 0xFFFFF000; // 接近32位上限

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0xFFFFF000,
        endAddress: 0xFFFFF3FF, // 0xFFFFF000 + 1024 - 1
        sectorSize: 1024,
        sectorCount: 1,
      });
    });

    it('应该正确处理恰好填满所有扇区的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 3, 3072],
      ];
      const size = 3072; // 恰好3KB

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0xBFF, // 3 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 3, // 使用全部3个扇区
      });
    });

    it('应该正确处理大小为0的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 4, 4096],
      ];
      const size = 0;

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(0);
    });

    it('应该正确处理大小为1字节的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 4, 4096],
      ];
      const size = 1;

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0x3FF, // 1024 - 1 (完整扇区)
        sectorSize: 1024,
        sectorCount: 1,
      });
    });

    it('应该正确处理复杂的多块扇区配置', () => {
      // 模拟真实Flash配置：4个16KB扇区 + 1个64KB扇区 + 7个128KB扇区
      const eraseSectorBlocks: [number, number, number][] = [
        [16384, 4, 65536], // 4个16KB扇区
        [65536, 1, 65536], // 1个64KB扇区
        [131072, 7, 917504], // 7个128KB扇区
      ];
      const size = 200000; // 需要约195KB

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(3); // 4个16KB + 1个64KB + 1个128KB (合并为3个条目)

      // 验证4个16KB扇区合并为一个条目
      expect(result[0]).toEqual({
        startAddress: 0,
        endAddress: 65536 - 1, // 4 * 16384 - 1
        sectorSize: 16384,
        sectorCount: 4,
      });

      // 验证64KB扇区
      expect(result[1]).toEqual({
        startAddress: 65536,
        endAddress: 65536 + 65536 - 1,
        sectorSize: 65536,
        sectorCount: 1,
      });

      // 验证第一个128KB扇区
      expect(result[2]).toEqual({
        startAddress: 131072,
        endAddress: 131072 + 131072 - 1,
        sectorSize: 131072,
        sectorCount: 1,
      });
    });

    it('应该在扇区不足时抛出异常', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 2, 2048], // 只有2个1KB扇区
      ];
      const size = 4096; // 需要4KB，但只有2KB可用

      expect(() => {
        calcSectorUsage(eraseSectorBlocks, size);
      }).toThrow('Insufficient sector space: need 4096 bytes, but only 2048 bytes available');
    });

    it('扇区必须完整使用 - 即使数据很小也要占用整个扇区', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [4096, 2, 8192], // 2个4KB扇区
      ];
      const size = 100; // 只需要100字节，但仍需要完整的4KB扇区

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0xFFF, // 完整的4KB扇区 (4096 - 1)
        sectorSize: 4096,
        sectorCount: 1,
      });
    });

    it('应该正确处理需要跨不同扇区块的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 2, 2048], // 2个1KB扇区
        [2048, 3, 6144], // 3个2KB扇区
      ];
      const size = 5120; // 需要5KB，跨越两种扇区

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(2);

      // 使用全部2个1KB扇区
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0x7FF, // 2 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 2,
      });

      // 使用2个2KB扇区
      expect(result[1]).toEqual({
        startAddress: 0x800,
        endAddress: 0x17FF, // 2048 + 2 * 2048 - 1
        sectorSize: 2048,
        sectorCount: 2,
      });
    });

    it('应该正确处理部分使用扇区块的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 5, 5120], // 5个1KB扇区
      ];
      const size = 2560; // 需要2.5KB，只使用3个扇区

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0xBFF, // 3 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 3, // 只使用5个中的3个扇区
      });
    });

    it('应该正确处理非零基址下的复杂多扇区情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [4096, 8, 32768], // 8个4KB扇区
        [65536, 2, 131072], // 2个64KB扇区
        [1024, 32, 32768], // 32个1KB扇区
      ];
      const size = 180224; // 需要176KB，应该跨越多个扇区块
      const baseAddress = 0x08000000; // STM32常见的Flash基址

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(3);

      // 使用全部8个4KB扇区
      expect(result[0]).toEqual({
        startAddress: 0x08000000,
        endAddress: 0x08007FFF, // 0x08000000 + 8 * 4096 - 1
        sectorSize: 4096,
        sectorCount: 8,
      });

      // 使用2个64KB扇区
      expect(result[1]).toEqual({
        startAddress: 0x08008000, // 0x08000000 + 32768
        endAddress: 0x08027FFF, // 0x08008000 + 2 * 65536 - 1
        sectorSize: 65536,
        sectorCount: 2,
      });

      // 使用16个1KB扇区
      expect(result[2]).toEqual({
        startAddress: 0x08028000, // 0x08008000 + 131072
        endAddress: 0x0802BFFF, // 0x08028000 + 16 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 16,
      });
    });

    it('应该正确处理非零基址下有空扇区块的情况', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [2048, 4, 8192], // 4个2KB扇区
        [8192, 0, 0], // 0个8KB扇区（应该跳过）
        [1024, 8, 8192], // 8个1KB扇区
        [4096, 0, 0], // 0个4KB扇区（应该跳过）
        [512, 16, 8192], // 16个512B扇区
      ];
      const size = 12288; // 需要12KB
      const baseAddress = 0x20000000; // SRAM基址

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(2);

      // 使用全部4个2KB扇区
      expect(result[0]).toEqual({
        startAddress: 0x20000000,
        endAddress: 0x20001FFF, // 0x20000000 + 4 * 2048 - 1
        sectorSize: 2048,
        sectorCount: 4,
      });

      // 跳过8KB扇区块，使用4个1KB扇区
      expect(result[1]).toEqual({
        startAddress: 0x20002000, // 0x20000000 + 8192
        endAddress: 0x20002FFF, // 0x20002000 + 4 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 4,
      });
    });

    it('应该正确处理非零基址的地址边界计算', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [256, 4, 1024], // 4个256B扇区
      ];
      const size = 768; // 需要768字节，应该使用3个扇区
      const baseAddress = 0xFFFFF000; // 接近32位地址上限

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0xFFFFF000,
        endAddress: 0xFFFFF2FF, // 0xFFFFF000 + 3 * 256 - 1
        sectorSize: 256,
        sectorCount: 3,
      });
    });

    it('应该正确处理非零基址下的单字节需求', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [64, 8, 512], // 8个64B扇区
      ];
      const size = 1; // 只需要1字节，但仍需要完整的64B扇区
      const baseAddress = 0x10000000;

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startAddress: 0x10000000,
        endAddress: 0x1000003F, // 0x10000000 + 64 - 1
        sectorSize: 64,
        sectorCount: 1,
      });
    });

    it('应该正确处理非零基址下的地址连续性', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 3, 3072], // 3个1KB扇区
        [2048, 2, 4096], // 2个2KB扇区
      ];
      const size = 6144; // 需要6KB，刚好使用所有扇区
      const baseAddress = 0x08010000;

      const result = calcSectorUsage(eraseSectorBlocks, size, baseAddress);

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        startAddress: 0x08010000,
        endAddress: 0x08010BFF, // 0x08010000 + 3 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 3,
      });

      expect(result[1]).toEqual({
        startAddress: 0x08010C00, // 0x08010000 + 3072
        endAddress: 0x08011bff, // 0x08010C00 + 2 * 2048 - 1
        sectorSize: 2048,
        sectorCount: 2,
      });

      // 验证地址连续性
      expect(result[1].startAddress).toBe(result[0].endAddress + 1);
    });

    it('应该在完全没有可用扇区时抛出异常', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 0, 0], // 0个1KB扇区
        [2048, 0, 0], // 0个2KB扇区
      ];
      const size = 1024; // 需要1KB

      expect(() => {
        calcSectorUsage(eraseSectorBlocks, size);
      }).toThrow('Insufficient sector space: need 1024 bytes, but only 0 bytes available');
    });

    it('应该在部分扇区不足时抛出异常（复杂情况）', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [512, 3, 1536], // 3个512B扇区
        [1024, 0, 0], // 0个1KB扇区（跳过）
        [2048, 1, 2048], // 1个2KB扇区
      ];
      const size = 5120; // 需要5KB，但只有3.5KB可用

      expect(() => {
        calcSectorUsage(eraseSectorBlocks, size);
      }).toThrow('Insufficient sector space: need 5120 bytes, but only 3584 bytes available');
    });

    it('应该在非零基址下空间不足时抛出异常', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 1, 1024], // 只有1个1KB扇区
      ];
      const size = 2048; // 需要2KB，但只有1KB可用
      const baseAddress = 0x08000000;

      expect(() => {
        calcSectorUsage(eraseSectorBlocks, size, baseAddress);
      }).toThrow('Insufficient sector space: need 2048 bytes, but only 1024 bytes available');
    });

    it('应该在空扇区列表时抛出异常', () => {
      const eraseSectorBlocks: [number, number, number][] = [];
      const size = 1024; // 需要1KB

      expect(() => {
        calcSectorUsage(eraseSectorBlocks, size);
      }).toThrow('Insufficient sector space: need 1024 bytes, but only 0 bytes available');
    });
  });
});
