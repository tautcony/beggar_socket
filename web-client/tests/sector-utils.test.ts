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

    it('应该在扇区不足时停止计算', () => {
      const eraseSectorBlocks: [number, number, number][] = [
        [1024, 2, 2048], // 只有2个1KB扇区
      ];
      const size = 4096; // 需要4KB，但只有2KB可用

      const result = calcSectorUsage(eraseSectorBlocks, size);

      expect(result).toHaveLength(1); // 使用所有可用的扇区，合并为一个条目
      expect(result[0]).toEqual({
        startAddress: 0x00,
        endAddress: 0x7FF, // 2 * 1024 - 1
        sectorSize: 1024,
        sectorCount: 2, // 使用所有2个扇区
      });
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
  });
});
