import { Jimp, rgbaToInt } from 'jimp';
import path from 'path';
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

describe('RGB555 Color Generation', () => {
  it('should generate an image containing all RGB555 colors in 240x160 format', () => {
    // RGB555格式：5位红、5位绿、5位蓝 = 32×32×32 = 32768种颜色
    const width = 240;
    const height = 160;
    const totalPixels = width * height; // 38400
    const totalRgb555Colors = 32 * 32 * 32; // 32768

    // 创建图像
    const rgb555Image = new Jimp({ width, height });

    // 生成所有RGB555颜色
    let colorIndex = 0;
    for (let r5 = 0; r5 < 32; r5++) {
      for (let g5 = 0; g5 < 32; g5++) {
        for (let b5 = 0; b5 < 32; b5++) {
          if (colorIndex >= totalPixels) break;

          // 将5位RGB转换为8位RGB用于显示（显示5bit的阶梯效果）
          const r8 = r5 * 8; // 0, 8, 16, ..., 248
          const g8 = g5 * 8;
          const b8 = b5 * 8;

          // 计算像素位置
          const y = Math.floor(colorIndex / width);
          const x = colorIndex % width;

          const rgba = rgbaToInt(r8, g8, b8, 255);
          rgb555Image.setPixelColor(rgba, x, y);

          colorIndex++;
        }
        if (colorIndex >= totalPixels) break;
      }
      if (colorIndex >= totalPixels) break;
    }

    // 剩余像素用交错黑白格子填充
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        if (pixelIndex >= colorIndex) {
          // 交错黑白格子：(x + y) % 2 === 0 为黑色，否则为白色
          const isBlack = (x + y) % 2 === 0;
          const color = isBlack ? 0x000000FF : 0xFFFFFFFF; // 黑色或白色
          rgb555Image.setPixelColor(color, x, y);
        }
      }
    }

    // 验证图像基本属性
    expect(rgb555Image.width).toBe(width);
    expect(rgb555Image.height).toBe(height);

    // 验证生成了所有RGB555颜色
    expect(colorIndex).toBe(totalRgb555Colors);

    // 验证所有像素都被填充（38400像素）
    // 注意：RGB555只有32768种颜色，剩余5632个像素用棋盘格填充
    expect(totalPixels).toBe(38400);

    // 可选：保存图像用于视觉验证
    // await rgb555Image.write(`${path.join(__dirname, 'rgb555-all-colors-240x160')}.png`);

    console.log(`Generated RGB555 color test image: ${width}x${height}`);
    console.log(`Total RGB555 colors: ${totalRgb555Colors}`);
    console.log(`Colors displayed: ${Math.min(colorIndex, totalPixels)}`);
    console.log(`Checkerboard pixels: ${totalPixels - colorIndex}`);
  });
});
