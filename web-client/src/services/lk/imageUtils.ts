import { ResizeStrategy } from '@jimp/plugin-resize';
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

    // 转换为240*160图像大小
    if (img.width !== 240 || img.height !== 160) {
      img.resize({ w: 240, h: 160, mode: ResizeStrategy.HERMITE });
    }

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
  });

  const outPointContainer = await IQ.applyPalette(pointContainer, palette, {
    colorDistanceFormula: 'euclidean',
    imageQuantization: 'floyd-steinberg',
  });

  const palettePoints = palette.getPointContainer().getPointArray();

  // 预提取 palette 的 RGB 分量
  const palLen = palettePoints.length;
  const palR = new Int16Array(palLen);
  const palG = new Int16Array(palLen);
  const palB = new Int16Array(palLen);
  for (let j = 0; j < palLen; j++) {
    palR[j] = palettePoints[j].r;
    palG[j] = palettePoints[j].g;
    palB[j] = palettePoints[j].b;
  }

  const outPoints = outPointContainer.getPointArray();
  const indexBitmap = new Uint8Array(outPoints.length);
  for (let i = 0; i < outPoints.length; i++) {
    const pt = outPoints[i];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < palLen; j++) {
      const dr = pt.r - palR[j];
      const dg = pt.g - palG[j];
      const db = pt.b - palB[j];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
        if (dist === 0) {
          break;
        }
      }
    }

    indexBitmap[i] = bestIdx;
  }

  // 用于 ROM 的 GBA RGB555
  const palette_rgb555 = palettePoints.map((point) => {
    const r = point.r, g = point.g, b = point.b;
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

// 将图片转换为RGB555格式的预览图像，并返回base64字符串用于前端显示
export async function generateRgb555PreviewImage(image: JimpObject): Promise<string> {
  const { width, height } = image;

  // 创建一个新的Jimp图像用于预览
  const previewImage = new Jimp({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4; // RGBA格式，每个像素4字节
      const r = image.bitmap.data[index];
      const g = image.bitmap.data[index + 1];
      const b = image.bitmap.data[index + 2];

      // 转换为RGB555格式：5位红、5位绿、5位蓝
      const rgb555 = ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3);

      // 将RGB555转换回RGB用于预览显示
      const r5 = (rgb555 & 0x1F) << 3;
      const g5 = ((rgb555 >> 5) & 0x1F) << 3;
      const b5 = ((rgb555 >> 10) & 0x1F) << 3;

      const rgba = rgbaToInt(r5, g5, b5, 255);
      previewImage.setPixelColor(rgba, x, y);
    }
  }

  // 将图像转换为base64字符串
  const buffer = await previewImage.getBuffer('image/png');
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

// 将图片转换为索引色格式的预览图像，并返回base64字符串用于前端显示
export async function generateIndexedPreviewImage(image: JimpObject): Promise<string> {
  // 转换为240*160图像大小（与ROM处理一致）
  const resizedImage = image.clone();
  // 仅当图片不符时处理
  if (resizedImage.width !== 240 || resizedImage.height !== 160) {
    resizedImage.resize({ w: 240, h: 160, mode: ResizeStrategy.HERMITE });
  }

  // 转换为索引色
  const { palette, bitmap } = await convertToIndexedImage(resizedImage, 256);

  // 创建预览图像
  const previewImage = new Jimp({ width: 240, height: 160 });

  for (let y = 0; y < 160; y++) {
    for (let x = 0; x < 240; x++) {
      const index = bitmap[y * 240 + x];
      const point = palette[index];

      const r5 = point.r >> 3;
      const g5 = point.g >> 3;
      const b5 = point.b >> 3;

      const r8 = (r5 << 3) | (r5 >> 2);
      const g8 = (g5 << 3) | (g5 >> 2);
      const b8 = (b5 << 3) | (b5 >> 2);
      const rgba = rgbaToInt(r8, g8, b8, 255);
      previewImage.setPixelColor(rgba, x, y);
    }
  }

  // 将图像转换为base64字符串
  const buffer = await previewImage.getBuffer('image/png');
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}
