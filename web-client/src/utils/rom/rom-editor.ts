/**
 * ROM编辑工具
 * 用于修改ROM信息并更新校验和
 */

import { GB_HEADER, GBA_HEADER } from '@/utils/parsers/constants';
import {
  calculateGBAChecksum,
  calculateGBChecksum,
  calculateGBGlobalChecksum,
  encodeStringToBytes,
  GB_NINTENDO_LOGO,
  GBA_NINTENDO_LOGO,
  regionToCode,
  validateGBALogo,
  validateGBLogo,
} from '@/utils/parsers/rom-parser';

export interface RomEditData {
  title: string;
  gameCode: string;
  makerCode: string;
  version: number;
  region: string;
}

/**
 * 更新GBA ROM信息
 * @param data 原始ROM数据
 * @param editData 要修改的数据
 * @returns 修改后的ROM数据
 */
export function updateGBARom(data: Uint8Array, editData: RomEditData): Uint8Array {
  const newData = new Uint8Array(data);

  // 如果 logo 不符合要求，也更新 logo 数据
  if (!validateGBALogo(newData)) {
    newData.set(GBA_NINTENDO_LOGO, GBA_HEADER.LOGO_OFFSET);
  }

  // 更新标题 (12字节)
  const titleBytes = encodeStringToBytes(editData.title, 12);
  newData.set(titleBytes, GBA_HEADER.TITLE_OFFSET);

  // 更新游戏代码和区域代码 (4字节)
  let gameCode = editData.gameCode || new TextDecoder('ascii').decode(data.slice(GBA_HEADER.GAME_CODE_OFFSET, GBA_HEADER.GAME_CODE_END)).replace(/\0/g, '') || '    ';

  // 如果提供了区域代码，更新gameCode的第4位
  if (editData.region) {
    const regionCode = regionToCode(editData.region);
    gameCode = gameCode.substring(0, 3).padEnd(3, ' ') + regionCode;
  }

  // 写入游戏代码
  newData.set(encodeStringToBytes(gameCode, 4), GBA_HEADER.GAME_CODE_OFFSET);

  // 更新制造商代码 (2字节)
  newData.set(encodeStringToBytes(editData.makerCode, 2), GBA_HEADER.MAKER_CODE_OFFSET);

  // 更新版本号
  newData[GBA_HEADER.VERSION_OFFSET] = editData.version & 0xFF;

  // 重新计算并更新头部校验和
  const checksum = calculateGBAChecksum(newData);
  newData[GBA_HEADER.CHECKSUM_OFFSET] = checksum;

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

  // 如果 logo 不符合要求，也更新 logo 数据
  if (!validateGBLogo(newData)) {
    newData.set(GB_NINTENDO_LOGO, GB_HEADER.LOGO_OFFSET);
  }

  // 检查是否为CGB
  const cgbFlag = data[GB_HEADER.CGB_FLAG_OFFSET];
  const isColorGB = cgbFlag === 0x80 || cgbFlag === 0xC0;

  // 更新标题
  const titleEnd = isColorGB ? GB_HEADER.TITLE_END : GB_HEADER.TITLE_END + 1;
  const maxTitleLength = titleEnd - GB_HEADER.TITLE_OFFSET;

  // 清空并写入新标题
  for (let i = GB_HEADER.TITLE_OFFSET; i < titleEnd; i++) newData[i] = 0;
  newData.set(encodeStringToBytes(editData.title, maxTitleLength, '\0'), GB_HEADER.TITLE_OFFSET);

  // 更新制造商代码 (新格式)
  for (let i = GB_HEADER.MAKER_CODE_OFFSET; i < GB_HEADER.MAKER_CODE_END; i++) newData[i] = 0;
  newData.set(encodeStringToBytes(editData.makerCode, 4, '\0'), GB_HEADER.MAKER_CODE_OFFSET);

  // 更新版本号
  newData[GB_HEADER.VERSION_OFFSET] = editData.version & 0xFF;

  // 更新区域代码
  if (editData.region) {
    const regionCode = editData.region === 'Japan' ? 0x00 : 0x01;
    newData[GB_HEADER.REGION_OFFSET] = regionCode;
  }

  // 重新计算并更新头部校验和
  const headerChecksum = calculateGBChecksum(newData);
  newData[GB_HEADER.HEADER_CHECKSUM_OFFSET] = headerChecksum;

  // 重新计算并更新全局校验和
  const globalChecksum = calculateGBGlobalChecksum(newData);
  newData[GB_HEADER.GLOBAL_CHECKSUM_HIGH] = (globalChecksum >> 8) & 0xFF;
  newData[GB_HEADER.GLOBAL_CHECKSUM_LOW] = globalChecksum & 0xFF;

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
