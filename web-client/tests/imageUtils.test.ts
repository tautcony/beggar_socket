import { Jimp } from 'jimp';
import { beforeAll, describe, expect, it } from 'vitest';

import { convertToIndexedImage } from '../src/services/lk/imageUtils';

describe('convertToIndexedImage', () => {
  let testImage: InstanceType<typeof Jimp>;

  beforeAll(() => {
    // 创建一个简单的测试图像 (10x10 像素)
    testImage = new Jimp({ width: 10, height: 10, color: 0xff0000ff }); // 蓝色图像
    // 添加一些不同颜色
    testImage.setPixelColor(0xff00ff00, 0, 0); // 绿色
    testImage.setPixelColor(0xffff0000, 5, 5); // 红色
    testImage.setPixelColor(0xffffff00, 9, 9); // 黄色
  });

  it('should convert image to indexed format with default maxColors', () => {
    const result = convertToIndexedImage(testImage);

    expect(result.palette).toBeDefined();
    expect(result.bitmap).toBeDefined();
    expect(result.palette_rgb555).toBeDefined();

    expect(result.palette.length).toBeGreaterThan(0);
    expect(result.palette.length).toBeLessThanOrEqual(256);
    expect(result.bitmap.length).toBe(100); // 10x10 = 100 pixels
    expect(result.palette_rgb555.length).toBe(result.palette.length);
  });

  it('should respect maxColors parameter', () => {
    const result = convertToIndexedImage(testImage, 16);

    expect(result.palette.length).toBeLessThanOrEqual(16);
    expect(result.palette_rgb555.length).toBe(result.palette.length);
  });

  it('should generate valid RGB555 palette values', () => {
    const result = convertToIndexedImage(testImage);

    result.palette_rgb555.forEach((color: number) => {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0x7FFF); // RGB555 max value
    });
  });

  it('should map pixels to palette indices correctly', () => {
    const result = convertToIndexedImage(testImage);

    // 检查位图中的索引是否在调色板范围内
    result.bitmap.forEach((index: number) => {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(result.palette.length);
    });
  });

  describe('Performance Tests', () => {
    it('should process small image quickly (< 50ms)', () => {
      const start = performance.now();
      convertToIndexedImage(testImage);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
    });

    it('should process medium image reasonably (< 100ms)', () => {
      const mediumImage = new Jimp({ width: 100, height: 100, color: 0xff0000ff });
      // 添加随机颜色
      for (let i = 0; i < 1000; i++) {
        const x = Math.floor(Math.random() * 100);
        const y = Math.floor(Math.random() * 100);
        const color = Math.floor(Math.random() * 0xffffff);
        mediumImage.setPixelColor(color, x, y);
      }

      const start = performance.now();
      convertToIndexedImage(mediumImage);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });

    it('should process large image within acceptable time (< 500ms)', () => {
      const largeImage = new Jimp({ width: 256, height: 256, color: 0xff0000ff });
      // 添加随机颜色
      for (let i = 0; i < 140 * 160; i++) {
        const x = Math.floor(Math.random() * 256);
        const y = Math.floor(Math.random() * 256);
        const color = Math.floor(Math.random() * 0xffffff);
        largeImage.setPixelColor(color, x, y);
      }

      const start = performance.now();
      convertToIndexedImage(largeImage);
      const end = performance.now();

      expect(end - start).toBeLessThan(500);
    });

    it('should handle quantization performance with many unique colors', () => {
      // 创建一个图像，每个像素都是唯一颜色 (最多256种)
      const uniqueColorImage = new Jimp({ width: 16, height: 16, color: 0xff0000ff });
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const color = (x + y * 16) % 256;
          uniqueColorImage.setPixelColor(color << 16 | color << 8 | color, x, y);
        }
      }

      const start = performance.now();
      const result = convertToIndexedImage(uniqueColorImage, 16);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
      expect(result.palette.length).toBeLessThanOrEqual(16);
    });
  });
});
