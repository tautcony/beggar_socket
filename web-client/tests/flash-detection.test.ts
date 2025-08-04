import { describe, expect, it } from 'vitest';

import { parseCFI } from '@/utils/cfi-parser';

describe('Flash检测功能测试', () => {
  // 创建一个基础的CFI数据缓冲区
  function createBaseCFIBuffer() {
    const buffer = new Uint8Array(0x400);

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
    buffer[0x58] = 1;

    // 设置区域1: 16 × 64KB sectors
    buffer[0x5A] = 15; // 扇区数量-1 (16-1=15)
    buffer[0x5C] = 0;
    buffer[0x5E] = 0; // 扇区大小 / 256 = 64KB/256 = 256
    buffer[0x60] = 1;

    return buffer;
  }

  it('应该检测正常的CFI响应（无D0D1交换）', () => {
    const buffer = createBaseCFIBuffer();

    // 设置正常的CFI魔数 "QRY"
    buffer[0x20] = 0x51; // 'Q'
    buffer[0x22] = 0x52; // 'R'
    buffer[0x24] = 0x59; // 'Y'

    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.detection.cfiDetected).toBe(true);
      expect(result.detection.isSwapD0D1).toBe(false);
      expect(result.detection.isIntel).toBe(false);
      expect(result.magic).toBe('QRY');
      expect(result.dataSwap).toEqual([[0, 0]]);
    }
  });

  it('应该检测D0D1交换的CFI响应', () => {
    const buffer = createBaseCFIBuffer();

    // 设置D0D1交换后的CFI魔数
    // 'Q' (0x51) 经过D0D1交换后变成 0x52
    // 'R' (0x52) 经过D0D1交换后变成 0x51
    // 'Y' (0x59) 经过D0D1交换后变成 0x5A
    buffer[0x20] = 0x52; // 'Q' with D0D1 swapped
    buffer[0x22] = 0x51; // 'R' with D0D1 swapped
    buffer[0x24] = 0x5A; // 'Y' with D0D1 swapped

    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.detection.cfiDetected).toBe(true);
      expect(result.detection.isSwapD0D1).toBe(true);
      expect(result.detection.isIntel).toBe(false);
      expect(result.magic).toBe('QRY'); // 应该在解析后显示正确的魔数
      expect(result.dataSwap).toEqual([[0, 1]]);
    }
  });

  it('应该拒绝无效的CFI响应', () => {
    const buffer = createBaseCFIBuffer();

    // 设置无效的魔数
    buffer[0x20] = 0x00;
    buffer[0x22] = 0x00;
    buffer[0x24] = 0x00;

    const result = parseCFI(buffer);

    expect(result).toBe(false);
  });

  it('应该在信息字符串中显示Flash检测信息', () => {
    const buffer = createBaseCFIBuffer();

    // 设置D0D1交换的CFI魔数
    buffer[0x20] = 0x52; // 'Q' with D0D1 swapped
    buffer[0x22] = 0x51; // 'R' with D0D1 swapped
    buffer[0x24] = 0x5A; // 'Y' with D0D1 swapped

    const result = parseCFI(buffer);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.info).toContain('Flash detection: D0D1 swapped');
    }
  });

  it('应该正确处理空缓冲区', () => {
    const result = parseCFI(false);
    expect(result).toBe(false);
  });

  it('应该正确处理空数组', () => {
    const result = parseCFI(new Uint8Array(0));
    expect(result).toBe(false);
  });
});
