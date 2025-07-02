/**
 * CRC32 计算工具
 * 基于IEEE 802.3标准，与STM32硬件CRC32单元兼容
 */

// CRC32 查找表 (IEEE 802.3多项式 0x04C11DB7)
const CRC32_TABLE = new Uint32Array(256);

// 初始化CRC32查找表
function initCRC32Table(): void {
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc >>>= 1;
      }
    }
    CRC32_TABLE[i] = crc >>> 0; // 确保无符号32位
  }
}

// 初始化查找表
initCRC32Table();

/**
 * 计算CRC32校验值（兼容STM32硬件CRC32）
 * @param data 数据数组
 * @returns CRC32值
 */
export function calculateCRC32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;

  // 按字节处理数据
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < data.length; i++) {
    const tableIndex = (crc ^ data[i]) & 0xFF;
    crc = (crc >>> 8) ^ CRC32_TABLE[tableIndex];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0; // 返回无符号32位值
}

/**
 * 计算STM32兼容的CRC32（按32位字处理）
 * @param data 数据数组
 * @returns CRC32值
 */
export function calculateSTM32CRC32(data: Uint8Array): number {
  // STM32的CRC32计算单元使用不同的初始值和处理方式
  let crc = 0xFFFFFFFF;

  // 按4字节对齐处理
  const wordCount = Math.floor(data.length / 4);
  const remainingBytes = data.length % 4;

  // 处理4字节对齐的部分
  for (let i = 0; i < wordCount; i++) {
    const word = (data[i * 4 + 3] << 24) |
                 (data[i * 4 + 2] << 16) |
                 (data[i * 4 + 1] << 8) |
                 data[i * 4];

    for (let bit = 0; bit < 32; bit++) {
      if ((crc & 0x80000000) !== ((word << bit) & 0x80000000)) {
        crc = (crc << 1) ^ 0x04C11DB7;
      } else {
        crc <<= 1;
      }
    }
  }

  // 处理剩余字节
  if (remainingBytes > 0) {
    let word = 0;
    for (let i = 0; i < remainingBytes; i++) {
      word |= data[wordCount * 4 + i] << (i * 8);
    }

    for (let bit = 0; bit < remainingBytes * 8; bit++) {
      if ((crc & 0x80000000) !== ((word << bit) & 0x80000000)) {
        crc = (crc << 1) ^ 0x04C11DB7;
      } else {
        crc <<= 1;
      }
    }
  }

  return crc >>> 0; // 确保无符号32位
}
