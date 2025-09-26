// imageUtils.ts - 图像处理工具

import { Buffer } from 'buffer';
import { intToRGBA, Jimp } from 'jimp';

type JimpObject = InstanceType<typeof Jimp>;

// 将图片转换为索引色图片
function convertToIndexedImage(image: JimpObject, maxColors = 256): {
  palette: { r: number; g: number; b: number }[];
  bitmap: Uint8Array;
  palette_rgb555: number[];
} {
  const bitmap = image.bitmap;
  // 获取调色板（遍历像素获取唯一颜色）
  const paletteSet = new Set<string>();
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const hex = intToRGBA(image.getPixelColor(x, y));
      paletteSet.add(`${hex.r},${hex.g},${hex.b}`);
    }
  }
  const paletteArr = Array.from(paletteSet).map(str => {
    const [r, g, b] = str.split(',').map(Number);
    return { r, g, b };
  });

  // 量化颜色以确保不超过maxColors
  const quantizedPalette = quantizeColors(paletteArr, maxColors);

  // GBA RGB555格式转换
  const palette_rgb555 = quantizedPalette.map(color => {
    return ((color.b >> 3) << 10) | ((color.g >> 3) << 5) | (color.r >> 3);
  });

  // 位图数据 - 将原始图像映射到量化调色板
  const raw_bitmap = new Uint8Array(bitmap.width * bitmap.height);

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const pixelIndex = y * bitmap.width + x;
      const color = intToRGBA(image.getPixelColor(x, y));

      // 找到最接近的量化颜色
      let closestIndex = 0;
      let minDistance = colorDistance(color, quantizedPalette[0]);

      for (let i = 1; i < quantizedPalette.length; i++) {
        const distance = colorDistance(color, quantizedPalette[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      raw_bitmap[pixelIndex] = closestIndex;
    }
  }

  return {
    palette: quantizedPalette,
    bitmap: raw_bitmap,
    palette_rgb555,
  };
}

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

// 颜色距离计算函数
function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// 合并相近颜色的函数
function quantizeColors(colors: { r: number; g: number; b: number }[], maxColors = 256): { r: number; g: number; b: number }[] {
  if (colors.length <= maxColors) {
    return colors;
  }

  // 复制颜色数组
  const quantizedColors = [...colors];

  // 重复合并最相近的颜色，直到数量不超过maxColors
  while (quantizedColors.length > maxColors) {
    let minDistance = Infinity;
    let mergeIndex1 = -1;
    let mergeIndex2 = -1;

    // 找到最相近的两个颜色
    for (let i = 0; i < quantizedColors.length; i++) {
      for (let j = i + 1; j < quantizedColors.length; j++) {
        const distance = colorDistance(quantizedColors[i], quantizedColors[j]);
        if (distance < minDistance) {
          minDistance = distance;
          mergeIndex1 = i;
          mergeIndex2 = j;
        }
      }
    }

    if (mergeIndex1 === -1 || mergeIndex2 === -1) break;

    // 合并两个颜色，取平均值
    const color1 = quantizedColors[mergeIndex1];
    const color2 = quantizedColors[mergeIndex2];
    const mergedColor = {
      r: Math.round((color1.r + color2.r) / 2),
      g: Math.round((color1.g + color2.g) / 2),
      b: Math.round((color1.b + color2.b) / 2),
    };

    // 移除第二个颜色，替换第一个颜色
    quantizedColors.splice(mergeIndex2, 1);
    quantizedColors[mergeIndex1] = mergedColor;
  }

  return quantizedColors;
}
