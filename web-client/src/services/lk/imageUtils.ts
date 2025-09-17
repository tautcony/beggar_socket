// imageUtils.ts - 图像处理工具

// 背景图片处理（Jimp实现，自动索引色并写入ROM）
export async function updateBackgroundImage(menuRom: Uint8Array, bgImage?: ArrayBuffer): Promise<void> {
  if (!bgImage) return;

  try {
    // 动态导入 jimp 以减少初始加载时间
    const { intToRGBA, Jimp } = await import('jimp');

    // 使用Jimp读取背景图像数据
    const img = await Jimp.fromBuffer(Buffer.from(bgImage));

    // 获取调色板（遍历像素获取唯一颜色）
    const paletteSet = new Set<string>();

    for (let y = 0; y < img.bitmap.height; y++) {

      for (let x = 0; x < img.bitmap.width; x++) {

        const hex = intToRGBA(img.getPixelColor(x, y));

        paletteSet.add(`${hex.r},${hex.g},${hex.b}`);
      }
    }
    const paletteArr = Array.from(paletteSet).map(str => {
      const [r, g, b] = str.split(',').map(Number);
      return { r, g, b };
    });
    // GBA RGB555格式转换
    const palette_rgb555 = paletteArr.map(color => {
      return ((color.b >> 3) << 10) | ((color.g >> 3) << 5) | (color.r >> 3);
    });
    // 位图数据
    const raw_bitmap = new Uint8Array(img.bitmap.data);

    // 调色板数据 (0x200 = 512字节 = 256色 * 2字节)
    const raw_palette = new Uint8Array(0x200);
    const paletteView = new DataView(raw_palette.buffer);
    palette_rgb555.forEach((color, i) => {
      paletteView.setUint16(i * 2, color, true); // little-endian
    });

    // 定位ROM背景区
    const marker = new Uint8Array([0x52, 0x54, 0x46, 0x4E, 0xFF, 0xFE]); // 'RTFN\xFF\xFE'
    const markerIndex = findMarkerIndex(menuRom, marker);
    if (markerIndex === -1) throw new Error('Background marker not found');

    const menu_rom_bg_offset = markerIndex - 0x9800;
    if (menu_rom_bg_offset < 0) throw new Error('Invalid background offset');

    // 复制位图数据 (最大0x9600字节)
    const bitmapLength = Math.min(raw_bitmap.length, 0x9600);
    menuRom.set(raw_bitmap.subarray(0, bitmapLength), menu_rom_bg_offset);

    // 复制调色板数据 (0x200字节)
    menuRom.set(raw_palette.subarray(0, 0x200), menu_rom_bg_offset + 0x9600);

    console.log('Background image updated successfully');
  } catch (e: unknown) {
    console.error('Error: Couldn\'t update background image. ' + (e as Error).message);
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
