import { describe, expect, it } from 'vitest';

import { createSectorProgressInfo } from '../src/utils/sector-utils';

describe('sector-progress-utils', () => {
  describe('createSectorProgressInfo', () => {
    it('应该正确创建单个扇区块的进度信息', () => {
      const sectorInfo = [
        {
          startAddress: 0x00,
          endAddress: 0x3FF,
          sectorSize: 1024,
          sectorCount: 1,
          totalSize: 1024,
        },
      ];

      const result = createSectorProgressInfo(sectorInfo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        address: 0x00,
        size: 1024,
        state: 'pending',
      });
    });

    it('应该正确创建多个扇区的进度信息（从低地址向高地址）', () => {
      const sectorInfo = [
        {
          startAddress: 0x00,
          endAddress: 0xBFF,
          sectorSize: 1024,
          sectorCount: 3,
          totalSize: 3072,
        },
      ];

      const result = createSectorProgressInfo(sectorInfo);

      expect(result).toHaveLength(3);
      // 应该从最低地址开始（物理顺序）
      expect(result[0]).toEqual({
        address: 0x00, // 0 * 1024
        size: 1024,
        state: 'pending',
      });
      expect(result[1]).toEqual({
        address: 0x400, // 1 * 1024
        size: 1024,
        state: 'pending',
      });
      expect(result[2]).toEqual({
        address: 0x800, // 2 * 1024
        size: 1024,
        state: 'pending',
      });
    });

    it('应该正确处理多个扇区块（按低地址优先排序）', () => {
      const sectorInfo = [
        {
          startAddress: 0x2000,
          endAddress: 0x9FFF,
          sectorSize: 32768,
          sectorCount: 1,
          totalSize: 32768,
        },
        {
          startAddress: 0x00,
          endAddress: 0x1FFF,
          sectorSize: 4096,
          sectorCount: 2,
          totalSize: 8192,
        },
      ];

      const result = createSectorProgressInfo(sectorInfo);

      expect(result).toHaveLength(3);

      // 应该先处理低地址的扇区块（4KB扇区）
      expect(result[0]).toEqual({
        address: 0x00,
        size: 4096,
        state: 'pending',
      });

      expect(result[1]).toEqual({
        address: 0x1000,
        size: 4096,
        state: 'pending',
      });

      // 然后是高地址扇区块（32KB扇区）
      expect(result[2]).toEqual({
        address: 0x2000,
        size: 32768,
        state: 'pending',
      });
    });

    it('应该正确处理复杂的多块扇区配置', () => {
      const sectorInfo = [
        {
          startAddress: 131072,
          endAddress: 262143,
          sectorSize: 131072,
          sectorCount: 1,
          totalSize: 131072,
        },
        {
          startAddress: 0x00,
          endAddress: 65535,
          sectorSize: 16384,
          sectorCount: 4,
          totalSize: 65536,
        },
        {
          startAddress: 65536,
          endAddress: 131071,
          sectorSize: 65536,
          sectorCount: 1,
          totalSize: 65536,
        },
      ];

      const result = createSectorProgressInfo(sectorInfo);

      expect(result).toHaveLength(6);

      // 验证从最低地址开始（16KB扇区，按物理顺序）
      expect(result[0]).toEqual({
        address: 0, // 0 * 16384
        size: 16384,
        state: 'pending',
      });
      expect(result[1]).toEqual({
        address: 16384, // 1 * 16384
        size: 16384,
        state: 'pending',
      });
      expect(result[2]).toEqual({
        address: 32768, // 2 * 16384
        size: 16384,
        state: 'pending',
      });
      expect(result[3]).toEqual({
        address: 49152, // 3 * 16384
        size: 16384,
        state: 'pending',
      });

      // 然后是64KB扇区
      expect(result[4]).toEqual({
        address: 65536,
        size: 65536,
        state: 'pending',
      });

      // 最后是128KB扇区
      expect(result[5]).toEqual({
        address: 131072,
        size: 131072,
        state: 'pending',
      });
    });

    it('应该正确处理空数组', () => {
      const result = createSectorProgressInfo([]);
      expect(result).toHaveLength(0);
    });

    it('应该正确处理扇区数量为0的情况', () => {
      const sectorInfo = [
        {
          startAddress: 0x00,
          endAddress: 0x00,
          sectorSize: 1024,
          sectorCount: 0,
          totalSize: 0,
        },
      ];

      const result = createSectorProgressInfo(sectorInfo);
      expect(result).toHaveLength(0);
    });
  });
});
