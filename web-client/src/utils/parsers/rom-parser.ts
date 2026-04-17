import type { MbcType } from '@/types/command-options';

import { GB_HEADER, GBA_HEADER } from './constants';

/**
 * ROM文件解析工具
 * 支持GBA和GB/GBC ROM格式
 */

export interface RomInfo {
  title: string;
  gameCode?: string;
  makerCode?: string;
  version?: number;
  type: 'GBA' | 'GB' | 'GBC' | 'Unknown';
  cartType?: number;
  romSize: number;
  ramSize?: number;
  isValid: boolean;
  region?: string;
  logoData?: Uint8Array;
  fileName: string;
}

/**
 * GBA Nintendo Logo (位于0x04-0x9F, 156字节)
 */
export const GBA_NINTENDO_LOGO = new Uint8Array([
  0x24, 0xFF, 0xAE, 0x51, 0x69, 0x9A, 0xA2, 0x21, 0x3D, 0x84, 0x82, 0x0A, 0x84, 0xE4, 0x09, 0xAD,
  0x11, 0x24, 0x8B, 0x98, 0xC0, 0x81, 0x7F, 0x21, 0xA3, 0x52, 0xBE, 0x19, 0x93, 0x09, 0xCE, 0x20,
  0x10, 0x46, 0x4A, 0x4A, 0xF8, 0x27, 0x31, 0xEC, 0x58, 0xC7, 0xE8, 0x33, 0x82, 0xE3, 0xCE, 0xBF,
  0x85, 0xF4, 0xDF, 0x94, 0xCE, 0x4B, 0x09, 0xC1, 0x94, 0x56, 0x8A, 0xC0, 0x13, 0x72, 0xA7, 0xFC,
  0x9F, 0x84, 0x4D, 0x73, 0xA3, 0xCA, 0x9A, 0x61, 0x58, 0x97, 0xA3, 0x27, 0xFC, 0x03, 0x98, 0x76,
  0x23, 0x1D, 0xC7, 0x61, 0x03, 0x04, 0xAE, 0x56, 0xBF, 0x38, 0x84, 0x00, 0x40, 0xA7, 0x0E, 0xFD,
  0xFF, 0x52, 0xFE, 0x03, 0x6F, 0x95, 0x30, 0xF1, 0x97, 0xFB, 0xC0, 0x85, 0x60, 0xD6, 0x80, 0x25,
  0xA9, 0x63, 0xBE, 0x03, 0x01, 0x4E, 0x38, 0xE2, 0xF9, 0xA2, 0x34, 0xFF, 0xBB, 0x3E, 0x03, 0x44,
  0x78, 0x00, 0x90, 0xCB, 0x88, 0x11, 0x3A, 0x94, 0x65, 0xC0, 0x7C, 0x63, 0x87, 0xF0, 0x3C, 0xAF,
  0xD6, 0x25, 0xE4, 0x8B, 0x38, 0x0A, 0xAC, 0x72, 0x21, 0xD4, 0xF8, 0x07,
]);

/**
 * GB/GBC Nintendo Logo (位于0x104-0x133, 48字节)
 */
export const GB_NINTENDO_LOGO = new Uint8Array([
  0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
  0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
  0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E,
]);

export const CartridgeTypeMapper: Record<number, string> = {
  0x00: 'ROM ONLY',
  0x01: 'MBC1',
  0x02: 'MBC1+RAM',
  0x03: 'MBC1+RAM+BATTERY',
  0x05: 'MBC2',
  0x06: 'MBC2+BATTERY',
  0x08: 'ROM+RAM',
  0x09: 'ROM+RAM+BATTERY',
  0x0B: 'MMM01',
  0x0C: 'MMM01+RAM',
  0x0D: 'MMM01+RAM+BATTERY',
  0x0F: 'MBC3+TIMER+BATTERY',
  0x10: 'MBC3+TIMER+RAM+BATTERY',
  0x11: 'MBC3',
  0x12: 'MBC3+RAM',
  0x13: 'MBC3+RAM+BATTERY',
  0x19: 'MBC5',
  0x1A: 'MBC5+RAM',
  0x1B: 'MBC5+RAM+BATTERY',
  0x1C: 'MBC5+RUMBLE',
  0x1D: 'MBC5+RUMBLE+RAM',
  0x1E: 'MBC5+RUMBLE+RAM+BATTERY',
  0x20: 'MBC6',
  0x22: 'MBC7+SENSOR+RUMBLE+RAM+BATTERY',
  0xFC: 'POCKET CAMERA',
  0xFD: 'BANDAI TAMA5',
  0xFE: 'HuC3',
  0xFF: 'HuC1+RAM+BATTERY',
};

const INVALID_ROM_INFO = (romSize: number) => ({
  title: 'Unknown ROM',
  type: 'Unknown',
  romSize,
  isValid: false,
  logoData: new Uint8Array(0),
  fileName: 'UNTITLED',
}) as RomInfo;

/**
 * 通用 Logo 验证
 */
function validateLogo(data: Uint8Array, expectedLogo: Uint8Array, offset: number): boolean {
  if (data.length < offset + expectedLogo.length) {
    return false;
  }
  for (let i = 0; i < expectedLogo.length; i++) {
    if (data[offset + i] !== expectedLogo[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 通用头部校验和计算
 * GBA: -(sum + 0x19) & 0xFF; GB: equivalent via byte count
 */
function calculateHeaderChecksum(data: Uint8Array, start: number, end: number, adjustment: number): number {
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum += data[i];
  }
  return (-(sum + adjustment)) & 0xFF;
}

/**
 * 验证GBA Nintendo Logo
 */
export function validateGBALogo(data: Uint8Array): boolean {
  return validateLogo(data, GBA_NINTENDO_LOGO, GBA_HEADER.LOGO_OFFSET);
}

/**
 * 验证GB/GBC Nintendo Logo
 */
export function validateGBLogo(data: Uint8Array): boolean {
  return validateLogo(data, GB_NINTENDO_LOGO, GB_HEADER.LOGO_OFFSET);
}

/**
 * 解析GBA ROM信息
 * @param data ROM数据
 * @returns GBA ROM信息
 */
function parseGBARom(data: Uint8Array): RomInfo {
  if (data.length < GBA_HEADER.MIN_VALID_SIZE) {
    return INVALID_ROM_INFO(data.length);
  }

  // GBA ROM标题位置：0xA0-0xAB (12字节)
  const titleBytes = data.slice(GBA_HEADER.TITLE_OFFSET, GBA_HEADER.TITLE_END);
  const title = new TextDecoder('utf-8').decode(titleBytes).replace(/\0/g, '').trim();

  // 游戏代码：0xAC-0xAF (4字节)
  const gameCodeBytes = data.slice(GBA_HEADER.GAME_CODE_OFFSET, GBA_HEADER.GAME_CODE_END);
  const gameCode = new TextDecoder('ascii').decode(gameCodeBytes).replace(/\0/g, '');

  // 制造商代码：0xB0-0xB1 (2字节)
  const makerCodeBytes = data.slice(GBA_HEADER.MAKER_CODE_OFFSET, GBA_HEADER.MAKER_CODE_END);
  const makerCode = new TextDecoder('ascii').decode(makerCodeBytes).replace(/\0/g, '');

  // 版本号：0xBC
  const version = data[GBA_HEADER.VERSION_OFFSET];

  // 头部校验和：0xBD
  const checksumHeader = data[GBA_HEADER.CHECKSUM_OFFSET];

  // 验证GBA ROM有效性
  const hasValidSignature = data[GBA_HEADER.FIXED_BYTE_OFFSET] === GBA_HEADER.FIXED_BYTE_VALUE;
  const hasValidLogo = validateGBALogo(data);

  // 验证头部校验和 (0xA0-0xBC的补码校验和)
  const calculatedChecksum = calculateGBAChecksum(data);
  const hasValidChecksum = calculatedChecksum === checksumHeader;

  const isValid = hasValidSignature && hasValidLogo && hasValidChecksum;

  // 解析地区代码
  let region = 'Unknown';
  if (gameCode.length >= 4) {
    const regionCode = gameCode[3];
    switch (regionCode) {
      case 'J': region = 'Japan'; break;
      case 'E': region = 'USA'; break;
      case 'P': region = 'Europe'; break;
      case 'D': region = 'Germany'; break;
      case 'F': region = 'France'; break;
      case 'I': region = 'Italy'; break;
      case 'S': region = 'Spain'; break;
      default: region = 'Unknown'; break;
    }
  }

  // 提取Logo数据
  const logoData = data.slice(GBA_HEADER.LOGO_OFFSET, GBA_HEADER.LOGO_OFFSET + GBA_NINTENDO_LOGO.length);

  // 生成文件名
  const sanitizedTitle = sanitizeString(title) || 'UNTITLED';
  const sanitizedCode = sanitizeString(gameCode) || '';
  const sanitizedMaker = sanitizeString(makerCode) || '';
  const fileName = `${sanitizedTitle}${sanitizedCode}${sanitizedMaker}.gba`;

  return {
    title: title,
    gameCode,
    makerCode,
    version,
    type: 'GBA',
    romSize: data.length,
    isValid,
    region,
    logoData,
    fileName,
  };
}

/**
 * 解析GB/GBC ROM信息
 * @param data ROM数据
 * @returns GB/GBC ROM信息
 */
function parseGBRom(data: Uint8Array): RomInfo {
  if (data.length < GB_HEADER.MIN_VALID_SIZE) {
    return INVALID_ROM_INFO(data.length);
  }

  // GB ROM标题位置：0x134-0x143 (16字节，但0x143可能是CGB标志)
  let titleEnd = GB_HEADER.TITLE_END;

  // 检查CGB标志
  const cgbFlag = data[GB_HEADER.CGB_FLAG_OFFSET];
  const isColorGB = cgbFlag === 0x80 || cgbFlag === 0xC0;

  if (isColorGB) {
    titleEnd = GB_HEADER.TITLE_END; // CGB游戏标题到0x142
  }

  const titleBytes = data.slice(GB_HEADER.TITLE_OFFSET, titleEnd);
  const title = new TextDecoder('utf-8').decode(titleBytes).replace(/\0/g, '').trim();

  // 制造商代码：0x13F-0x142 (新格式) 或包含在标题中 (旧格式)
  let makerCode = '';
  if (data[GB_HEADER.MAKER_CODE_OFFSET] !== 0x00 || data[GB_HEADER.MAKER_CODE_OFFSET + 1] !== 0x00) {
    const makerBytes = data.slice(GB_HEADER.MAKER_CODE_OFFSET, GB_HEADER.MAKER_CODE_END);
    makerCode = new TextDecoder('ascii').decode(makerBytes).replace(/\0/g, '');
  }

  // 许可证代码
  const licenseCode = (data[GB_HEADER.LICENSE_HIGH_OFFSET] << 8) | data[GB_HEADER.LICENSE_LOW_OFFSET];

  // SGB标志
  const sgbFlag = data[GB_HEADER.SGB_FLAG_OFFSET];

  // 卡带类型
  const cartridgeType = data[GB_HEADER.CART_TYPE_OFFSET];

  // ROM大小
  const romSizeCode = data[GB_HEADER.ROM_SIZE_OFFSET];
  const romSize = romSizeCode < 8 ? (32 * 1024) << romSizeCode : data.length;

  // RAM大小
  const ramSizeMapper = {
    0: 0, // No RAM
    1: 0, // Unused
    2: 8 * 1024, // 8 KiB
    3: 32 * 1024, // 32 KiB
    4: 128 * 1024, // 128 KiB
    5: 64 * 1024, // 64 KiB
  };
  const ramSizeCode = data[GB_HEADER.RAM_SIZE_OFFSET] as 0 | 1 | 2 | 3 | 4 | 5;
  const ramSize = ramSizeMapper[ramSizeCode] ?? 0;

  const regionCode = data[GB_HEADER.REGION_OFFSET];
  let region = 'Unknown';
  switch (regionCode) {
    case 0x00: region = 'Japan'; break;
    case 0x01: region = 'Non-Japan'; break;
    default: region = 'Unknown'; break;
  }

  // 版本号
  const version = data[GB_HEADER.VERSION_OFFSET];

  // 头部校验和
  const checksumHeader = data[GB_HEADER.HEADER_CHECKSUM_OFFSET];

  // 全局校验和
  const checksumGlobal = (data[GB_HEADER.GLOBAL_CHECKSUM_HIGH] << 8) | data[GB_HEADER.GLOBAL_CHECKSUM_LOW];

  // 验证Nintendo Logo
  const hasValidLogo = validateGBLogo(data);

  // 验证头部校验和
  const calculatedHeaderChecksum = calculateGBChecksum(data);
  const hasValidChecksum = calculatedHeaderChecksum === checksumHeader;

  const isValid = hasValidLogo && hasValidChecksum;

  // 确定ROM类型
  let type: 'GB' | 'GBC' = 'GB';
  if (isColorGB) {
    type = 'GBC';
  }

  // 提取Logo数据
  const logoData = data.slice(GB_HEADER.LOGO_OFFSET, GB_HEADER.LOGO_OFFSET + GB_NINTENDO_LOGO.length);

  // 生成文件名
  const sanitizedTitle = sanitizeString(title) || 'UNTITLED';
  const sanitizedMaker = sanitizeString(makerCode) || '';
  const extension = type === 'GBC' ? '.gbc' : '.gb';
  const fileName = `${sanitizedTitle}${sanitizedMaker}${extension}`.trim();

  return {
    title: title,
    makerCode,
    version,
    type,
    romSize,
    ramSize,
    cartType: cartridgeType,
    isValid,
    region,
    logoData,
    fileName,
  };
}

/**
 * 检测ROM类型
 * @param data ROM数据
 * @returns ROM类型
 */
function detectRomType(data: Uint8Array): 'GBA' | 'GB' | 'Unknown' {
  if (!data || data.length === 0) {
    return 'Unknown';
  }

  // 首先检查GBA特征
  if (data.length >= GBA_HEADER.FIXED_BYTE_OFFSET + 1 && data[GBA_HEADER.FIXED_BYTE_OFFSET] === GBA_HEADER.FIXED_BYTE_VALUE) {
    // 如果有GBA固定签名字节，进一步验证Nintendo Logo
    if (validateGBALogo(data)) {
      return 'GBA';
    }
  }

  // 检查GB/GBC特征
  if (data.length >= GB_HEADER.MIN_VALID_SIZE && validateGBLogo(data)) {
    return 'GB';
  }

  // 如果都不匹配，根据文件大小做最后判断
  // GBA ROM通常较大 (>1MB)
  if (data.length > 0x100000) {
    return 'GBA';
  }

  return 'Unknown';
}

/**
 * 计算GBA头部校验和
 */
export function calculateGBAChecksum(data: Uint8Array): number {
  return calculateHeaderChecksum(data, GBA_HEADER.CHECKSUM_START, GBA_HEADER.CHECKSUM_END, 0x19);
}

/**
 * 计算GB/GBC头部校验和
 */
export function calculateGBChecksum(data: Uint8Array): number {
  // GB range: 0x134–0x14C = 25 bytes; -(sum + 25) & 0xFF ≡ -(sum + 0x19) & 0xFF
  return calculateHeaderChecksum(data, GB_HEADER.CHECKSUM_START, GB_HEADER.CHECKSUM_END, GB_HEADER.CHECKSUM_END - GB_HEADER.CHECKSUM_START + 1);
}

/**
 * 计算GB/GBC全局校验和
 * @param data ROM数据
 * @returns 全局校验和
 */
export function calculateGBGlobalChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    // 跳过校验和字节
    if (i !== GB_HEADER.GLOBAL_CHECKSUM_HIGH && i !== GB_HEADER.GLOBAL_CHECKSUM_LOW) {
      sum += data[i];
    }
  }
  return sum & 0xFFFF;
}

/**
 * 编码字符串到指定长度的字节数组，自动补齐或截取
 * @param str 字符串
 * @param length 目标长度
 * @param padding 填充字符，默认为空格
 * @returns 字节数组
 */
export function encodeStringToBytes(str: string, length: number, padding = ' '): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  // 如果字节长度超出，截取前 length 个字节
  if (encoded.length >= length) {
    return encoded.slice(0, length);
  }
  // 否则创建指定长度数组并填充编码字节
  const bytes = new Uint8Array(length);
  bytes.set(encoded);
  // 使用 UTF-8 编码的填充字符补齐
  const padBytes = encoder.encode(padding);
  let offset = encoded.length;
  while (offset < length) {
    for (let i = 0; i < padBytes.length && offset < length; i++) {
      bytes[offset++] = padBytes[i];
    }
  }
  return bytes;
}

/**
 * 解析区域代码到单字符
 * @param region 区域名称
 * @returns 区域代码字符
 */
export function regionToCode(region: string): string {
  const regionMap: Record<string, string> = {
    'Japan': 'J',
    'USA': 'E',
    'Europe': 'P',
    'Germany': 'D',
    'France': 'F',
    'Italy': 'I',
    'Spain': 'S',
  };
  return regionMap[region] || 'E'; // 默认USA
}

/**
 * 清理字符串，移除非法文件名字符
 * @param str 输入字符串
 * @returns 清理后的字符串
 */
export function sanitizeString(str: string): string {
  if (!str) return '';

  const cleaned = str
    .replace(/\uFFFD/g, '') // Unicode 替换字符
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 控制字符
    .replace(/[<>:"/\\|?*]/g, '') // 移除文件系统不允许的字符
    .replace(/ /g, '_') // 空格替换为下划线
    .replace(/^\.+|\.+$/g, ''); // 移除前后的点

  return cleaned || '';
}

/**
 * 检测并解析ROM文件
 * @param data ROM数据
 * @returns ROM信息
 */
export function parseRom(data: Uint8Array): RomInfo {
  if (!data || data.length === 0) {
    return INVALID_ROM_INFO(data.length);
  }

  const romType = detectRomType(data);

  switch (romType) {
    case 'GBA':
      return parseGBARom(data);
    case 'GB':
      return parseGBRom(data);
    default:
      return INVALID_ROM_INFO(data.length);
  }
}

/**
 * 从 ROM 数据检测 MBC 类型
 * 基于 GB/GBC ROM header 0x147 字节的卡带类型
 * @param romData - ROM 数据（至少需要 0x148 字节）
 * @returns MBC 类型字符串，如果无法检测则返回 'MBC5'（默认值）
 */
export interface MbcDetectionResult {
  mbcType: MbcType;
  isFallback: boolean;
}

export function detectMbcTypeFromRom(romData: Uint8Array): MbcDetectionResult {
  // 确保数据足够长
  if (romData.length < GB_HEADER.CART_TYPE_OFFSET + 1) {
    return { mbcType: 'MBC5', isFallback: true };
  }

  // 读取卡带类型字节
  const cartType = romData[GB_HEADER.CART_TYPE_OFFSET];

  // MBC1 类型 ID
  const MBC1_IDS = [0x01, 0x02, 0x03];
  // MBC2 类型 ID
  const MBC2_IDS = [0x05, 0x06];
  // MBC3 类型 ID
  const MBC3_IDS = [0x0f, 0x10, 0x11, 0x12, 0x13];
  // MBC5 类型 ID
  const MBC5_IDS = [0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e];

  if (MBC5_IDS.includes(cartType)) {
    return { mbcType: 'MBC5', isFallback: false };
  } else if (MBC3_IDS.includes(cartType)) {
    return { mbcType: 'MBC3', isFallback: false };
  } else if (MBC2_IDS.includes(cartType)) {
    return { mbcType: 'MBC2', isFallback: false };
  } else if (MBC1_IDS.includes(cartType)) {
    return { mbcType: 'MBC1', isFallback: false };
  }

  // 默认返回 MBC5
  return { mbcType: 'MBC5', isFallback: true };
}

export function detectMbcType(romData: Uint8Array): MbcType {
  return detectMbcTypeFromRom(romData).mbcType;
}
