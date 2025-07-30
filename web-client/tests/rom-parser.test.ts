import { describe, expect, it } from 'vitest';

import { calculateGBChecksum, GB_NINTENDO_LOGO, GBA_NINTENDO_LOGO, parseRom } from '../src/utils/rom-parser';

function createGBARomHeader(dataSize = 0x200): Uint8Array {
  const header = new Uint8Array(dataSize); // 512字节足够测试

  // 入口点 (0x00-0x03)
  header[0x00] = 0x18;
  header[0x01] = 0x00;
  header[0x02] = 0x00;
  header[0x03] = 0xEA;

  // Nintendo Logo (0x04-0x9F)
  header.set(GBA_NINTENDO_LOGO, 0x04);

  // 游戏标题 (0xA0-0xAB)
  const title = 'TEST_GAME  '; // 12字节，空格填充
  for (let i = 0; i < title.length && i < 12; i++) {
    header[0xA0 + i] = title.charCodeAt(i);
  }

  // 游戏代码 (0xAC-0xAF)
  const gameCode = 'AXEE'; // AXEE (测试游戏)
  for (let i = 0; i < gameCode.length; i++) {
    header[0xAC + i] = gameCode.charCodeAt(i);
  }

  // 制造商代码 (0xB0-0xB1)
  header[0xB0] = 0x30; // '0'
  header[0xB1] = 0x31; // '1'

  // 固定值 (0xB2)
  header[0xB2] = 0x96;

  // 主机单元代码 (0xB3)
  header[0xB3] = 0x00;

  // 设备类型 (0xB4)
  header[0xB4] = 0x00;

  // 保留区域 (0xB5-0xBB)
  for (let i = 0xB5; i <= 0xBB; i++) {
    header[i] = 0x00;
  }

  // 版本号 (0xBC)
  header[0xBC] = 0x01;

  // 计算头部校验和 (0xBD)
  let headerSum = 0;
  for (let i = 0xA0; i <= 0xBC; i++) {
    headerSum += header[i];
  }
  header[0xBD] = (-(headerSum + 0x19)) & 0xFF;

  return header;
}

function createGBRomHeader(isGBC = false, dataSize = 0x200): Uint8Array {
  const header = new Uint8Array(dataSize);

  // Nintendo Logo (0x104-0x133)
  header.set(GB_NINTENDO_LOGO, 0x104);

  // 游戏标题 (0x134-0x143, 或0x134-0x142 for GBC)
  const title = 'TEST_GAME';
  const titleEnd = isGBC ? 0x142 : 0x143;
  for (let i = 0; i < title.length && 0x134 + i <= titleEnd; i++) {
    header[0x134 + i] = title.charCodeAt(i);
  }
  // 标题区剩余补0x00
  for (let i = 0x134 + title.length; i <= titleEnd; i++) {
    header[i] = 0x00;
  }

  if (isGBC) {
    // CGB标志 (0x143)
    header[0x143] = 0x80; // 支持GBC但兼容GB
  }

  // SGB标志 (0x146)
  header[0x146] = 0x00;

  // 制造商新许可证代码 (0x144-0x145)
  header[0x144] = 0x30; // '0'
  header[0x145] = 0x31; // '1'

  // ROM大小 (0x148)
  header[0x148] = 0x00; // 32KB

  // RAM大小 (0x149)
  header[0x149] = 0x00; // 无RAM

  // 目标代码 (0x14A)
  header[0x14A] = 0x01; // 非日本

  // 旧许可证代码 (0x14B)
  header[0x14B] = 0x33;

  // 版本号 (0x14C)
  header[0x14C] = 0x01;

  // 计算头部校验和 (0x14D)
  const headerSum = calculateGBChecksum(header);
  header[0x14D] = headerSum;

  return header;
}

describe('rom-parser', () => {
  describe('GBA ROM解析', () => {
    it('应该正确解析有效的GBA ROM', () => {
      const romData = createGBARomHeader();
      const result = parseRom(romData);

      expect(result.type).toBe('GBA');
      expect(result.title).toBe('TEST_GAME');
      expect(result.gameCode).toBe('AXEE');
      expect(result.makerCode).toBe('01');
      expect(result.version).toBe(1);
      expect(result.region).toBe('USA');
      expect(result.isValid).toBe(true);
      expect(result.romSize).toBe(romData.length);
    });

    it('应该处理标题中的空字符', () => {
      const romData = createGBARomHeader();
      // 在标题中添加空字符
      romData[0xA5] = 0x00;

      const result = parseRom(romData);
      expect(result.title).toBe('TEST_AME');
    });

    it('应该正确识别不同地区代码', () => {
      const regionTests = [
        { code: 'AXEJ', expected: 'Japan' },
        { code: 'AXEP', expected: 'Europe' },
        { code: 'AXEF', expected: 'France' },
        { code: 'AXES', expected: 'Spain' },
        { code: 'AXEE', expected: 'USA' },
        { code: 'AXED', expected: 'Germany' },
        { code: 'AXEI', expected: 'Italy' },
        { code: 'AXEZ', expected: 'Unknown' },
      ];

      regionTests.forEach(({ code, expected }) => {
        const romData = createGBARomHeader();
        for (let i = 0; i < code.length; i++) {
          romData[0xAC + i] = code.charCodeAt(i);
        }

        // 重新计算校验和
        let headerSum = 0;
        for (let i = 0xA0; i <= 0xBC; i++) {
          headerSum += romData[i];
        }
        romData[0xBD] = (-(headerSum + 0x19)) & 0xFF;

        const result = parseRom(romData);
        expect(result.region).toBe(expected);
      });
    });

    it('应该检测无效的Nintendo Logo', () => {
      const romData = createGBARomHeader(0x100001);
      // 破坏Nintendo Logo
      romData[0x04] = 0x00;

      const result = parseRom(romData);
      expect(result.type).toBe('GBA');
      expect(result.isValid).toBe(false);
    });

    it('应该检测无效的固定字节', () => {
      const romData = createGBARomHeader();
      // 破坏固定字节
      romData[0xB2] = 0x00;

      const result = parseRom(romData);
      expect(result.isValid).toBe(false);
    });

    it('应该检测无效的头部校验和', () => {
      const romData = createGBARomHeader();
      // 破坏校验和
      romData[0xBD] = 0x00;

      const result = parseRom(romData);
      expect(result.isValid).toBe(false);
    });

    it('应该处理过短的ROM数据', () => {
      const shortData = new Uint8Array(100); // 太短的数据

      const result = parseRom(shortData);
      expect(result.type).toBe('Unknown');
      expect(result.isValid).toBe(false);
    });
  });

  describe('GB/GBC ROM解析', () => {
    it('应该正确解析GB ROM', () => {
      const romData = createGBRomHeader(false);
      const result = parseRom(romData);

      expect(result.type).toBe('GB');
      expect(result.title).toBe('TEST_GAME');
      expect(result.version).toBe(1);
      expect(result.isValid).toBe(true);
      expect(result.romSize).toBe(32768);
    });

    it('应该正确解析GBC ROM', () => {
      const romData = createGBRomHeader(true);
      const result = parseRom(romData);

      expect(result.type).toBe('GBC');
      expect(result.title).toBe('TEST_GAME');
      expect(result.isValid).toBe(true);
    });

    it('应该检测无效的GB Nintendo Logo', () => {
      const romData = createGBRomHeader();
      // 破坏Nintendo Logo
      romData[0x104] = 0x00;

      const result = parseRom(romData);
      expect(result.isValid).toBe(false);
    });

    it('应该检测无效的GB头部校验和', () => {
      const romData = createGBRomHeader();
      // 破坏校验和
      romData[0x14D] = 0x00;

      const result = parseRom(romData);
      expect(result.isValid).toBe(false);
    });

    it('应该处理空标题', () => {
      const romData = createGBRomHeader();
      // 清空标题区域
      for (let i = 0x134; i <= 0x142; i++) {
        romData[i] = 0x00;
      }

      // 重新计算校验和
      let headerSum = 0;
      for (let i = 0x134; i <= 0x14C; i++) {
        headerSum += romData[i];
      }
      romData[0x14D] = (-headerSum - 1) & 0xFF;

      const result = parseRom(romData);
      expect(result.title).toBe('');
    });
  });

  describe('边界条件', () => {
    it('应该处理空数据', () => {
      const result = parseRom(new Uint8Array(0));

      expect(result.type).toBe('Unknown');
      expect(result.isValid).toBe(false);
      expect(result.romSize).toBe(0);
      expect(result.title).toBe('Empty ROM');
    });

    it('应该处理非常小的数据', () => {
      const result = parseRom(new Uint8Array(10));

      expect(result.type).toBe('Unknown');
      expect(result.isValid).toBe(false);
    });

    it('应该正确设置默认值', () => {
      const result = parseRom(new Uint8Array(50));

      expect(result.title).toBe('Unknown ROM');
      expect(result.type).toBe('Unknown');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Logo验证', () => {
    it('GBA_NINTENDO_LOGO应该有正确的长度', () => {
      expect(GBA_NINTENDO_LOGO.length).toBe(156);
    });

    it('GB_NINTENDO_LOGO应该有正确的长度', () => {
      expect(GB_NINTENDO_LOGO.length).toBe(48);
    });
  });
});
