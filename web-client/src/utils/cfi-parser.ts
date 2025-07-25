import { formatBytes, formatHex } from '@/utils/formatter-utils';

/**
 * CFI解析结果接口
 */
export interface CFIInfo {
  /** Flash ID (前8字节) */
  flashId: Uint8Array;
  /** CFI魔数标识 "QRY" */
  magic: string;
  /** 数据交换信息 */
  dataSwap: [number, number][] | null;
  /** VDD最小电压 */
  vddMin: number;
  /** VDD最大电压 */
  vddMax: number;
  /** 是否支持单字节写入 */
  singleWrite: boolean;
  /** 单字节写入平均时间 (微秒) */
  singleWriteTimeAvg?: number;
  /** 单字节写入最大时间 (微秒) */
  singleWriteTimeMax?: number;
  /** 是否支持缓冲写入 */
  bufferWrite: boolean;
  /** 缓冲写入大小 (字节) */
  bufferSize?: number;
  /** 缓冲写入平均时间 (微秒) */
  bufferWriteTimeAvg?: number;
  /** 缓冲写入最大时间 (微秒) */
  bufferWriteTimeMax?: number;
  /** 是否支持扇区擦除 */
  sectorErase: boolean;
  /** 扇区擦除平均时间 (毫秒) */
  sectorEraseTimeAvg?: number;
  /** 扇区擦除最大时间 (毫秒) */
  sectorEraseTimeMax?: number;
  /** 是否支持芯片擦除 */
  chipErase: boolean;
  /** 芯片擦除平均时间 (毫秒) */
  chipEraseTimeAvg?: number;
  /** 芯片擦除最大时间 (毫秒) */
  chipEraseTimeMax?: number;
  /** 引导扇区信息 */
  tbBootSector: string | boolean;
  /** 引导扇区原始值 */
  tbBootSectorRaw: number;
  /** 设备大小 (字节) */
  deviceSize: number;
  /** 擦除扇区区域数量 */
  eraseSectorRegions: number;
  /** 擦除扇区块信息 [扇区大小, 扇区数量, 总大小][] */
  eraseSectorBlocks: [number, number, number][];
  /** 格式化的信息字符串 */
  info: string;
}

/**
 * 位交换辅助函数
 * @param byte - 要交换的字节
 * @param swaps - 交换位对 [bit1, bit2][]
 * @returns 交换后的字节
 */
function bitswap(byte: number, swaps: [number, number][]): number {
  let result = byte;

  for (const [bit1, bit2] of swaps) {
    const mask1 = 1 << bit1;
    const mask2 = 1 << bit2;

    const val1 = (result & mask1) !== 0;
    const val2 = (result & mask2) !== 0;

    if (val1 !== val2) {
      result ^= mask1 | mask2;
    }
  }

  return result;
}

/**
 * CFI解析器类
 */
export class CFIParser {
  /**
   * 解析CFI数据
   * @param buffer - CFI查询返回的数据缓冲区
   * @returns CFI信息对象，如果解析失败返回false
   */
  parse(buffer: Uint8Array | false): CFIInfo | false {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // 创建缓冲区副本
    const workBuffer = new Uint8Array(buffer);
    const info: Partial<CFIInfo> = {};

    // 检查魔数以确定数据交换模式
    const magic = String.fromCharCode(workBuffer[0x20]) +
                  String.fromCharCode(workBuffer[0x22]) +
                  String.fromCharCode(workBuffer[0x24]);

    if (magic === 'QRY') {
      // 正常模式，无交换
      info.dataSwap = [[0, 0]];
    } else if (magic === 'RQZ') {
      // D0D1 交换
      info.dataSwap = [[0, 1]];
    } else if (magic === '\x92\x91\x9A') {
      // D0D1+D6D7 交换
      info.dataSwap = [[0, 1], [6, 7]];
    } else {
      return false;
    }

    // 应用位交换
    if (info.dataSwap && info.dataSwap[0][0] !== info.dataSwap[0][1]) {
      for (const swap of info.dataSwap) {
        for (let i = 0; i < workBuffer.length; i++) {
          workBuffer[i] = bitswap(workBuffer[i], [swap]);
        }
      }
    }

    try {
      // 提取Flash ID
      info.flashId = workBuffer.slice(0, 8);

      // 重新读取魔数
      info.magic = String.fromCharCode(workBuffer[0x20]) +
                   String.fromCharCode(workBuffer[0x22]) +
                   String.fromCharCode(workBuffer[0x24]);

      // 检查电压范围信息
      if (workBuffer[0x36] === 0xFF && workBuffer[0x48] === 0xFF) {
        console.error('FAIL: No information about the voltage range found in CFI data.');
        return false;
      }

      // 获取主要地址
      let priAddress = (workBuffer[0x2A] | (workBuffer[0x2C] << 8)) * 2;
      if ((priAddress + 0x3C) >= 0x400) {
        priAddress = 0x80;
      }

      // 解析电压范围
      info.vddMin = (workBuffer[0x36] >> 4) + ((workBuffer[0x36] & 0x0F) / 10);
      info.vddMax = (workBuffer[0x38] >> 4) + ((workBuffer[0x38] & 0x0F) / 10);

      // 解析写入时间信息
      if (workBuffer[0x3E] > 0 && workBuffer[0x3E] < 0xFF) {
        info.singleWrite = true;
        info.singleWriteTimeAvg = Math.pow(2, workBuffer[0x3E]);
        info.singleWriteTimeMax = Math.pow(2, workBuffer[0x46]) * info.singleWriteTimeAvg;
      } else {
        info.singleWrite = false;
      }

      // 解析缓冲写入信息
      if (workBuffer[0x40] > 0 && workBuffer[0x40] < 0xFF) {
        info.bufferWrite = true;
        info.bufferWriteTimeAvg = Math.pow(2, workBuffer[0x40]);
        info.bufferWriteTimeMax = Math.pow(2, workBuffer[0x48]) * info.bufferWriteTimeAvg;
      } else {
        info.bufferWrite = false;
      }

      // 解析扇区擦除时间
      if (workBuffer[0x42] > 0 && workBuffer[0x42] < 0xFF) {
        info.sectorErase = true;
        info.sectorEraseTimeAvg = Math.pow(2, workBuffer[0x42]);
        info.sectorEraseTimeMax = Math.pow(2, workBuffer[0x4A]) * info.sectorEraseTimeAvg;
      } else {
        info.sectorErase = false;
      }

      // 解析芯片擦除时间
      if (workBuffer[0x44] > 0 && workBuffer[0x44] < 0xFF) {
        info.chipErase = true;
        info.chipEraseTimeAvg = Math.pow(2, workBuffer[0x44]);
        info.chipEraseTimeMax = Math.pow(2, workBuffer[0x4C]) * info.chipEraseTimeAvg;
      } else {
        info.chipErase = false;
      }

      // 解析引导扇区信息
      info.tbBootSector = false;
      info.tbBootSectorRaw = 0;

      if (String.fromCharCode(workBuffer[priAddress]) +
          String.fromCharCode(workBuffer[priAddress + 2]) +
          String.fromCharCode(workBuffer[priAddress + 4]) === 'PRI') {
        if (workBuffer[priAddress + 0x1E] !== 0 && workBuffer[priAddress + 0x1E] !== 0xFF) {
          const bootSectorTypes: Record<number, string> = {
            0x02: 'As shown',
            0x03: 'Reversed',
          };
          info.tbBootSectorRaw = workBuffer[priAddress + 0x1E];
          info.tbBootSector = bootSectorTypes[workBuffer[priAddress + 0x1E]] ||
            formatHex(workBuffer[priAddress + 0x1E], 1);
          if (bootSectorTypes[workBuffer[priAddress + 0x1E]]) {
            info.tbBootSector += ` (${formatHex(workBuffer[priAddress + 0x1E], 1)})`;
          }
        }
      }

      // 解析设备大小
      info.deviceSize = Math.pow(2, workBuffer[0x4E]);

      // 解析缓冲区大小
      const bufferSizeValue = (workBuffer[0x56] << 8) | workBuffer[0x54];
      if (bufferSizeValue > 1) {
        info.bufferWrite = true;
        info.bufferSize = Math.pow(2, bufferSizeValue);
      } else {
        info.bufferWrite = false;
      }

      // 解析擦除扇区区域
      info.eraseSectorRegions = workBuffer[0x58];
      info.eraseSectorBlocks = [];

      let totalBlocks = 0;
      let pos = 0;

      for (let i = 0; i < Math.min(4, info.eraseSectorRegions); i++) {
        const b = ((workBuffer[0x5C + (i * 8)] << 8) | workBuffer[0x5A + (i * 8)]) + 1;
        const t = ((workBuffer[0x60 + (i * 8)] << 8) | workBuffer[0x5E + (i * 8)]) * 256;
        totalBlocks += b;
        const size = b * t;
        pos += size;
        info.eraseSectorBlocks.push([t, b, size]);
      }

      // 生成信息摘要
      info.info = this.generateInfoString(info as CFIInfo);

      return info as CFIInfo;

    } catch (error) {
      console.error('ERROR: Trying to parse CFI data resulted in an error:', error);
      return false;
    }
  }

  /**
   * 生成格式化的信息字符串
   * @param info - CFI信息对象
   * @returns 格式化的信息字符串
   */
  private generateInfoString(info: CFIInfo): string {
    const lines: string[] = [];

    // 显示数据交换信息
    if (info.dataSwap && info.dataSwap.length > 0 &&
        !(info.dataSwap.length === 1 && info.dataSwap[0][0] === 0 && info.dataSwap[0][1] === 0)) {
      lines.push(`Swapped pins: ${JSON.stringify(info.dataSwap)}`);
    }

    // 设备信息
    lines.push(`Device size: ${formatHex(info.deviceSize, 4)} (${formatBytes(info.deviceSize)})`);
    lines.push(`Voltage: ${info.vddMin.toFixed(1)}–${info.vddMax.toFixed(1)} V`);
    lines.push(`Single write: ${info.singleWrite}`);

    // 缓冲写入信息
    const bufferWriteInfo = info.bufferSize !== undefined
      ? `Buffered write: ${info.bufferWrite} (${info.bufferSize} Bytes)`
      : `Buffered write: ${info.bufferWrite}`;
    lines.push(bufferWriteInfo);

    // 时间信息
    if (info.chipErase && info.chipEraseTimeAvg && info.chipEraseTimeMax) {
      lines.push(`Chip erase: ${info.chipEraseTimeAvg}–${info.chipEraseTimeMax} ms`);
    }
    if (info.sectorErase && info.sectorEraseTimeAvg && info.sectorEraseTimeMax) {
      lines.push(`Sector erase: ${info.sectorEraseTimeAvg}–${info.sectorEraseTimeMax} ms`);
    }

    // 引导扇区信息
    if (info.tbBootSector !== false) {
      lines.push(`Sector flags: ${info.tbBootSector}`);
    }

    // 扇区区域信息
    let currentPos = 0;
    let oversize = false;

    for (let i = 0; i < info.eraseSectorRegions; i++) {
      const esb = info.eraseSectorBlocks[i];
      const sectorSize = formatHex(esb[0], 2);
      const sectorCount = esb[1];
      const regionSizeBytes = esb[2];

      const addressRange = formatHex(currentPos, 3) + '-' +
                            formatHex(currentPos + regionSizeBytes - 1, 3);
      const regionInfo = `Region ${i + 1}: ${addressRange} @ ${sectorSize} Bytes × ${sectorCount}${oversize ? ' (alt)' : ''}`;
      lines.push(regionInfo);

      currentPos += regionSizeBytes;
      if (currentPos >= info.deviceSize) {
        currentPos = 0;
        oversize = true;
      }
    }

    return lines.join('\n');
  }
}

/**
 * 便捷函数：解析CFI数据
 * @param buffer - CFI查询返回的数据缓冲区
 * @returns CFI信息对象，如果解析失败返回false
 */
export function parseCFI(buffer: Uint8Array | false): CFIInfo | false {
  const parser = new CFIParser();
  return parser.parse(buffer);
}
