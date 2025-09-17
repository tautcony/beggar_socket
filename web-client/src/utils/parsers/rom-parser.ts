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
 * 验证GBA Nintendo Logo
 * @param data ROM数据
 * @returns 是否匹配
 */
export function validateGBALogo(data: Uint8Array): boolean {
  if (data.length < 0x04 + GBA_NINTENDO_LOGO.length) {
    return false;
  }

  for (let i = 0; i < GBA_NINTENDO_LOGO.length; i++) {
    if (data[0x04 + i] !== GBA_NINTENDO_LOGO[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 验证GB/GBC Nintendo Logo
 * @param data ROM数据
 * @returns 是否匹配
 */
export function validateGBLogo(data: Uint8Array): boolean {
  if (data.length < 0x104 + GB_NINTENDO_LOGO.length) {
    return false;
  }

  for (let i = 0; i < GB_NINTENDO_LOGO.length; i++) {
    if (data[0x104 + i] !== GB_NINTENDO_LOGO[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 解析GBA ROM信息
 * @param data ROM数据
 * @returns GBA ROM信息
 */
function parseGBARom(data: Uint8Array): RomInfo {
  if (data.length < 0xC0) {
    return INVALID_ROM_INFO(data.length);
  }

  // GBA ROM标题位置：0xA0-0xAB (12字节)
  const titleBytes = data.slice(0xA0, 0xAC);
  const title = new TextDecoder('utf-8').decode(titleBytes).replace(/\0/g, '').trim();

  // 游戏代码：0xAC-0xAF (4字节)
  const gameCodeBytes = data.slice(0xAC, 0xB0);
  const gameCode = new TextDecoder('ascii').decode(gameCodeBytes).replace(/\0/g, '');

  // 制造商代码：0xB0-0xB1 (2字节)
  const makerCodeBytes = data.slice(0xB0, 0xB2);
  const makerCode = new TextDecoder('ascii').decode(makerCodeBytes).replace(/\0/g, '');

  // 版本号：0xBC
  const version = data[0xBC];

  // 头部校验和：0xBD
  const checksumHeader = data[0xBD];

  // 验证GBA ROM有效性
  const hasValidSignature = data[0xB2] === 0x96; // 固定字节0x96
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

  // 提取Logo数据 (0x04-0x9F, 156字节)
  const logoData = data.slice(0x04, 0x04 + GBA_NINTENDO_LOGO.length);

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
  if (data.length < 0x150) {
    return INVALID_ROM_INFO(data.length);
  }

  // GB ROM标题位置：0x134-0x143 (16字节，但0x143可能是CGB标志)
  let titleEnd = 0x143;

  // 检查CGB标志
  const cgbFlag = data[0x143];
  const isColorGB = cgbFlag === 0x80 || cgbFlag === 0xC0;

  if (isColorGB) {
    titleEnd = 0x143; // CGB游戏标题到0x142
  }

  const titleBytes = data.slice(0x134, titleEnd);
  const title = new TextDecoder('utf-8').decode(titleBytes).replace(/\0/g, '').trim();

  // 制造商代码：0x13F-0x142 (新格式) 或包含在标题中 (旧格式)
  let makerCode = '';
  if (data[0x13F] !== 0x00 || data[0x140] !== 0x00) {
    const makerBytes = data.slice(0x13F, 0x143);
    makerCode = new TextDecoder('ascii').decode(makerBytes).replace(/\0/g, '');
  }

  // 许可证代码：0x144-0x145
  const licenseCode = (data[0x144] << 8) | data[0x145];

  // SGB标志：0x146
  const sgbFlag = data[0x146];

  // 卡带类型：0x147
  const cartridgeType = data[0x147];

  // ROM大小：0x148
  const romSizeCode = data[0x148];
  const romSize = romSizeCode < 8 ? (32 * 1024) << romSizeCode : data.length;

  // RAM大小：0x149
  const ramSizeMapper = {
    0: 0, // No RAM
    1: 0, // Unused
    2: 8 * 1024, // 8 KiB
    3: 32 * 1024, // 32 KiB
    4: 128 * 1024, // 128 KiB
    5: 64 * 1024, // 64 KiB
  };
  const ramSizeCode = data[0x149] as 0 | 1 | 2 | 3 | 4 | 5;
  const ramSize = ramSizeMapper[ramSizeCode] ?? 0;

  const regionCode = data[0x14A];
  let region = 'Unknown';
  switch (regionCode) {
    case 0x00: region = 'Japan'; break;
    case 0x01: region = 'Non-Japan'; break;
    default: region = 'Unknown'; break;
  }

  // 版本号：0x14C
  const version = data[0x14C];

  // 头部校验和：0x14D
  const checksumHeader = data[0x14D];

  // 全局校验和：0x14E-0x14F
  const checksumGlobal = (data[0x14E] << 8) | data[0x14F];

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

  // 提取Logo数据 (0x104-0x133, 48字节)
  const logoData = data.slice(0x104, 0x104 + GB_NINTENDO_LOGO.length);

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
  if (data.length >= 0xB3 && data[0xB2] === 0x96) {
    // 如果有GBA固定签名字节，进一步验证Nintendo Logo
    if (validateGBALogo(data)) {
      return 'GBA';
    }
  }

  // 检查GB/GBC特征
  if (data.length >= 0x150 && validateGBLogo(data)) {
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
 * @param data ROM数据
 * @returns 校验和
 */
export function calculateGBAChecksum(data: Uint8Array): number {
  let headerSum = 0;
  for (let i = 0xA0; i <= 0xBC; i++) {
    headerSum += data[i];
  }
  return (-(headerSum + 0x19)) & 0xFF;
}

/**
 * 计算GB/GBC头部校验和
 * @param data ROM数据
 * @returns 校验和
 */
export function calculateGBChecksum(data: Uint8Array): number {
  let checksum = 0;
  for (let i = 0x134; i <= 0x14C; i++) {
    checksum = checksum - data[i] - 1;
  }
  return checksum & 0xFF;
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
    if (i !== 0x14E && i !== 0x14F) {
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
