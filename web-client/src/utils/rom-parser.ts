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
  size: number;
  checksumHeader?: number;
  checksumGlobal?: number;
  isValid: boolean;
  region?: string;
}

/**
 * 解析GBA ROM信息
 * @param data ROM数据
 * @returns GBA ROM信息
 */
function parseGBARom(data: Uint8Array): RomInfo {
  if (data.length < 0xC0) {
    return {
      title: 'Invalid ROM',
      type: 'Unknown',
      size: data.length,
      isValid: false,
    };
  }

  // GBA ROM标题位置：0xA0-0xAB (12字节)
  const titleBytes = data.slice(0xA0, 0xAC);
  const title = new TextDecoder('ascii').decode(titleBytes).replace(/\0/g, '').trim();

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

  // 验证GBA ROM签名
  const isValid = data[0xB2] === 0x96; // 固定字节0x96

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

  return {
    title: title || 'Untitled',
    gameCode,
    makerCode,
    version,
    type: 'GBA',
    size: data.length,
    checksumHeader,
    isValid,
    region,
  };
}

/**
 * 解析GB/GBC ROM信息
 * @param data ROM数据
 * @returns GB/GBC ROM信息
 */
function parseGBRom(data: Uint8Array): RomInfo {
  if (data.length < 0x150) {
    return {
      title: 'Invalid ROM',
      type: 'Unknown',
      size: data.length,
      isValid: false,
    };
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
  const title = new TextDecoder('ascii').decode(titleBytes).replace(/\0/g, '').trim();

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

  // 头部校验和：0x14D
  const checksumHeader = data[0x14D];

  // 全局校验和：0x14E-0x14F
  const checksumGlobal = (data[0x14E] << 8) | data[0x14F];

  // 验证头部校验和
  let headerSum = 0;
  for (let i = 0x134; i <= 0x14C; i++) {
    headerSum = (headerSum - data[i] - 1) & 0xFF;
  }
  const isValid = headerSum === checksumHeader;

  // 确定ROM类型
  let type: 'GB' | 'GBC' = 'GB';
  if (isColorGB) {
    type = 'GBC';
  }

  return {
    title: title || 'Untitled',
    makerCode,
    type,
    size: romSize,
    checksumHeader,
    checksumGlobal,
    isValid,
  };
}

/**
 * 检测并解析ROM文件
 * @param data ROM数据
 * @returns ROM信息
 */
export function parseRom(data: Uint8Array): RomInfo {
  if (!data || data.length === 0) {
    return {
      title: 'Empty ROM',
      type: 'Unknown',
      size: 0,
      isValid: false,
    };
  }

  // 检测ROM类型
  // GBA ROM通常较大 (>1MB) 且在0xB2处有固定字节0x96
  if (data.length > 0x200000 || (data.length >= 0xB3 && data[0xB2] === 0x96)) {
    return parseGBARom(data);
  }

  // GB/GBC ROM检测：检查Nintendo标志
  if (data.length >= 0x150) {
    // Nintendo标志位于0x104-0x133
    const nintendoLogo = [
      0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
      0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
      0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E,
    ];

    let logoMatch = true;
    for (let i = 0; i < nintendoLogo.length; i++) {
      if (data[0x104 + i] !== nintendoLogo[i]) {
        logoMatch = false;
        break;
      }
    }

    if (logoMatch) {
      return parseGBRom(data);
    }
  }

  // 如果都不匹配，返回未知类型
  return {
    title: 'Unknown ROM',
    type: 'Unknown',
    size: data.length,
    isValid: false,
  };
}

/**
 * 格式化ROM信息为显示文本
 * @param romInfo ROM信息
 * @returns 格式化的文本
 */
export function formatRomInfo(romInfo: RomInfo): string {
  const lines: string[] = [];

  lines.push(`标题: ${romInfo.title}`);
  lines.push(`类型: ${romInfo.type}`);

  if (romInfo.gameCode) {
    lines.push(`游戏代码: ${romInfo.gameCode}`);
  }

  if (romInfo.makerCode) {
    lines.push(`制造商: ${romInfo.makerCode}`);
  }

  if (romInfo.version !== undefined) {
    lines.push(`版本: ${romInfo.version}`);
  }

  if (romInfo.region) {
    lines.push(`地区: ${romInfo.region}`);
  }

  lines.push(`大小: ${(romInfo.size / 1024 / 1024).toFixed(2)} MB`);
  lines.push(`有效: ${romInfo.isValid ? '是' : '否'}`);

  return lines.join('\n');
}
