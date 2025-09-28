import * as IQ from 'image-q';
import { Jimp, rgbaToInt } from 'jimp';
import path from 'path';

type JimpObject = InstanceType<typeof Jimp>;

// 背景图片处理（Jimp实现，自动索引色并写入ROM）
export async function updateBackgroundImage(menuRom: Uint8Array, bgImage?: ArrayBuffer): Promise<void> {
  if (!bgImage) return;

  try {
    // 使用Jimp读取背景图像数据
    const img = await Jimp.fromBuffer(bgImage) as JimpObject;

    // 提取调色板和位图数据
    const { palette, bitmap, palette_rgb555 } = await convertToIndexedImage(img, 256);

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
export async function convertToIndexedImage(image: JimpObject, maxColors = 256): Promise<{
  palette: IQ.utils.Point[];
  bitmap: Uint8Array;
  palette_rgb555: number[];
}> {
  const { bitmap, width, height } = image;

  const pointContainer = IQ.utils.PointContainer.fromUint8Array(
    bitmap.data, width, height,
  );

  const palette = await IQ.buildPalette([pointContainer], {
    colorDistanceFormula: 'euclidean',
    paletteQuantization: 'neuquant',
    colors: maxColors,
    // onProgress: (progress) => { console.log('buildPalette', progress); },
  });

  const outPointContainer = await IQ.applyPalette(pointContainer, palette, {
    colorDistanceFormula: 'euclidean',
    imageQuantization: 'floyd-steinberg',
    // onProgress: (progress) => { console.log('applyPalette', progress); },
  });

  const palettePoints = palette.getPointContainer().getPointArray();
  const paletteColorToIndex = new Map<number, number>();
  for (let i = 0; i < palettePoints.length; i++) {
    const pt = palettePoints[i];
    const key = (pt.r << 16) | (pt.g << 8) | pt.b;
    paletteColorToIndex.set(key, i);
  }

  const outPoints = outPointContainer.getPointArray();
  const indexBitmap = new Uint8Array(outPoints.length);
  for (let i = 0; i < outPoints.length; i++) {
    const pt = outPoints[i];
    const key = (pt.r << 16) | (pt.g << 8) | pt.b;
    indexBitmap[i] = paletteColorToIndex.get(key) ?? 0;
  }

  // 用于 ROM 的 GBA RGB555
  const palette_rgb555 = palettePoints.map(pt => {
    const r = pt.r, g = pt.g, b = pt.b;
    return ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3);
  });

  return {
    palette: palettePoints, // 8bit RGB 调色板（调试/显示用）
    bitmap: indexBitmap, // 每像素索引
    palette_rgb555, // GBA RGB555（写 ROM 用）
  };
}

export async function saveIndexedImageAsPng(indexedImage: {
  palette: IQ.utils.Point[];
  bitmap: Uint8Array;
}, filename: string, width: number, height: number) {
  const img = new Jimp({ width, height, color: 0xffffffff });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = indexedImage.bitmap[y * width + x];
      const point = indexedImage.palette[index];
      const rgba = rgbaToInt(point.r, point.g, point.b, 255);
      img.setPixelColor(rgba, x, y);
    }
  }

  const outputPath = path.join(__dirname, filename);
  await img.write(`${outputPath}.png`);
}
