// imageUtils.ts - 图像处理工具

import { intToRGBA, Jimp } from 'jimp';
import quantize from 'quantize';

type JimpObject = InstanceType<typeof Jimp>;

// 背景图片处理（Jimp实现，自动索引色并写入ROM）
export async function updateBackgroundImage(menuRom: Uint8Array, bgImage?: ArrayBuffer): Promise<void> {
  if (!bgImage) return;

  try {
    // 动态导入 jimp 以减少初始加载时间

    // 使用Jimp读取背景图像数据
    const img = await Jimp.fromBuffer(bgImage) as JimpObject;

    // 提取调色板和位图数据
    const { palette, bitmap, palette_rgb555 } = convertToIndexedImage(img, 256);

    // 定位ROM背景区
    const marker = new Uint8Array([0x52, 0x54, 0x46, 0x4E, 0xFF, 0xFE]); // 'RTFN\xFF\xFE'
    const markerIndex = findMarkerIndex(menuRom, marker);
    if (markerIndex === -1) throw new Error('Background marker not found');

    const menu_rom_bg_offset = markerIndex - 0x9800;
    if (menu_rom_bg_offset < 0) throw new Error('Invalid background offset');

    // 复制位图数据 (最大0x9600字节)
    const bitmapLength = Math.min(bitmap.length, 0x9600);
    menuRom.set(bitmap.subarray(0, bitmapLength), menu_rom_bg_offset);

    // 复制调色板数据 (0x200字节)
    const paletteData = new Uint8Array(0x200);
    const paletteView = new DataView(paletteData.buffer);
    palette_rgb555.slice(0, 0x100).forEach((color, i) => {
      paletteView.setUint16(i * 2, color, true); // little-endian
    });
    menuRom.set(paletteData, menu_rom_bg_offset + 0x9600);

    console.log('Background image updated successfully');
  } catch (e: unknown) {
    console.error('Error: Couldn\'t update background image. ' + (e as Error).message);
    throw e;
  }
}

// 辅助函数：在Uint8Array中查找标记
function findMarkerIndex(array: Uint8Array, marker: Uint8Array): number {
  for (let i = 0; i <= array.length - marker.length; i++) {
    let found = true;
    for (let j = 0; j < marker.length; j++) {
      if (array[i + j] !== marker[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

// 将图片转换为索引色图片
export function convertToIndexedImage(image: JimpObject, maxColors = 256): {
  palette: quantize.RgbPixel[];
  bitmap: Uint8Array;
  palette_rgb555: number[];
} {
  const bitmap = image.bitmap;
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const { r, g, b } = intToRGBA(image.getPixelColor(x, y));
      pixels.push([r, g, b]);
    }
  }

  // 量化颜色以确保不超过maxColors
  const quantizeResult = quantize(pixels, maxColors);
  if (quantizeResult === false) {
    throw new Error('Color quantization failed');
  }
  const quantizedPalette = quantizeResult.palette();

  // GBA RGB555格式转换
  const palette_rgb555 = quantizedPalette.map(color => {
    return ((color[2] >> 3) << 10) | ((color[1] >> 3) << 5) | (color[0] >> 3);
  });

  // ---------- LUT 生成 ----------
  const lut = new Uint8Array(32 * 32 * 32);

  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        const color: quantize.RgbPixel = [r << 3, g << 3, b << 3];

        // 找到最近的调色板颜色
        let closestIndex = 0;
        let minDistance = colorDistance(color, quantizedPalette[0]);
        for (let i = 1; i < quantizedPalette.length; i++) {
          const d = colorDistance(color, quantizedPalette[i]);
          if (d < minDistance) {
            minDistance = d;
            closestIndex = i;
          }
        }

        lut[(r << 10) | (g << 5) | b] = closestIndex;
      }
    }
  }

  // ---------- 位图映射 ----------
  const raw_bitmap = new Uint8Array(bitmap.width * bitmap.height);

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const pixelIndex = y * bitmap.width + x;
      const { r, g, b } = intToRGBA(image.getPixelColor(x, y));

      // RGB 压缩到 5bit 后查 LUT
      const idx = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      raw_bitmap[pixelIndex] = idx;
    }
  }

  return {
    palette: quantizedPalette,
    bitmap: raw_bitmap,
    palette_rgb555,
  };
}

// 颜色距离计算函数
function colorDistance(c1: quantize.RgbPixel, c2: quantize.RgbPixel): number {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
