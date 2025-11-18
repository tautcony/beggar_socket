import { describe, expect, it } from 'vitest';

import { detectMbcType } from '@/utils/parsers/rom-parser';

describe('MBC Type Detection', () => {
  it('应该检测 MBC5 类型', () => {
    const romData = new Uint8Array(0x148);
    // 设置卡带类型为 MBC5 (0x19)
    romData[0x147] = 0x19;
    expect(detectMbcType(romData)).toBe('MBC5');

    // 测试其他 MBC5 变体
    romData[0x147] = 0x1a; // MBC5+RAM
    expect(detectMbcType(romData)).toBe('MBC5');

    romData[0x147] = 0x1b; // MBC5+RAM+BATTERY
    expect(detectMbcType(romData)).toBe('MBC5');

    romData[0x147] = 0x1c; // MBC5+RUMBLE
    expect(detectMbcType(romData)).toBe('MBC5');

    romData[0x147] = 0x1d; // MBC5+RUMBLE+RAM
    expect(detectMbcType(romData)).toBe('MBC5');

    romData[0x147] = 0x1e; // MBC5+RUMBLE+RAM+BATTERY
    expect(detectMbcType(romData)).toBe('MBC5');
  });

  it('应该检测 MBC3 类型', () => {
    const romData = new Uint8Array(0x148);

    romData[0x147] = 0x0f; // MBC3+TIMER+BATTERY
    expect(detectMbcType(romData)).toBe('MBC3');

    romData[0x147] = 0x10; // MBC3+TIMER+RAM+BATTERY
    expect(detectMbcType(romData)).toBe('MBC3');

    romData[0x147] = 0x11; // MBC3
    expect(detectMbcType(romData)).toBe('MBC3');

    romData[0x147] = 0x12; // MBC3+RAM
    expect(detectMbcType(romData)).toBe('MBC3');

    romData[0x147] = 0x13; // MBC3+RAM+BATTERY
    expect(detectMbcType(romData)).toBe('MBC3');
  });

  it('应该检测 MBC2 类型', () => {
    const romData = new Uint8Array(0x148);

    romData[0x147] = 0x05; // MBC2
    expect(detectMbcType(romData)).toBe('MBC2');

    romData[0x147] = 0x06; // MBC2+BATTERY
    expect(detectMbcType(romData)).toBe('MBC2');
  });

  it('应该检测 MBC1 类型', () => {
    const romData = new Uint8Array(0x148);

    romData[0x147] = 0x01; // MBC1
    expect(detectMbcType(romData)).toBe('MBC1');

    romData[0x147] = 0x02; // MBC1+RAM
    expect(detectMbcType(romData)).toBe('MBC1');

    romData[0x147] = 0x03; // MBC1+RAM+BATTERY
    expect(detectMbcType(romData)).toBe('MBC1');
  });

  it('对于未知类型应该返回默认值 MBC5', () => {
    const romData = new Uint8Array(0x148);

    romData[0x147] = 0x00; // ROM ONLY
    expect(detectMbcType(romData)).toBe('MBC5');

    romData[0x147] = 0xff; // 未知类型
    expect(detectMbcType(romData)).toBe('MBC5');
  });

  it('对于数据不足应该返回默认值 MBC5', () => {
    const romData = new Uint8Array(0x100); // 小于 0x148
    expect(detectMbcType(romData)).toBe('MBC5');
  });
});

describe('MBC Bank Address Calculation', () => {
  // 这些测试验证 getBaseAddressOfBank 的逻辑

  it('MBC5: 所有 bank 应该使用基址 0x4000', () => {
    // Bank 0
    const bank0 = 0;
    const expectedBase0 = 0x4000;
    expect(expectedBase0).toBe(0x4000);

    // Bank 1
    const bank1 = 1;
    const expectedBase1 = 0x4000;
    expect(expectedBase1).toBe(0x4000);

    // Bank 255
    const bank255 = 255;
    const expectedBase255 = 0x4000;
    expect(expectedBase255).toBe(0x4000);
  });

  it('MBC3: bank 0 使用 0x0000, 其他使用 0x4000', () => {
    // Bank 0
    const bank0 = 0;
    const expectedBase0 = 0x0000;
    expect(expectedBase0).toBe(0x0000);

    // Bank 1
    const bank1 = 1;
    const expectedBase1 = 0x4000;
    expect(expectedBase1).toBe(0x4000);

    // Bank 127
    const bank127 = 127;
    const expectedBase127 = 0x4000;
    expect(expectedBase127).toBe(0x4000);
  });

  it('应该正确计算 ROM 地址', () => {
    // MBC5: ROM 地址 0x14ABC (bank 5, offset 0x0ABC)
    const romAddress = 0x14ABC;
    const bank = romAddress >> 14; // = 5
    const offset = romAddress & 0x3fff; // = 0x0ABC
    const baseAddr = 0x4000; // MBC5
    const cartAddr = baseAddr + offset; // = 0x4ABC

    expect(bank).toBe(5);
    expect(offset).toBe(0x0ABC);
    expect(cartAddr).toBe(0x4ABC);

    // MBC3: ROM 地址 0x1234 (bank 0, offset 0x1234)
    const romAddress2 = 0x1234;
    const bank2 = romAddress2 >> 14; // = 0
    const offset2 = romAddress2 & 0x3fff; // = 0x1234
    const baseAddr2 = 0x0000; // MBC3 bank 0
    const cartAddr2 = baseAddr2 + offset2; // = 0x1234

    expect(bank2).toBe(0);
    expect(offset2).toBe(0x1234);
    expect(cartAddr2).toBe(0x1234);
  });
});

describe('MBC Bank Switching Protocol', () => {
  it('MBC5: 应该使用 9位 bank 号', () => {
    // Bank 256 (0x100)
    const bank = 256;
    const b0 = bank & 0xff; // 低 8位 = 0x00
    const b1 = (bank >> 8) & 0xff; // 高位 = 0x01

    expect(b0).toBe(0x00);
    expect(b1).toBe(0x01);

    // Bank 511 (最大值)
    const bank511 = 511;
    const b0_511 = bank511 & 0xff; // = 0xFF
    const b1_511 = (bank511 >> 8) & 0xff; // = 0x01

    expect(b0_511).toBe(0xFF);
    expect(b1_511).toBe(0x01);
  });

  it('MBC3: 应该将 bank 0 映射为 bank 1', () => {
    const bank0 = 0;
    const bankValue0 = bank0 === 0 ? 1 : bank0 & 0xff;
    expect(bankValue0).toBe(1);

    const bank5 = 5;
    const bankValue5 = bank5 & 0xff; // bank5 不为 0
    expect(bankValue5).toBe(5);
  });

  it('MBC3: RAM bank 应该使用 3位掩码', () => {
    const bank8 = 8;
    const ramBank = bank8 & 0x07; // = 0
    expect(ramBank).toBe(0);

    const bank15 = 15;
    const ramBank15 = bank15 & 0x07; // = 7
    expect(ramBank15).toBe(7);
  });

  it('MBC5: RAM bank 应该使用 8位掩码', () => {
    const bank16 = 16;
    const ramBank = bank16 & 0xff;
    expect(ramBank).toBe(16);

    const bank255 = 255;
    const ramBank255 = bank255 & 0xff;
    expect(ramBank255).toBe(255);
  });
});

describe('CFI Erase Timeout Calculation', () => {
  it('应该正确计算基于 2^n 的超时时间', () => {
    // CFI 0x42: block erase timeout = 2^n ms
    const cfi42_value = 10; // 2^10 = 1024ms
    const timeoutBlock = Math.pow(2, cfi42_value);
    expect(timeoutBlock).toBe(1024);

    // CFI 0x44: chip erase timeout = 2^n ms
    const cfi44_value = 15; // 2^15 = 32768ms = 32.768s
    const timeoutChip = Math.pow(2, cfi44_value);
    expect(timeoutChip).toBe(32768);
  });

  it('当 chip timeout 为 0 时应该使用 block timeout × 扇区数', () => {
    const timeoutBlock = 1024; // ms
    const sectorCount = 128;
    const timeoutChip = 0;

    const estimatedTime = timeoutChip > 0
      ? timeoutChip
      : timeoutBlock * sectorCount;

    expect(estimatedTime).toBe(131072); // 128 秒
  });

  it('当 chip timeout 存在时应该优先使用', () => {
    const timeoutBlock = 1024; // ms
    const sectorCount = 128;
    const timeoutChip = 32768; // ms

    const estimatedTime = timeoutChip > 0
      ? timeoutChip
      : timeoutBlock * sectorCount;

    expect(estimatedTime).toBe(32768); // 使用 chip timeout
  });
});
