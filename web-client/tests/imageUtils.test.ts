import { Jimp, rgbaToInt } from 'jimp';
import { beforeAll, describe, expect, it } from 'vitest';

import { convertToIndexedImage, saveIndexedImageAsPng } from '../src/services/lk/imageUtils';

describe('convertToIndexedImage', () => {
  let testImage: InstanceType<typeof Jimp>;

  beforeAll(() => {
    testImage = new Jimp({ width: 16, height: 16 });
    const colors: number[] = [];
    for (let i = 0; i < 256; i++) {
      const r = (i * 7) % 256;
      const g = (i * 11) % 256;
      const b = (i * 13) % 256;
      const rgba = rgbaToInt(r, g, b, 255);
      colors.push(rgba);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const index = (y * 16 + x) % 256;
        testImage.setPixelColor(colors[index], x, y);
      }
    }
  });

  it('should convert image to indexed format with default maxColors', async () => {
    const result = await convertToIndexedImage(testImage);

    expect(result.palette).toBeDefined();
    expect(result.bitmap).toBeDefined();
    expect(result.palette_rgb555).toBeDefined();

    expect(result.palette.length).toBeGreaterThan(0);
    expect(result.palette.length).toBeLessThanOrEqual(256);
    expect(result.bitmap.length).toBe(256);
    expect(result.palette_rgb555.length).toBe(result.palette.length);
  });

  it('should respect maxColors parameter', async () => {
    const result = await convertToIndexedImage(testImage, 16);

    expect(result.palette.length).toBeLessThanOrEqual(16);
    expect(result.palette_rgb555.length).toBe(result.palette.length);
  });

  it('should generate valid RGB555 palette values', async () => {
    const result = await convertToIndexedImage(testImage);

    result.palette_rgb555.forEach((color: number) => {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0x7FFF); // RGB555 max value
    });
  });

  it('should map pixels to palette indices correctly', async () => {
    const result = await convertToIndexedImage(testImage);

    // 检查位图中的索引是否在调色板范围内
    result.bitmap.forEach((index: number) => {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(result.palette.length);
    });
  });

  it('should quantize colors for images with > 256 colors', async () => {
    // 创建一个图像有超过256种颜色（例如300种）
    const largeColorImage = new Jimp({ width: 20, height: 15, color: 0xffffffff }); // 20x15 = 300 pixels
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 20; x++) {
        const color = (x + y * 20) % 300; // 0-299
        const r = (color * 7) % 256;
        const g = (color * 11) % 256;
        const b = (color * 13) % 256;
        const rgba = rgbaToInt(r, g, b, 255);
        largeColorImage.setPixelColor(rgba, x, y);
      }
    }

    const result = await convertToIndexedImage(largeColorImage);

    // 调色板长度应 <= 256
    expect(result.palette.length).toBeLessThanOrEqual(256);
    expect(result.palette_rgb555.length).toBe(result.palette.length);

    // 检查位图映射是否在调色板范围内
    result.bitmap.forEach((index: number) => {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(result.palette.length);
    });

    // 由于量化，只有部分颜色会发生变更，但整体结构保持
    expect(result.bitmap.length).toBe(300); // 20x15
  });

  it('should process image hue correctly', async () => {
    const largeImage = new Jimp({ width: 512, height: 512, color: 0xffffffff });
    // 生成渐变：R=x%256, G=y%256, B在四个象限分别使用[0,64,128,255]
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const r = x % 256; // 0-255
        const g = y % 256; // 0-255
        let b = 0;
        if (x >= 256 && y < 256) b = 64; // 右上
        else if (x < 256 && y >= 256) b = 128; // 左下
        else if (x >= 256 && y >= 256) b = 255; // 右下
        // 左上 b = 0
        const rgba = rgbaToInt(r, g, b, 255);
        largeImage.setPixelColor(rgba, x, y);
      }
    }

    // await largeImage.write(`${path.join(__dirname, 'large-image-input')}.png`);

    const result = await convertToIndexedImage(largeImage, 256);
    console.log('Palette size:', result.palette.length);
    const usedIndices = new Set(result.bitmap);
    console.log('Actual used palette colors:', usedIndices.size);

    // await saveIndexedImageAsPng(result, 'large-image-output', 512, 512);
  }, 60000);
});
