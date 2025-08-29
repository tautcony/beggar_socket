/**
 * 压缩解压工具类
 * 用于处理GBA Logo的Huffman压缩和Diff16BitUnFilter反向过滤
 */

// 常量定义
const HUFFMAN_BITS_MASK = 0x0F;
const HUFFMAN_SIZE_MASK = 0xFFFF;
const HUFFMAN_NODE_MASK = 0x3F;
const HUFFMAN_LEAF_FLAG = 0x80;
const HUFFMAN_UINT32_MASK = 0xFFFFFFFF;
const HUFFMAN_TREE_START = 5;
const HUFFMAN_HEADER_BASE_SIZE = 6;
const HUFFMAN_BYTES_PER_UNIT = 4;
const BYTE_MASK = 0xFF;
const BITS_PER_UINT32 = 32;
const BITS_PER_BYTE = 8;

/**
 * 从数据中读取32位整数（小端序）
 * @param data - 数据数组
 * @param offset - 偏移量
 * @returns 32位整数
 */
function readUint32LE(data: Uint8Array, offset: number): number {
  return data[offset] |
         (data[offset + 1] << 8) |
         (data[offset + 2] << 16) |
         (data[offset + 3] << 24);
}

/**
 * Huffman解压函数 (GBA Logo解压)
 *
 * @param data - 压缩的数据
 * @returns 解压后的数据
 */
export function huffUnComp(data: Uint8Array): Uint8Array {
  if (data.length < HUFFMAN_HEADER_BASE_SIZE) {
    console.warn('Huffman data too short:', data.length);
    return new Uint8Array(0);
  }

  // 读取头部信息
  const bits = data[0] & HUFFMAN_BITS_MASK;
  const outSize = readUint32LE(data, 1) & HUFFMAN_SIZE_MASK;

  if (outSize === 0) {
    return new Uint8Array(0);
  }

  const out: number[] = [];
  let outIndex = 0;

  // 初始化压缩数据读取位置
  let dataIndex = HUFFMAN_HEADER_BASE_SIZE + data[4] * 2;
  let nodeOffset = HUFFMAN_TREE_START;
  let outputUnits = 0;
  let outputBuffer = 0;

  const unitsPerFlush = (bits % BITS_PER_BYTE) + HUFFMAN_BYTES_PER_UNIT;

  while (outIndex < outSize && dataIndex < data.length) {
    // 读取32位输入单元
    const inputUnit = readUint32LE(data, dataIndex);
    dataIndex += HUFFMAN_BYTES_PER_UNIT;

    // 处理32位中的每一位
    for (let bitPos = BITS_PER_UINT32 - 1; bitPos >= 0 && outIndex < outSize; bitPos--) {
      if (nodeOffset >= data.length) {
        console.warn('Node offset out of bounds:', nodeOffset, 'data length:', data.length);
        return new Uint8Array(out.slice(0, outIndex));
      }

      const currentNode = data[nodeOffset];
      const currentBit = (inputUnit >> bitPos) & 1;

      // 计算下一个节点偏移量
      nodeOffset = (nodeOffset & ~1) + (currentNode & HUFFMAN_NODE_MASK) * 2 + 2 + currentBit;

      if (nodeOffset >= data.length) {
        console.warn('Calculated node offset out of bounds:', nodeOffset, 'data length:', data.length);
        return new Uint8Array(out.slice(0, outIndex));
      }

      // 检查是否到达叶节点
      if ((currentNode << currentBit) & HUFFMAN_LEAF_FLAG) {
        // 将叶节点值添加到输出缓冲区
        outputBuffer = ((outputBuffer >>> bits) | (data[nodeOffset] << (BITS_PER_UINT32 - bits))) & HUFFMAN_UINT32_MASK;
        outputUnits++;

        // 当缓冲区满时，将数据写入输出数组
        if (outputUnits === unitsPerFlush) {
          const remaining = Math.min(HUFFMAN_BYTES_PER_UNIT, outSize - outIndex);
          for (let j = 0; j < remaining; j++) {
            out[outIndex++] = (outputBuffer >> (j * BITS_PER_BYTE)) & BYTE_MASK;
          }

          outputUnits = 0;
          outputBuffer = 0;
        }

        // 重置到树根
        nodeOffset = HUFFMAN_TREE_START;
      }
    }
  }

  // 处理剩余的输出缓冲区数据
  if (outputUnits > 0 && outIndex < outSize) {
    const remaining = Math.min(HUFFMAN_BYTES_PER_UNIT, outSize - outIndex);
    for (let j = 0; j < remaining; j++) {
      out[outIndex++] = (outputBuffer >> (j * BITS_PER_BYTE)) & BYTE_MASK;
    }
  }

  return new Uint8Array(out.slice(0, outSize));
}

// 16位差分过滤器常量
const DIFF16_HEADER_SIZE = 4;
const DIFF16_SIZE_SHIFT = 8;
const DIFF16_SIZE_MASK = 0xFFFF;
const DIFF16_BYTES_PER_SAMPLE = 2;

/**
 * 16位差分过滤器反向处理
 *
 * @param data - 经过差分过滤的数据
 * @returns 反向处理后的原始数据
 */
export function diff16BitUnFilter(data: Uint8Array): Uint8Array {
  if (data.length < DIFF16_HEADER_SIZE) {
    console.warn('Diff16 data too short:', data.length);
    return new Uint8Array(0);
  }

  // 读取头部信息
  const header = readUint32LE(data, 0);
  const outSize = (header >>> DIFF16_SIZE_SHIFT) & DIFF16_SIZE_MASK;

  if (outSize === 0) {
    return new Uint8Array(0);
  }

  // 预分配输出数组
  const dest: number[] = [];
  let pos = DIFF16_HEADER_SIZE;
  let previousValue = 0;

  // 处理16位样本 - 注意原始逻辑是 pos < outSize，不是 pos < data.length
  while (pos < outSize && pos + 1 < data.length) {
    // 读取当前16位差分值
    const currentDiff = data[pos] | (data[pos + 1] << 8);

    // 计算实际值（差分值 + 前一个值）
    const actualValue = (currentDiff + previousValue) & DIFF16_SIZE_MASK;

    // 存储为小端序字节
    dest.push(actualValue & BYTE_MASK);
    dest.push((actualValue >> 8) & BYTE_MASK);

    pos += DIFF16_BYTES_PER_SAMPLE;
    previousValue = actualValue;
  }

  return new Uint8Array(dest);
}

// GBA Logo处理常量
const GBA_LOGO_HEADER = new Uint8Array([
  0x24, 0xd4, 0x00, 0x00, 0x0f, 0x40, 0x00, 0x00, 0x00, 0x01, 0x81, 0x82,
  0x82, 0x83, 0x0f, 0x83, 0x0c, 0xc3, 0x03, 0x83, 0x01, 0x83, 0x04, 0xc3,
  0x08, 0x0e, 0x02, 0xc2, 0x0d, 0xc2, 0x07, 0x0b, 0x06, 0x0a, 0x05, 0x09,
]);

/**
 * 处理GBA Logo数据
 * 包含解压和反向过滤流程
 *
 * @param logoData - 原始logo数据
 * @returns 处理后的logo数据，如果处理失败返回null
 */
export function processGBALogoData(logoData: Uint8Array): Uint8Array | null {
  try {
    if (!logoData || logoData.length === 0) {
      console.warn('Logo data is empty or null');
      return null;
    }

    // 合并header和logo数据
    const combinedData = new Uint8Array(GBA_LOGO_HEADER.length + logoData.length);
    combinedData.set(GBA_LOGO_HEADER, 0);
    combinedData.set(logoData, GBA_LOGO_HEADER.length);

    // 执行Huffman解压
    const huffDecompressed = huffUnComp(combinedData);
    if (!huffDecompressed || huffDecompressed.length === 0) {
      console.error('Huffman decompression failed');
      return null;
    }

    // 执行16位差分反向过滤
    const finalData = diff16BitUnFilter(huffDecompressed);
    if (!finalData || finalData.length === 0) {
      console.error('Diff16 unfilter failed');
      return null;
    }

    return finalData;
  } catch (error) {
    console.error('GBA Logo data processing failed:', error);
    return null;
  }
}
