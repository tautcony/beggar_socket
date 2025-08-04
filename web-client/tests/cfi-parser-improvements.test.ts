import { describe, expect, it } from 'vitest';

import { parseCFI } from '@/utils/cfi-parser';

describe('CFI Parser 扇区区域改进测试', () => {
  // 创建一个模拟的CFI数据缓冲区
  function createMockCFIBuffer(tbBootSectorValue = 0x02) {
    const buffer = new Uint8Array(0x400);

    // 设置CFI魔数 "QRY"
    buffer[0x20] = 0x51; // 'Q'
    buffer[0x22] = 0x52; // 'R'
    buffer[0x24] = 0x59; // 'Y'

    // 设置电压信息
    buffer[0x36] = 0x27; // VDD min = 2.7V
    buffer[0x38] = 0x36; // VDD max = 3.6V

    // 设置写入时间信息
    buffer[0x3E] = 0x08; // 单字节写入时间
    buffer[0x40] = 0x0A; // 缓冲写入时间
    buffer[0x42] = 0x0C; // 扇区擦除时间
    buffer[0x44] = 0x0E; // 芯片擦除时间

    // 设置设备大小 (1MB = 2^20)
    buffer[0x4E] = 20;

    // 设置缓冲区大小 (512 bytes = 2^9)
    buffer[0x54] = 9;
    buffer[0x56] = 0;

    // 设置扇区区域数量
    buffer[0x58] = 2;

    // 设置区域1: 8 × 8KB sectors
    buffer[0x5A] = 7; // 扇区数量-1 (8-1=7)
    buffer[0x5C] = 0;
    buffer[0x5E] = 0x20; // 扇区大小 / 256 = 8KB/256 = 32
    buffer[0x60] = 0;

    // 设置区域2: 15 × 64KB sectors (调整为更小的值便于测试)
    buffer[0x5A + 8] = 14; // 扇区数量-1 (15-1=14)
    buffer[0x5C + 8] = 0;
    buffer[0x5E + 8] = 0; // 扇区大小 / 256 = 64KB/256 = 256
    buffer[0x60 + 8] = 1;

    // 设置PRI地址
    buffer[0x2A] = 0x40; // PRI地址 = 0x40 * 2 = 0x80
    buffer[0x2C] = 0;

    // 设置PRI标识和tb_boot_sector
    buffer[0x80] = 0x50; // 'P'
    buffer[0x82] = 0x52; // 'R'
    buffer[0x84] = 0x49; // 'I'
    buffer[0x80 + 0x1E] = tbBootSectorValue;

    return buffer;
  }

  it('应该正确解析正常模式的扇区区域', () => {
    const buffer = createMockCFIBuffer(0x02); // 正常模式
    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.reverseSectorRegion).toBe(false);
      expect(result.tbBootSector).toBe('As shown (0x02)');
      expect(result.eraseSectorBlocks).toHaveLength(2);

      // 验证扇区区域地址分配（正常模式：从低地址到高地址）
      expect(result.eraseSectorBlocks[0].startAddress).toBe(0); // 区域1起始地址
      expect(result.eraseSectorBlocks[0].endAddress).toBe(65535); // 区域1结束地址 (8 * 8KB - 1)
      expect(result.eraseSectorBlocks[0].sectorSize).toBe(8192); // 区域1扇区大小 (8KB)

      expect(result.eraseSectorBlocks[1].startAddress).toBe(65536); // 区域2起始地址
      expect(result.eraseSectorBlocks[1].endAddress).toBe(1048575); // 区域2结束地址 (65536 + 15 * 64KB - 1)
      expect(result.eraseSectorBlocks[1].sectorSize).toBe(65536); // 区域2扇区大小 (64KB)
    }
  });

  it('应该正确解析反转模式的扇区区域', () => {
    const buffer = createMockCFIBuffer(0x03); // 反转模式
    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.reverseSectorRegion).toBe(true);
      expect(result.tbBootSector).toBe('Reversed (0x03)');
      expect(result.eraseSectorBlocks).toHaveLength(2);

      // 验证扇区区域地址分配（反转模式）
      // 在反转模式下，原始区域1(64KB扇区)被分配到低地址，原始区域0(8KB扇区)被分配到高地址
      expect(result.eraseSectorBlocks[0].startAddress).toBe(0); // 区域0起始地址 (原来的64KB区域)
      expect(result.eraseSectorBlocks[0].endAddress).toBe(983039); // 区域0结束地址 (15 * 64KB - 1)
      expect(result.eraseSectorBlocks[0].sectorSize).toBe(65536); // 区域0扇区大小 (64KB)

      expect(result.eraseSectorBlocks[1].startAddress).toBe(983040); // 区域1起始地址 (原来的8KB区域)
      expect(result.eraseSectorBlocks[1].endAddress).toBe(1048575); // 区域1结束地址 (983040 + 8 * 8KB - 1)
      expect(result.eraseSectorBlocks[1].sectorSize).toBe(8192); // 区域1扇区大小 (8KB)
    }
  });

  it('eraseSectorBlocks 应该使用新的对象格式', () => {
    const buffer = createMockCFIBuffer(0x02);
    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.eraseSectorBlocks).toHaveLength(2);
      // 验证新的对象格式
      expect(result.eraseSectorBlocks[0]).toEqual({
        sectorSize: 8192,
        sectorCount: 8,
        totalSize: 65536,
        startAddress: 0,
        endAddress: 65535,
      });
      expect(result.eraseSectorBlocks[1]).toEqual({
        sectorSize: 65536,
        sectorCount: 15,
        totalSize: 983040,
        startAddress: 65536,
        endAddress: 1048575,
      });
    }
  });

  it('应该在信息字符串中包含反转标志', () => {
    const buffer = createMockCFIBuffer(0x03);
    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.info).toContain('(reversed)');
    }
  });
});
