import { describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import { BoostCommand } from '@/protocol';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { GBARTC } from '@/services/rtc/gba-rtc';
import type { DeviceInfo } from '@/types/device-info';
import {
  inferFirmwareProfileFromPort,
  STM_FIRMWARE_PROFILE,
  withBeggarBoostProfile,
} from '@/types/firmware-profile';
import { crc32 } from '@/utils/crc-utils';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

function createBoostSimulatedTransport(romImage: Uint8Array, options?: {
  rtcBytes?: Uint8Array;
  ramImage?: Uint8Array;
}): { transport: Transport; commands: number[] } {
  let address = 0;
  let transfer = 0;
  let mode = 0;
  let activeBank = 0;
  const ramImage = options?.ramImage ?? new Uint8Array(64 * 1024);
  const commands: number[] = [];

  const banner = Array.from(new TextEncoder().encode('\x01ChisFlash Beggar FW C15 RC39-STM32\r\n'));
  let bannerOffset = 0;

  const be16 = (buf: Uint8Array, off: number) => ((buf[off] << 8) | buf[off + 1]) >>> 0;
  const be32 = (buf: Uint8Array, off: number) =>
    (((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0);

  const transport: Transport = {
    send: vi.fn((payload: Uint8Array) => {
      if (payload[0] === 0x55 && payload[1] === 0xaa) {
        bannerOffset = 0;
      }
      return Promise.resolve(true);
    }),
    read: vi.fn((length: number) => {
      const slice = Uint8Array.from(banner.slice(bannerOffset, bannerOffset + length));
      bannerOffset += slice.byteLength;
      return Promise.resolve({ data: slice });
    }),
    sendAndReceive: vi.fn((payload: Uint8Array) => {
      const cmd = payload[0];
      commands.push(cmd);

      if (cmd === BoostCommand.MODE_AGB) {
        mode = 2;
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.MODE_DMG) {
        mode = 1;
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.SET_VARIABLE) {
        const size = payload[1];
        const key = be32(payload, 2);
        const value = be32(payload, 6);
        if (size === 4 && key === 0) address = value;
        if (size === 2 && key === 0) transfer = value;
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.WRITE_UNITS) {
        const count = payload[2];
        for (let i = 0; i < count; i += 1) {
          const base = 3 + i * 6;
          const unitAddr = be32(payload, base);
          const unitVal = be16(payload, base + 4);
          if (mode === 1 && unitAddr === 0x2000) {
            activeBank = (activeBank & ~0xff) | (unitVal & 0xff);
          } else if (mode === 1 && unitAddr === 0x3000) {
            activeBank = (activeBank & 0xff) | ((unitVal & 0x01) << 8);
          } else if (mode === 2 && (unitVal & 0xff) === 0x30) {
            const byteStart = (unitAddr << 1) & ~0xffff;
            romImage.fill(0xff, byteStart, Math.min(romImage.byteLength, byteStart + 0x10000));
          }
        }
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.CRC_ROM) {
        const length = be32(payload, 1);
        const startByte = mode === 2
          ? (address << 1)
          : (address < 0x4000 ? address : activeBank * 0x4000 + (address - 0x4000));
        const slice = romImage.subarray(startByte, startByte + length);
        const sum = crc32(slice);
        return Promise.resolve({
          data: Uint8Array.from([
            (sum >>> 24) & 0xff,
            (sum >>> 16) & 0xff,
            (sum >>> 8) & 0xff,
            sum & 0xff,
          ]),
        });
      }
      if (cmd === BoostCommand.READ_AGB_ROM || cmd === BoostCommand.READ_DMG_ROM) {
        if (cmd === BoostCommand.READ_DMG_ROM && address >= 0xa000 && address < 0xc000) {
          const offset = address - 0xa000;
          return Promise.resolve({ data: ramImage.slice(offset, offset + transfer) });
        }
        const startByte = mode === 2
          ? (address << 1)
          : (address < 0x4000 ? address : activeBank * 0x4000 + (address - 0x4000));
        return Promise.resolve({ data: romImage.slice(startByte, startByte + transfer) });
      }
      if (cmd === BoostCommand.READ_AGB_RAM) {
        return Promise.resolve({ data: ramImage.slice(address, address + transfer) });
      }
      if (cmd === BoostCommand.WRITE_AGB_RAM) {
        ramImage.set(payload.subarray(1, 1 + transfer), address);
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.WRITE_DMG_RANGE) {
        const offset = Math.max(0, address - 0xa000);
        ramImage.set(payload.subarray(1, 1 + transfer), offset);
        return Promise.resolve({ data: Uint8Array.from([0x01]) });
      }
      if (cmd === BoostCommand.READ_AGB_RTC && options?.rtcBytes) {
        return Promise.resolve({ data: options.rtcBytes });
      }
      return Promise.resolve({ data: Uint8Array.from([0x01]) });
    }),
    setSignals: vi.fn(() => Promise.resolve()),
    flushInput: vi.fn(() => Promise.resolve()),
    drainInput: vi.fn(() => Promise.resolve()),
  };

  return { transport, commands };
}

function makeDevice(transport: Transport, profile = STM_FIRMWARE_PROFILE): DeviceInfo {
  return {
    port: null,
    connection: null,
    transport,
    firmwareProfile: profile,
  };
}

const dummyGbaCfi = {
  deviceSize: 4 * 1024 * 1024,
  bufferSize: 256,
  eraseSectorBlocks: [
    { startAddress: 0, endAddress: 4 * 1024 * 1024, sectorSize: 0x10000, sectorCount: 64, totalSize: 4 * 1024 * 1024 },
  ],
  info: 'Mock GBA Flash',
} as unknown as CFIInfo;

const dummyGbcCfi = {
  deviceSize: 1024 * 1024,
  bufferSize: 128,
  eraseSectorBlocks: [
    { startAddress: 0, endAddress: 1024 * 1024, sectorSize: 0x10000, sectorCount: 16, totalSize: 1024 * 1024 },
  ],
  info: 'Mock GBC Flash',
} as unknown as CFIInfo;

describe('Beggar Boost integration', () => {
  it('infers STM firmware for ChisFlash Beggar product string', () => {
    const profile = inferFirmwareProfileFromPort({
      path: 'COM5',
      vendorId: '0483',
      productId: '0721',
      manufacturer: 'CNY Industry',
      product: 'ChisFlash Beggar',
    });
    expect(profile.id).toBe('stm');
  });

  it('uses 0xd5 hardware CRC32 verify on Boost-enabled STM GBA device and stays in Boost mode across calls', async () => {
    const rom = Uint8Array.from({ length: 256 * 1024 }, (_, idx) => (idx * 31) & 0xff);
    const { transport, commands } = createBoostSimulatedTransport(rom);
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE, 'ChisFlash Beggar FW C15 RC39-STM32');
    const adapter = new GBAAdapter(makeDevice(transport, boostProfile));

    const result = await adapter.verifyROM(rom, { cfiInfo: dummyGbaCfi });
    expect(result.success).toBe(true);
    expect(commands.filter(c => c === BoostCommand.CRC_ROM)).toHaveLength(2);
    expect(commands.includes(BoostCommand.READ_AGB_ROM)).toBe(false);
    expect(transport.setSignals).not.toHaveBeenCalled();

    // 连续第二次调用保持在 Boost 模式中，不再重复 0x55 0xaa 握手
    const second = await adapter.verifyROM(rom, { cfiInfo: dummyGbaCfi });
    expect(second.success).toBe(true);
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.setSignals).not.toHaveBeenCalled();
  });

  it('falls back to 0xc1 read to pinpoint mismatch byte when 0xd5 CRC32 differs', async () => {
    const deviceRom = Uint8Array.from({ length: 64 * 1024 }, (_, idx) => idx & 0xff);
    const expectedRom = deviceRom.slice();
    expectedRom[0x1234] ^= 0x55;

    const { transport, commands } = createBoostSimulatedTransport(deviceRom);
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const adapter = new GBAAdapter(
      makeDevice(transport, boostProfile),
      null,
      null,
      (key, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params ?? {})}`,
    );

    const result = await adapter.verifyROM(expectedRom, { cfiInfo: dummyGbaCfi });
    expect(result.success).toBe(false);
    expect(result.message).toContain('0x00001234');
    expect(commands.includes(BoostCommand.CRC_ROM)).toBe(true);
    expect(commands.includes(BoostCommand.READ_AGB_ROM)).toBe(true);
  });

  it('uses 0xd5 CRC32 verify across MBC5 banks on Boost-enabled STM device and stays in Boost mode', async () => {
    const rom = Uint8Array.from({ length: 64 * 1024 }, (_, idx) => (idx * 17) & 0xff);
    const { transport, commands } = createBoostSimulatedTransport(rom);
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const adapter = new MBC5Adapter(makeDevice(transport, boostProfile));

    const verifyResult = await adapter.verifyROM(rom, { cfiInfo: dummyGbcCfi, mbcType: 'MBC5' });
    expect(verifyResult.success).toBe(true);
    expect(commands.filter(c => c === BoostCommand.CRC_ROM)).toHaveLength(4);
    expect(commands.includes(BoostCommand.WRITE_UNITS)).toBe(true);
    expect(transport.setSignals).not.toHaveBeenCalled();
  });

  it('reads GBA RTC natively via 0xca when gbaNativeRtcRead capability is present', async () => {
    const rtcRaw = Uint8Array.from([0x40, 0x26, 0x11, 0x22, 0x00, 0x09, 0x30, 0x15]);
    const { transport, commands } = createBoostSimulatedTransport(new Uint8Array(0), { rtcBytes: rtcRaw });
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const rtc = new GBARTC(makeDevice(transport, boostProfile), boostProfile);

    const result = await rtc.readTime();
    expect(result.status).toBe(true);
    expect(result.time?.year).toBe(2026);
    expect(result.time?.month).toBe(11);
    expect(result.time?.day).toBe(22);
    expect(result.time?.hour).toBe(9);
    expect(result.time?.minute).toBe(30);
    expect(result.time?.second).toBe(15);
    expect(commands).toContain(BoostCommand.READ_AGB_RTC);
  });

  it('performs full GBA ROM read/program and SRAM read/write in Boost mode without mode reset', async () => {
    const rom = Uint8Array.from({ length: 16 * 1024 }, (_, idx) => (idx * 13) & 0xff);
    const ram = new Uint8Array(32 * 1024);
    const { transport, commands } = createBoostSimulatedTransport(rom.slice(), { ramImage: ram });
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const adapter = new GBAAdapter(makeDevice(transport, boostProfile));

    const readRomRes = await adapter.readROM(0x2000, { cfiInfo: dummyGbaCfi });
    expect(readRomRes.success).toBe(true);
    expect(readRomRes.data).toEqual(rom.subarray(0, 0x2000));
    expect(commands).toContain(BoostCommand.READ_AGB_ROM);

    const writeRomRes = await adapter.writeROM(rom.subarray(0, 0x1000), { cfiInfo: dummyGbaCfi });
    expect(writeRomRes.success).toBe(true);
    expect(commands).toContain(0xa7);
    expect(commands).toContain(BoostCommand.PROGRAM_FLASH);

    const ramData = Uint8Array.from({ length: 0x1000 }, (_, idx) => (idx ^ 0x5a) & 0xff);
    const writeRamRes = await adapter.writeRAM(ramData, { cfiInfo: dummyGbaCfi, ramType: 'SRAM' });
    expect(writeRamRes.success).toBe(true);
    expect(commands).toContain(BoostCommand.WRITE_AGB_RAM);

    const readRamRes = await adapter.readRAM(0x1000, { cfiInfo: dummyGbaCfi, ramType: 'SRAM' });
    expect(readRamRes.success).toBe(true);
    expect('data' in readRamRes ? readRamRes.data : undefined).toEqual(ramData);
    expect(commands).toContain(BoostCommand.READ_AGB_RAM);
    expect(transport.setSignals).not.toHaveBeenCalled();
  });

  it('performs GBC ROM read/program and SRAM read/write in Boost mode without mode reset', async () => {
    const rom = Uint8Array.from({ length: 32 * 1024 }, (_, idx) => (idx * 7) & 0xff);
    const ram = new Uint8Array(8 * 1024);
    const { transport, commands } = createBoostSimulatedTransport(rom, { ramImage: ram });
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const adapter = new MBC5Adapter(makeDevice(transport, boostProfile));

    const readRomRes = await adapter.readROM(0x4000, { cfiInfo: dummyGbcCfi, mbcType: 'MBC5' });
    expect(readRomRes.success).toBe(true);
    expect(readRomRes.data).toEqual(rom.subarray(0, 0x4000));
    expect(commands).toContain(BoostCommand.READ_DMG_ROM);

    const sramData = Uint8Array.from({ length: 0x1000 }, (_, idx) => (idx + 3) & 0xff);
    const writeRamRes = await adapter.writeRAM(sramData, { cfiInfo: dummyGbcCfi, ramType: 'SRAM', mbcType: 'MBC5' });
    expect(writeRamRes.success).toBe(true);
    expect(commands).toContain(BoostCommand.WRITE_DMG_RANGE);

    const readRamRes = await adapter.readRAM(0x1000, { cfiInfo: dummyGbcCfi, ramType: 'SRAM', mbcType: 'MBC5' });
    expect(readRamRes.success).toBe(true);
    expect(readRamRes.data).toEqual(sramData);
    expect(transport.setSignals).not.toHaveBeenCalled();
  });

  it('uses Boost reads in isBlank and resets to default protocol for FRAM readRAM', async () => {
    const blankRom = new Uint8Array(32 * 1024).fill(0xff);
    const { transport, commands } = createBoostSimulatedTransport(blankRom);
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const gbaAdapter = new GBAAdapter(makeDevice(transport, boostProfile));
    const mbc5Adapter = new MBC5Adapter(makeDevice(transport, boostProfile));

    expect(await gbaAdapter.isBlank(0, 0x100)).toBe(true);
    expect(commands).toContain(BoostCommand.READ_AGB_ROM);
    expect(await mbc5Adapter.isBlank(0, 0x100, 'MBC5')).toBe(true);
    expect(commands).toContain(BoostCommand.READ_DMG_ROM);
    expect(transport.setSignals).not.toHaveBeenCalled();

    // Subsequent FRAM readRAM must exit Boost mode via DTR/RTS reset
    await expect(
      gbaAdapter.readRAM(0x100, { cfiInfo: dummyGbaCfi, ramType: 'FRAM' }),
    ).resolves.toBeDefined();
    expect(transport.setSignals).toHaveBeenCalled();
  });

  it('re-enters Boost mode after a read retry channel reset', async () => {
    const rom = Uint8Array.from({ length: 0x2000 }, (_, idx) => (idx * 5) & 0xff);
    const { transport, commands } = createBoostSimulatedTransport(rom);
    const boostProfile = withBeggarBoostProfile(STM_FIRMWARE_PROFILE);
    const adapter = new GBAAdapter(makeDevice(transport, boostProfile));

    const baseImpl = transport.sendAndReceive;
    let failedOnce = false;
    transport.sendAndReceive = vi.fn(async (payload: Uint8Array, readLength: number, timeoutMs?: number) => {
      if (!failedOnce && payload[0] === BoostCommand.READ_AGB_ROM) {
        failedOnce = true;
        throw new Error('simulated read timeout');
      }
      return baseImpl(payload, readLength, timeoutMs);
    });

    const res = await adapter.readROM(0x2000, { cfiInfo: dummyGbaCfi });
    expect(res.success).toBe(true);
    expect(res.data).toEqual(rom);
    expect(transport.setSignals).toHaveBeenCalled();
    expect(commands.filter(cmd => cmd === BoostCommand.MODE_AGB).length).toBeGreaterThanOrEqual(2);
  });
});
