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

    const head = '24d400000f4000000001818282830f830cc30383018304c3080e02c20dc2070b060a050924ffae51699aa2213d84820a84e409ad11248b98c0817f21a352be199309ce2010464a4af82731ec58c7e83382e3cebf85f4df94ce4b09c194568ac01372a7fc9f844d73a3ca9a615897a327fc039876231dc7610304ae56bf38840040a70efdff52fe036f9530f197fbc08560d68025a963be03014e38e2f9a234ffbb3e0344780090cb88113a9465c07c6387f03cafd625e48b380aac7221d4f807';
    const huff = '82d0000000003c7c408080c00443f0f0000001010f0e3c3c00c4003cc4c300000000efff110000c0c03031d70f380003030c8cb4713c000000001f39e1c600000000defe220100000000030ffdf0c0c000001e3f220003030000c0e03d1c008080000f9c71012130310000d36a1b80ff00000000b7bb030706fafcf7444b000000000000e3d2f0ff00000000c0c00000000000001424100000f0d09fad6c8f10f1ef892ec5fee0ff0000000080c0400000c0407fa9a5fcff0000243b8c7c080000f8685055b4400000c0a4d602f1e2ff00000000';
    const diff = '00003c7c7cfcfcbc0000f0f0f0f0f1f100003c3c3c003c3c000000000000efff000000c0c0f0f1c700000003030f8fc30000000000001f39000000000000defe000000000000030f0000c0c0c0c0deff000003030303c3e30000008080808f1c001e214e524e5221bc3c3c3c3c3c3c3cf3f7f6fefcf8f8f03c3c3c3c3c3c3c3c1f0f0f0f0f0f0f0fcfcfcfcfcfcfcfcfe3f3f3f3f3e3c38370f0ff00f0f0791f3e1e1e1e1e1e1e1e9edededede9e1e1ec7c3c3c3c3c3e7fe737b7b7b7b73e3c33878787878381c0f1e000000';

    // 合并header和logo数据
    const combinedData = new Uint8Array(reversedTemp.length + logoData.length);
    combinedData.set(reversedTemp, 0);
    combinedData.set(logoData, reversedTemp.length);

    // 校验 combinedData
    const headArr = head.match(/.{2}/g) || [];
    const headBytes = Uint8Array.from(headArr.map(byte => parseInt(byte, 16)));
    if (combinedData.length !== headBytes.length || !combinedData.every((v, i) => v === headBytes[i])) {
      console.error('combinedData 校验失败', { combinedData, headBytes });
    } else {
      console.log('combinedData 校验通过');
    }
    // 打印 combinedData 结果
    console.log('combinedData:', Array.from(combinedData).map(b => b.toString(16).padStart(2, '0')).join(''));

    const huffDecompressed = huffUnComp(combinedData);
    // 校验 huffDecompressed
    const huffArr = huff.match(/.{2}/g) || [];
    const huffBytes = Uint8Array.from(huffArr.map(byte => parseInt(byte, 16)));
    if (huffDecompressed.length !== huffBytes.length || !huffDecompressed.every((v, i) => v === huffBytes[i])) {
      console.error('huffDecompressed 校验失败', { huffDecompressed, huffBytes });
    } else {
      console.log('huffDecompressed 校验通过');
    }
    // 打印 huffDecompressed 结果
    console.log('huffDecompressed:', Array.from(huffDecompressed).map(b => b.toString(16).padStart(2, '0')).join(''));

    const finalData = diff16BitUnFilter(huffDecompressed);
    // 校验 finalData
    const diffArr = diff.match(/.{2}/g) || [];
    const diffBytes = Uint8Array.from(diffArr.map(byte => parseInt(byte, 16)));
    if (finalData.length !== diffBytes.length || !finalData.every((v, i) => v === diffBytes[i])) {
      console.error('finalData 校验失败', { finalData, diffBytes });
    } else {
      console.log('finalData 校验通过');
    }
    // 打印 finalData 结果
    console.log('finalData:', Array.from(finalData).map(b => b.toString(16).padStart(2, '0')).join(''));

    return finalData;
  } catch (error) {
    console.error('GBA Logo data processing failed:', error);
    return null;
  }
}
