import { describe, expect, it } from 'vitest';

import { floorPowerOfTwo, isAllErasedBytes, nextChunkSize, prepareRomImage } from '@/utils/transfer-plan';

describe('transfer-plan', () => {
  describe('floorPowerOfTwo', () => {
    it('将非 2 的幂向下取整到 2 的幂', () => {
      expect(floorPowerOfTwo(1000, 64)).toBe(512);
      expect(floorPowerOfTwo(512, 64)).toBe(512);
      expect(floorPowerOfTwo(63, 64)).toBe(64);
      expect(floorPowerOfTwo(4096, 64)).toBe(4096);
      expect(floorPowerOfTwo(32768, 64)).toBe(32768);
    });
  });

  describe('nextChunkSize', () => {
    it('不跨越 32MiB GBA bank 边界', () => {
      const bankSize = 0x2000000;
      const address = bankSize - 1024;
      expect(nextChunkSize({
        address,
        remaining: 8192,
        pageSize: 4096,
        bankSize,
      })).toBe(1024);

      expect(nextChunkSize({
        address: bankSize,
        remaining: 8192,
        pageSize: 4096,
        bankSize,
      })).toBe(4096);
    });

    it('不跨越 0x4000 GB/MBC bank 边界', () => {
      const bankSize = 0x4000;
      expect(nextChunkSize({
        address: 0x3e00,
        remaining: 4096,
        pageSize: 4096,
        bankSize,
      })).toBe(512);
    });

    it('不跨越扇区终点', () => {
      expect(nextChunkSize({
        address: 0xff00,
        remaining: 4096,
        pageSize: 512,
        sectorEnd: 0x10000,
      })).toBe(256);
    });

    it('起点未按 bufferSize 对齐时先对齐到写缓冲页边界，后续块对齐页边界', () => {
      const first = nextChunkSize({
        address: 0x100,
        remaining: 4096,
        pageSize: 512,
        bufferSize: 512,
      });
      expect(first).toBe(256);

      const second = nextChunkSize({
        address: 0x100 + first,
        remaining: 4096 - first,
        pageSize: 512,
        bufferSize: 512,
      });
      expect(second).toBe(512);
    });

    it('正确处理尾块', () => {
      expect(nextChunkSize({
        address: 0x2000,
        remaining: 123,
        pageSize: 512,
      })).toBe(123);
    });
  });

  describe('prepareRomImage', () => {
    it('输入短于 size 时使用 0xFF 补齐且不修改原数组', () => {
      const input = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      const prepared = prepareRomImage(input, 8);
      expect(Array.from(prepared)).toEqual([0x12, 0x34, 0x56, 0x78, 0xff, 0xff, 0xff, 0xff]);
      expect(input.byteLength).toBe(4);
    });

    it('输入长度足够时直接返回原数据', () => {
      const input = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
      expect(prepareRomImage(input, 4)).toBe(input);
      expect(prepareRomImage(input, 2)).toBe(input);
    });
  });

  describe('isAllErasedBytes', () => {
    it('仅在全为 0xFF 时返回 true', () => {
      expect(isAllErasedBytes(new Uint8Array([0xff, 0xff, 0xff]))).toBe(true);
      expect(isAllErasedBytes(new Uint8Array([0xff, 0xfe, 0xff]))).toBe(false);
    });
  });
});
