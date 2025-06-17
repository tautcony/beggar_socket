/**
 * 压缩解压工具类
 * 用于处理GBA Logo的Huffman压缩和Diff16BitUnFilter解压
 */
/**
 * Huffman解压函数 (GBA Logo解压)
 * @param data - 压缩的数据
 * @returns 解压后的数据
 */
export function huffUnComp(data: Uint8Array): Uint8Array {
  const bits = data[0] & 15;
  const outSize = (data[1] | (data[2] << 8) | (data[3] << 16)) & 0xFFFF;

  // 初始化变量
  let i = 6 + data[4] * 2;
  let nodeOffs = 5;
  let outUnits = 0;
  let outReady = 0;
  const out: number[] = [];

  while (out.length < outSize) {
    const inUnit = data[i] | (data[i + 1] << 8) | (data[i ^ 2] << 16) | (data[(i ^ 2) + 1] << 24);
    i += 4;

    for (let b = 31; b >= 0 && out.length < outSize; b--) {
      if (nodeOffs >= data.length) {
        console.warn('Node offset out of bounds:', nodeOffs, 'data length:', data.length);
        return new Uint8Array(out.slice(0, Math.min(out.length, outSize)));
      }

      const node = data[nodeOffs];
      nodeOffs &= ~1;
      nodeOffs += (node & 0x3F) * 2 + 2 + (inUnit >> b & 1);

      if (nodeOffs >= data.length) {
        console.warn('Calculated node offset out of bounds:', nodeOffs, 'data length:', data.length);
        return new Uint8Array(out.slice(0, Math.min(out.length, outSize)));
      }

      if (node << (inUnit >> b & 1) & 0x80) {
        outReady >>>= bits;
        outReady |= data[nodeOffs] << 32 - bits;
        outReady &= 0xFFFFFFFF;
        outUnits += 1;

        if (outUnits === bits % 8 + 4) {
          for (let j = 0; j < 4 && out.length < outSize; j++) {
            out.push((outReady >> (j * 8)) & 0xFF);
          }
          if (out.length >= outSize) {
            return new Uint8Array(out);
          }
          outUnits = 0;
          outReady = 0;
        }

        nodeOffs = 5;
      }
    }
  }

  if (outUnits > 0 && out.length < outSize) {
    for (let j = 0; j < 4 && out.length < outSize; j++) {
      out.push((outReady >> (j * 8)) & 0xFF);
    }
  }

  return new Uint8Array(out.slice(0, outSize));
}

/**
 * 16位差分过滤器解压
 * @param data - 过滤后的数据
 * @returns 解压后的数据
 */
export function diff16BitUnFilter(data: Uint8Array): Uint8Array {
  if (data.length < 4) {
    return new Uint8Array(0);
  }

  const header = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
  const outSize = (header >>> 8) & 0xFFFF;
  let pos = 4;
  let prev = 0;
  const dest: number[] = [];

  while (pos < outSize) {
    const current = data[pos] | (data[pos + 1] << 8);
    const temp = (current + prev) & 0xFFFF;

    dest.push(temp & 0xFF);
    dest.push((temp >> 8) & 0xFF);

    pos += 2;
    prev = temp;
  }

  return new Uint8Array(dest);
}

/**
 * 处理GBA Logo数据
 * 包含解压和解过滤流程
 * @param logoData - 原始logo数据
 * @returns 处理后的logo数据，如果处理失败返回null
 */
export function processGBALogoData(logoData: Uint8Array): Uint8Array | null {
  try {
    // 添加header数据
    const temp = new Uint8Array([
      0x09, 0x05, 0x0A, 0x06, 0x0B, 0x07, 0xC2, 0x0D, 0xC2, 0x02, 0x0E, 0x08,
      0xC3, 0x04, 0x83, 0x01, 0x83, 0x03, 0xC3, 0x0C, 0x83, 0x0F, 0x83, 0x82,
      0x82, 0x81, 0x01, 0x00, 0x00, 0x00, 0x40, 0x0F, 0x00, 0x00, 0xD4, 0x24,
    ]);

    const reversedTemp = new Uint8Array(temp.length);
    for (let i = 0; i < temp.length; i++) {
      reversedTemp[i] = temp[temp.length - 1 - i];
    }

    const combinedData = new Uint8Array(reversedTemp.length + logoData.length);
    combinedData.set(reversedTemp, 0);
    combinedData.set(logoData, reversedTemp.length);
    const huffDecompressed = huffUnComp(combinedData);
    const finalData = diff16BitUnFilter(huffDecompressed);

    return finalData;
  } catch (error) {
    console.error('GBA Logo data processing failed:', error);
    return null;
  }
}
