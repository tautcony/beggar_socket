import { formatBytes, formatHex } from '@/utils/formatter-utils';

/**
 * 擦除扇区块信息接口
 */
export interface SectorBlock {
  /** 扇区大小 (字节) */
  sectorSize: number;
  /** 扇区数量 */
  sectorCount: number;
  /** 区域总大小 (字节) */
  totalSize: number;
  /** 起始地址 */
  startAddress: number;
  /** 结束地址 */
  endAddress: number;
}

/**
 * Flash检测特性信息接口
 */
export interface FlashDetectionInfo {
  /** 是否交换D0和D1数据线 */
  isSwapD0D1: boolean;
  /** 是否为Intel Flash */
  isIntel: boolean;
  /** CFI检测是否成功 */
  cfiDetected: boolean;
}

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
  /** Flash检测特性信息 */
  detection: FlashDetectionInfo;
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
  /** 擦除扇区块信息 */
  eraseSectorBlocks: SectorBlock[];
  /** 是否需要反转扇区区域 */
  reverseSectorRegion: boolean;
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
   * 检测Flash特性（基于C++逻辑）
   * @param buffer - CFI查询返回的数据缓冲区
   * @returns Flash检测特性信息
   */
  private detectFlashCharacteristics(buffer: Uint8Array): FlashDetectionInfo {
    const detection: FlashDetectionInfo = {
      isSwapD0D1: false,
      isIntel: false,
      cfiDetected: false,
    };

    // 检查CFI魔数以确定数据交换模式（基于C++ _check_cfi逻辑）
    const q = buffer[0x20]; // 'Q' = 0x51
    const r = buffer[0x22]; // 'R' = 0x52
    const y = buffer[0x24]; // 'Y' = 0x59

    // 正常CFI响应
    if (q === 0x51 && r === 0x52 && y === 0x59) {
      detection.isSwapD0D1 = false;
      detection.cfiDetected = true;
    } else if (this.swapD0D1(q) === 0x51 && this.swapD0D1(r) === 0x52 && this.swapD0D1(y) === 0x59) {
      // D0D1交换后的CFI响应（SWAP_D0D1宏逻辑：交换bit0和bit1）
      detection.isSwapD0D1 = true;
      detection.cfiDetected = true;
    } else {
      detection.cfiDetected = false;
    }

    // TODO: Intel Flash检测逻辑可以在这里扩展
    // 基于C++中的get_flashid_auto逻辑，需要额外的Flash ID检测
    detection.isIntel = false;

    return detection;
  }

  /**
   * D0D1位交换函数（对应C++ SWAP_D0D1宏）
   * @param value - 要交换的值
   * @returns 交换D0D1位后的值
   */
  private swapD0D1(value: number): number {
    const bit0 = (value & 0x01) !== 0;
    const bit1 = (value & 0x02) !== 0;

    let result = value;
    if (bit0 !== bit1) {
      result ^= 0x03; // 交换bit0和bit1
    }

    return result;
  }
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

    // 检测Flash特性
    info.detection = this.detectFlashCharacteristics(workBuffer);

    if (!info.detection.cfiDetected) {
      return false;
    }

    // 根据检测结果设置数据交换模式
    if (info.detection.isSwapD0D1) {
      info.dataSwap = [[0, 1]];
    } else {
      info.dataSwap = [[0, 0]];
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
      info.reverseSectorRegion = false;

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
          // 判断是否需要反转扇区区域
          info.reverseSectorRegion = workBuffer[priAddress + 0x1E] === 0x03;
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

      const regionInfo: { sectorCount: number; sectorSize: number; totalSize: number }[] = [];
      let totalSize = 0;

      // 首先收集所有区域信息
      for (let i = 0; i < Math.min(4, info.eraseSectorRegions); i++) {
        const sectorCount = ((workBuffer[0x5C + (i * 8)] << 8) | workBuffer[0x5A + (i * 8)]) + 1; // 扇区数量
        const sectorSize = ((workBuffer[0x60 + (i * 8)] << 8) | workBuffer[0x5E + (i * 8)]) * 256; // 扇区大小
        const regionTotalSize = sectorCount * sectorSize; // 区域总大小

        regionInfo.push({
          sectorCount,
          sectorSize,
          totalSize: regionTotalSize,
        });
        totalSize += regionTotalSize;
      }

      // 根据reverseSectorRegion标志分配扇区区域地址并创建EraseSectorBlock对象
      if (info.reverseSectorRegion) {
        // 从高地址向低地址分配扇区区域（反转模式）
        let currentAddr = totalSize;
        for (let i = 0; i < regionInfo.length; i++) {
          const region = regionInfo[i];
          currentAddr -= region.totalSize;

          // 反转时，区域按倒序分配地址
          const reverseIndex = regionInfo.length - 1 - i;
          info.eraseSectorBlocks[reverseIndex] = {
            sectorSize: region.sectorSize,
            sectorCount: region.sectorCount,
            totalSize: region.totalSize,
            startAddress: currentAddr,
            endAddress: currentAddr + region.totalSize - 1,
          };
        }
      } else {
        // 从低地址向高地址分配扇区区域（正常模式）
        let currentAddr = 0;
        for (let i = 0; i < regionInfo.length; i++) {
          const region = regionInfo[i];

          info.eraseSectorBlocks[i] = {
            sectorSize: region.sectorSize,
            sectorCount: region.sectorCount,
            totalSize: region.totalSize,
            startAddress: currentAddr,
            endAddress: currentAddr + region.totalSize - 1,
          };
          currentAddr += region.totalSize;
        }
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

    // 显示Flash检测信息
    if (info.detection.isSwapD0D1) {
      lines.push('Flash detection: D0D1 swapped');
    }
    if (info.detection.isIntel) {
      lines.push('Flash type: Intel Flash detected');
    }

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

    // 扇区区域信息 - 使用新的eraseSectorBlocks数据
    for (let i = 0; i < info.eraseSectorRegions; i++) {
      const block = info.eraseSectorBlocks[i];

      const addressRange = formatHex(block.startAddress, 3) + '-' + formatHex(block.endAddress - 1, 3);
      const sectorSizeHex = formatHex(block.sectorSize, 2);
      const regionInfo = `Region ${i + 1}: ${addressRange} @ ${sectorSizeHex} Bytes × ${block.sectorCount}${info.reverseSectorRegion ? ' (reversed)' : ''}`;
      lines.push(regionInfo);
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
