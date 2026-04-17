import { formatBytes, formatHex } from '@/utils/formatter-utils';

/**
 * CFI 数据结构偏移量常量
 */
const CFI_OFFSETS = {
  // QRY identification string
  QRY_Q: 0x20,
  QRY_R: 0x22,
  QRY_Y: 0x24,
  // Primary algorithm address
  PRI_ADDR_LOW: 0x2a,
  PRI_ADDR_HIGH: 0x2c,
  // Voltage range
  VDD_MIN: 0x36,
  VDD_MAX: 0x38,
  // Timing — average
  SINGLE_WRITE_AVG: 0x3e,
  BUFFER_WRITE_AVG: 0x40,
  SECTOR_ERASE_AVG: 0x42,
  CHIP_ERASE_AVG: 0x44,
  // Timing — max factor
  SINGLE_WRITE_MAX: 0x46,
  BUFFER_WRITE_MAX: 0x48,
  SECTOR_ERASE_MAX: 0x4a,
  CHIP_ERASE_MAX: 0x4c,
  // Device geometry
  DEVICE_SIZE: 0x4e,
  BUFFER_SIZE_LOW: 0x54,
  BUFFER_SIZE_HIGH: 0x56,
  ERASE_REGIONS: 0x58,
  REGION_BASE: 0x5a,
  REGION_STRIDE: 8,
  // PRI extended query (relative to priAddress)
  PRI_BOOT_SECTOR: 0x1e,
} as const;

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
 * CFI解析结果接口
 */
export interface CFIInfo {
  /** Flash ID */
  flashId: Uint8Array;
  /** CFI魔数标识 "QRY" */
  magic: string;
  /** 数据交换信息 */
  dataSwap: [number, number][] | null;
  /** CFI检测是否成功 */
  cfiDetected: boolean;
  /** 是否交换D0和D1数据线 */
  isSwapD0D1: boolean;
  /** 是否为Intel Flash */
  isIntel: boolean;
  /** 检测到的魔数值 */
  magicValues?: {
    q: number;
    r: number;
    y: number;
  };
  /** 检测错误消息（如果有） */
  detectionError?: string;
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
 * 将buffer内容以ASCII格式打印到控制台
 * @param buffer - 要打印的数据缓冲区
 * @param title - 打印标题（可选）
 */
function printBufferAsASCII(buffer: Uint8Array, title?: string): void {
  if (title) {
    console.log(`=== ${title} ===`);
  }

  let asciiString = '';
  let hexString = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    // 构建ASCII字符串（可打印字符显示为字符）
    if (byte === 0x00) {
      asciiString += '∅'; // 空字符使用特殊符号
    } else if (byte === 0xFF) {
      asciiString += '█'; // 0xFF使用实心块
    } else if (byte >= 32 && byte <= 126) {
      asciiString += String.fromCharCode(byte);
    } else {
      asciiString += '.';
    }

    // 构建十六进制字符串
    hexString += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';

    // 每16字节换行
    if ((i + 1) % 16 === 0) {
      console.log(`${(i - 15).toString(16).padStart(4, '0').toUpperCase()}: ${hexString}| ${asciiString}`);
      asciiString = '';
      hexString = '';
    }
  }

  // 打印剩余的字节（如果不满16字节）
  if (asciiString.length > 0) {
    const padding = ' '.repeat((16 - asciiString.length) * 3);
    console.log(`${(Math.floor(buffer.length / 16) * 16).toString(16).padStart(4, '0').toUpperCase()}: ${hexString}${padding}| ${asciiString}`);
  }

  console.log(`总长度: ${buffer.length} 字节`);
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
   * 检测Flash特性
   * @param buffer - CFI查询返回的数据缓冲区
   * @param info - 要填充检测信息的CFI信息对象
   */
  private detectFlashCharacteristics(buffer: Uint8Array, info: Partial<CFIInfo>): void {

    const qryQ = buffer[CFI_OFFSETS.QRY_Q]; // 'Q' = 0x51
    const qryR = buffer[CFI_OFFSETS.QRY_R]; // 'R' = 0x52
    const qryY = buffer[CFI_OFFSETS.QRY_Y]; // 'Y' = 0x59

    // 存储原始魔数值
    info.magicValues = { q: qryQ, r: qryR, y: qryY };

    // 正常CFI响应
    if (qryQ === 0x51 && qryR === 0x52 && qryY === 0x59) {
      info.isSwapD0D1 = false;
      info.cfiDetected = true;
    } else if (this.swapD0D1(qryQ) === 0x51 && this.swapD0D1(qryR) === 0x52 && this.swapD0D1(qryY) === 0x59) {
      info.isSwapD0D1 = true;
      info.cfiDetected = true;
    } else {
      info.cfiDetected = false;
      info.isSwapD0D1 = false;
    }

    // TODO: Intel Flash检测逻辑可以在这里扩展
    info.isIntel = false;
  }

  /**
   * D0D1位交换函数
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

    // 固定偏移量最大值（支持 4 个扇区区域时）为 0x78；至少需要 0x79 字节
    const MIN_CFI_BUFFER_SIZE = 0x79;
    if (workBuffer.length < MIN_CFI_BUFFER_SIZE) {
      console.error(`CFI data too short: ${workBuffer.length} bytes, expected at least ${MIN_CFI_BUFFER_SIZE}`);
      return false;
    }
    const info: Partial<CFIInfo> = {};

    // 检测Flash特性
    this.detectFlashCharacteristics(workBuffer, info);

    if (!info.cfiDetected) {
      printBufferAsASCII(buffer, 'CFI Buffer内容');
      return false;
    }

    // 根据检测结果设置数据交换模式
    if (info.isSwapD0D1) {
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
      // 重新读取魔数
      info.magic = String.fromCharCode(workBuffer[CFI_OFFSETS.QRY_Q]) +
                   String.fromCharCode(workBuffer[CFI_OFFSETS.QRY_R]) +
                   String.fromCharCode(workBuffer[CFI_OFFSETS.QRY_Y]);

      // 解析系统接口信息（电压、时序）
      if (!this.parseSystemInterface(workBuffer, info)) {
        return false;
      }

      // 解析 PRI 扩展查询（引导扇区信息）
      this.parsePriExtended(workBuffer, info);

      // 解析设备几何信息（大小、擦除区域）
      this.parseDeviceGeometry(workBuffer, info);

      // 生成信息摘要
      info.info = this.generateInfoString(info as CFIInfo);

      return info as CFIInfo;

    } catch (error) {
      console.error('ERROR: Trying to parse CFI data resulted in an error:', error);
      return false;
    }
  }

  private parseSystemInterface(buf: Uint8Array, info: Partial<CFIInfo>): boolean {
    // 检查电压范围信息
    if (buf[CFI_OFFSETS.VDD_MIN] === 0xFF && buf[CFI_OFFSETS.BUFFER_WRITE_MAX] === 0xFF) {
      console.error('FAIL: No information about the voltage range found in CFI data.');
      return false;
    }

    // 解析电压范围
    info.vddMin = (buf[CFI_OFFSETS.VDD_MIN] >> 4) + ((buf[CFI_OFFSETS.VDD_MIN] & 0x0F) / 10);
    info.vddMax = (buf[CFI_OFFSETS.VDD_MAX] >> 4) + ((buf[CFI_OFFSETS.VDD_MAX] & 0x0F) / 10);

    // 解析写入时间信息
    if (buf[CFI_OFFSETS.SINGLE_WRITE_AVG] > 0 && buf[CFI_OFFSETS.SINGLE_WRITE_AVG] < 0xFF) {
      info.singleWrite = true;
      info.singleWriteTimeAvg = Math.pow(2, buf[CFI_OFFSETS.SINGLE_WRITE_AVG]);
      info.singleWriteTimeMax = Math.pow(2, buf[CFI_OFFSETS.SINGLE_WRITE_MAX]) * info.singleWriteTimeAvg;
    } else {
      info.singleWrite = false;
    }

    // 解析缓冲写入信息
    if (buf[CFI_OFFSETS.BUFFER_WRITE_AVG] > 0 && buf[CFI_OFFSETS.BUFFER_WRITE_AVG] < 0xFF) {
      info.bufferWrite = true;
      info.bufferWriteTimeAvg = Math.pow(2, buf[CFI_OFFSETS.BUFFER_WRITE_AVG]);
      info.bufferWriteTimeMax = Math.pow(2, buf[CFI_OFFSETS.BUFFER_WRITE_MAX]) * info.bufferWriteTimeAvg;
    } else {
      info.bufferWrite = false;
    }

    // 解析扇区擦除时间
    if (buf[CFI_OFFSETS.SECTOR_ERASE_AVG] > 0 && buf[CFI_OFFSETS.SECTOR_ERASE_AVG] < 0xFF) {
      info.sectorErase = true;
      info.sectorEraseTimeAvg = Math.pow(2, buf[CFI_OFFSETS.SECTOR_ERASE_AVG]);
      info.sectorEraseTimeMax = Math.pow(2, buf[CFI_OFFSETS.SECTOR_ERASE_MAX]) * info.sectorEraseTimeAvg;
    } else {
      info.sectorErase = false;
    }

    // 解析芯片擦除时间
    if (buf[CFI_OFFSETS.CHIP_ERASE_AVG] > 0 && buf[CFI_OFFSETS.CHIP_ERASE_AVG] < 0xFF) {
      info.chipErase = true;
      info.chipEraseTimeAvg = Math.pow(2, buf[CFI_OFFSETS.CHIP_ERASE_AVG]);
      info.chipEraseTimeMax = Math.pow(2, buf[CFI_OFFSETS.CHIP_ERASE_MAX]) * info.chipEraseTimeAvg;
    } else {
      info.chipErase = false;
    }

    return true;
  }

  private parsePriExtended(buf: Uint8Array, info: Partial<CFIInfo>): void {
    info.tbBootSector = false;
    info.tbBootSectorRaw = 0;
    info.reverseSectorRegion = false;

    // 获取 PRI 地址
    let priAddress = (buf[CFI_OFFSETS.PRI_ADDR_LOW] | (buf[CFI_OFFSETS.PRI_ADDR_HIGH] << 8)) * 2;
    if ((priAddress + 0x3C) >= 0x400 || (priAddress + 0x1F) >= buf.length) {
      priAddress = 0x80;
    }

    // 读取PRI字符串
    function pickAscii(a: number, b: number): number {
      if (a !== 0x00) return a;
      if (b !== 0x00) return b;
      return a;
    }

    const priP = pickAscii(buf[priAddress], buf[priAddress + 1]);
    const priR = pickAscii(buf[priAddress + 2], buf[priAddress + 3]);
    const priI = pickAscii(buf[priAddress + 4], buf[priAddress + 5]);

    if (String.fromCharCode(priP) + String.fromCharCode(priR) + String.fromCharCode(priI) === 'PRI') {
      const bootVal = buf[priAddress + CFI_OFFSETS.PRI_BOOT_SECTOR];
      if (bootVal !== 0 && bootVal !== 0xFF) {
        const bootSectorTypes: Record<number, string> = {
          0x02: 'As shown',
          0x03: 'Reversed',
        };
        info.tbBootSectorRaw = bootVal;
        info.tbBootSector = bootSectorTypes[bootVal] || formatHex(bootVal, 1);
        if (bootSectorTypes[bootVal]) {
          info.tbBootSector += ` (${formatHex(bootVal, 1)})`;
        }
        info.reverseSectorRegion = bootVal === 0x03;
      }
    }
  }

  private parseDeviceGeometry(buf: Uint8Array, info: Partial<CFIInfo>): void {
    // 解析设备大小
    info.deviceSize = Math.pow(2, buf[CFI_OFFSETS.DEVICE_SIZE]);

    // 解析缓冲区大小
    const bufferSizeValue = (buf[CFI_OFFSETS.BUFFER_SIZE_HIGH] << 8) | buf[CFI_OFFSETS.BUFFER_SIZE_LOW];
    if (bufferSizeValue > 1) {
      info.bufferWrite = true;
      info.bufferSize = Math.pow(2, bufferSizeValue);
    } else {
      info.bufferWrite = false;
    }

    // 解析擦除扇区区域
    info.eraseSectorRegions = buf[CFI_OFFSETS.ERASE_REGIONS];
    info.eraseSectorBlocks = [];

    const regionInfo: { sectorCount: number; sectorSize: number; totalSize: number }[] = [];
    let totalSize = 0;

    for (let i = 0; i < Math.min(4, info.eraseSectorRegions); i++) {
      const base = CFI_OFFSETS.REGION_BASE + i * CFI_OFFSETS.REGION_STRIDE;
      const sectorCount = ((buf[base + 2] << 8) | buf[base]) + 1;
      const sectorSize = ((buf[base + 6] << 8) | buf[base + 4]) * 256;
      const regionTotalSize = sectorCount * sectorSize;

      regionInfo.push({ sectorCount, sectorSize, totalSize: regionTotalSize });
      totalSize += regionTotalSize;
    }

    const createSectorBlock = (region: typeof regionInfo[0], startAddr: number): SectorBlock => ({
      sectorSize: region.sectorSize,
      sectorCount: region.sectorCount,
      totalSize: region.totalSize,
      startAddress: startAddr,
      endAddress: startAddr + region.totalSize - 1,
    });

    if (info.reverseSectorRegion) {
      let currentAddr = totalSize;
      for (let i = 0; i < regionInfo.length; i++) {
        const region = regionInfo[i];
        currentAddr -= region.totalSize;
        const reverseIndex = regionInfo.length - 1 - i;
        info.eraseSectorBlocks[reverseIndex] = createSectorBlock(region, currentAddr);
      }
    } else {
      let currentAddr = 0;
      for (let i = 0; i < regionInfo.length; i++) {
        const region = regionInfo[i];
        info.eraseSectorBlocks[i] = createSectorBlock(region, currentAddr);
        currentAddr += region.totalSize;
      }
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
    if (info.isSwapD0D1) {
      lines.push('Flash detection: D0D1 swapped');
    }
    if (info.isIntel) {
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
 * D0D1位交换函数（对应C++的SWAP_D0D1宏）
 * @param value - 要交换的值
 * @returns 交换D0D1位后的值
 */
export function swapD0D1(value: number): number {
  const bit0 = (value & 0x01) << 1; // D0 -> D1
  const bit1 = (value & 0x02) >> 1; // D1 -> D0
  return (value & 0xFC) | bit0 | bit1; // 保持其他位不变
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
