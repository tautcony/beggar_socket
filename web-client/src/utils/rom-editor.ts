/**
 * ROM编辑工具
 * 用于修改ROM信息并更新校验和
 */

export interface RomEditData {
  title: string;
  gameCode: string;
  makerCode: string;
  version: number;
  region: string;
}

/**
 * 计算GBA头部校验和
 * @param data ROM数据
 * @returns 校验和
 */
function calculateGBAChecksum(data: Uint8Array): number {
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
function calculateGBChecksum(data: Uint8Array): number {
  let headerSum = 0;
  for (let i = 0x134; i <= 0x14C; i++) {
    headerSum += data[i];
  }
  return (-headerSum - 1) & 0xFF;
}

/**
 * 计算GB/GBC全局校验和
 * @param data ROM数据
 * @returns 全局校验和
 */
function calculateGBGlobalChecksum(data: Uint8Array): number {
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
function encodeStringToBytes(str: string, length: number, padding = ' '): Uint8Array {
  const bytes = new Uint8Array(length);
  // 确保字符串长度正确：不足则补齐，超出则截取
  const normalizedStr = str.length < length ? str.padEnd(length, padding) : str.substring(0, length);
  const encoded = new TextEncoder().encode(normalizedStr);
  bytes.set(encoded);
  return bytes;
}

/**
 * 解析区域代码到单字符
 * @param region 区域名称
 * @returns 区域代码字符
 */
function regionToCode(region: string): string {
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
 * 更新GBA ROM信息
 * @param data 原始ROM数据
 * @param editData 要修改的数据
 * @returns 修改后的ROM数据
 */
export function updateGBARom(data: Uint8Array, editData: RomEditData): Uint8Array {
  const newData = new Uint8Array(data);

  // 更新标题 (0xA0-0xAB, 12字节)
  const titleBytes = encodeStringToBytes(editData.title, 12);
  newData.set(titleBytes, 0xA0);

  // 更新游戏代码和区域代码 (0xAC-0xAF, 4字节)
  let gameCode = editData.gameCode || new TextDecoder('ascii').decode(data.slice(0xAC, 0xB0)).replace(/\0/g, '') || '    ';

  // 如果提供了区域代码，更新gameCode的第4位
  if (editData.region) {
    const regionCode = regionToCode(editData.region);
    gameCode = gameCode.substring(0, 3).padEnd(3, ' ') + regionCode;
  }

  // 写入游戏代码
  newData.set(encodeStringToBytes(gameCode, 4), 0xAC);

  // 更新制造商代码 (0xB0-0xB1, 2字节)
  newData.set(encodeStringToBytes(editData.makerCode, 2), 0xB0);

  // 更新版本号 (0xBC)
  newData[0xBC] = editData.version & 0xFF;

  // 重新计算并更新头部校验和 (0xBD)
  const checksum = calculateGBAChecksum(newData);
  newData[0xBD] = checksum;

  return newData;
}

/**
 * 更新GB/GBC ROM信息
 * @param data 原始ROM数据
 * @param editData 要修改的数据
 * @returns 修改后的ROM数据
 */
export function updateGBRom(data: Uint8Array, editData: RomEditData): Uint8Array {
  const newData = new Uint8Array(data);

  // 检查是否为CGB
  const cgbFlag = data[0x143];
  const isColorGB = cgbFlag === 0x80 || cgbFlag === 0xC0;

  // 更新标题 (0x134-0x142/0x143)
  const titleEnd = isColorGB ? 0x143 : 0x144;
  const maxTitleLength = titleEnd - 0x134;

  // 清空并写入新标题
  for (let i = 0x134; i < titleEnd; i++) newData[i] = 0;
  newData.set(encodeStringToBytes(editData.title, maxTitleLength, '\0'), 0x134);

  // 更新制造商代码 (0x13F-0x142, 新格式)
  for (let i = 0x13F; i < 0x143; i++) newData[i] = 0;
  newData.set(encodeStringToBytes(editData.makerCode, 4, '\0'), 0x13F);

  // GB/GBC没有直接的版本字段，可以考虑在标题中包含版本信息
  // 或者使用ROM版本号字段（如果存在的话）

  // 重新计算并更新头部校验和 (0x14D)
  const headerChecksum = calculateGBChecksum(newData);
  newData[0x14D] = headerChecksum;

  // 重新计算并更新全局校验和 (0x14E-0x14F)
  const globalChecksum = calculateGBGlobalChecksum(newData);
  newData[0x14E] = (globalChecksum >> 8) & 0xFF;
  newData[0x14F] = globalChecksum & 0xFF;

  return newData;
}

/**
 * 更新ROM信息的通用函数
 * @param data 原始ROM数据
 * @param romType ROM类型
 * @param editData 要修改的数据
 * @returns 修改后的ROM数据
 */
export function updateRomInfo(data: Uint8Array, romType: 'GBA' | 'GB' | 'GBC', editData: RomEditData): Uint8Array {
  if (romType === 'GBA') {
    return updateGBARom(data, editData);
  } else {
    return updateGBRom(data, editData);
  }
}
