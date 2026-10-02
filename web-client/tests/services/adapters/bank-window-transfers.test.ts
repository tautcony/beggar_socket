import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

import { assertBinaryEqual } from '../../helpers/binary-assertion';

const io = vi.hoisted(() => ({ readRom: vi.fn(), readRam: vi.fn(), writeRam: vi.fn(), readGbc: vi.fn(), writeGbc: vi.fn() }));
vi.mock('@/protocol', async (original) => ({
  ...await original<typeof import('@/protocol')>(),
  rom_read: io.readRom,
  ram_read: io.readRam,
  ram_read_fram: io.readRam,
  ram_write: io.writeRam,
  ram_write_fram: io.writeRam,
  gbc_read: io.readGbc,
  gbc_read_fram: io.readGbc,
  gbc_write: io.writeGbc,
  gbc_write_fram: io.writeGbc,
}));
vi.mock('@/utils/async-utils', () => ({ timeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: { trackAsyncOperation: (_name: string, operation: () => unknown) => operation() },
}));

const device = (): DeviceInfo => ({
  port: null, connection: null, firmwareProfile: STM_FIRMWARE_PROFILE,
  transport: { send: vi.fn(), read: vi.fn(), sendAndReceive: vi.fn(), flushInput: vi.fn(), setSignals: vi.fn() },
});
const cfiInfo = {
  deviceSize: 1 << 27, eraseSectorBlocks: [{ sectorSize: 65536, sectorCount: 2048, totalSize: 1 << 27, startAddress: 0, endAddress: (1 << 27) - 1 }],
} as unknown as CFIInfo;
const options = (baseAddress: number, size: number): CommandOptions => ({
  cfiInfo, baseAddress, size, romPageSize: 8192, ramPageSize: 8192, mbcType: 'MBC5',
});
function dataAt(address: number, size: number, window: number) {
  return Uint8Array.from({ length: size }, (_, index) => ((Math.floor((address + index) / window) * 59) + index + address) & 255);
}
function checkedRead(memory: Uint8Array, address: number, size: number, window: number) {
  if ((address % window) + size > window) throw new Error('Bank window overflow');
  if (address < 0 || address + size > memory.length) throw new Error('Memory capacity overflow');
  return memory.slice(address, address + size);
}

describe('adapter bank window transfers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(io).forEach(mock => mock.mockReset());
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romReadRetryCount = 0;
    AdvancedSettings.ramReadRetryCount = 0;
  });

  it.each([['gba', 1], ['gba', 2], ['mbc', 1]] as const)('%s reads and verifies ROM at boundary %s', async (platform, boundary) => {
    const window = platform === 'gba' ? 1 << 25 : 1 << 14;
    const base = window * boundary - 16;
    const size = 128 * 1024;
    const expected = dataAt(base, size, window);
    let bank = -1;
    const adapter = platform === 'gba' ? new GBAAdapter(device()) : new MBC5Adapter(device());
    vi.spyOn(adapter, 'switchROMBank').mockImplementation((next: number) => { bank = next; return Promise.resolve(); });
    const read = (_device: unknown, length: number, cart: number) => {
      const address = platform === 'gba' ? cart : bank * window + (cart & 0x3fff);
      if (Math.floor(address / window) !== bank || address % window + length > window) throw new Error('Bank window overflow');
      return dataAt(address, length, window);
    };
    io.readRom.mockImplementation(read);
    io.readGbc.mockImplementation(read);
    const result = await adapter.readROM(size, options(base, size), undefined, false);
    expect(result.success).toBe(true);
    if (!result.data) throw new Error('Expected ROM bytes');
    assertBinaryEqual(result.data, expected);
    expect((await adapter.verifyROM(expected, options(base, size))).success).toBe(true);
  });

  it.each([
    ['gba', 'SRAM', 65520], ['gba', 'FRAM', 65520],
    ['gba', 'SRAM', 65536], ['gba', 'FRAM', 65536],
    ['gba', 'SRAM', 131056], ['gba', 'FRAM', 131056],
    ['mbc', 'SRAM', 8176], ['mbc', 'FRAM', 8176],
  ] as const)('%s %s writes, reads and verifies a 128 KiB non-aligned range', async (platform, ramType, base) => {
    const window = platform === 'gba' ? 65536 : 8192;
    const payload = dataAt(base, (128 * 1024) - base, window);
    const memory = new Uint8Array(base + payload.length).fill(0x5a);
    let bank = -1;
    const adapter = platform === 'gba' ? new GBAAdapter(device()) : new MBC5Adapter(device());
    if (adapter instanceof GBAAdapter) vi.spyOn(adapter, 'switchSRAMBank').mockImplementation((next: number) => { bank = next; return Promise.resolve(); });
    else vi.spyOn(adapter, 'switchRAMBank').mockImplementation((next: number) => { bank = next; return Promise.resolve(); });
    const addressOf = (cart: number) => bank * window + (platform === 'gba' ? cart : cart - 0xa000);
    const read = (_device: unknown, length: number, cart: number) => checkedRead(memory, addressOf(cart), length, window);
    const write = (_device: unknown, bytes: Uint8Array, cart: number) => {
      if (platform === 'mbc' && cart < 0xa000) return;
      const address = addressOf(cart);
      checkedRead(memory, address, bytes.length, window);
      memory.set(bytes, address);
    };
    io.readRam.mockImplementation(read);
    io.readGbc.mockImplementation(read);
    io.writeRam.mockImplementation(write);
    io.writeGbc.mockImplementation(write);
    const opts = { ...options(base, payload.length), ramType };
    expect((await adapter.writeRAM(payload, opts)).success).toBe(true);
    assertBinaryEqual(memory.slice(base), payload);
    assertBinaryEqual(memory.slice(0, base), new Uint8Array(base).fill(0x5a));
    const result = await adapter.readRAM(payload.length, opts);
    expect(result.success).toBe(true);
    if (!('data' in result) || !result.data) throw new Error('Expected RAM bytes');
    assertBinaryEqual(result.data, payload);
    expect((await adapter.verifyRAM(payload, opts)).success).toBe(true);
  });

  it('restores the absolute GBA RAM bank after a read retry', async () => {
    const adapter = new GBAAdapter(device());
    const expected = dataAt(0x1fff0, 16, 65536);
    let bank = -1;
    const switchBank = vi.spyOn(adapter, 'switchSRAMBank').mockImplementation((next: number) => {
      bank = next;
      return Promise.resolve();
    });
    AdvancedSettings.ramReadRetryCount = 1;
    io.readRam.mockImplementationOnce(() => {
      bank = 0;
      throw new Error('Read timeout reset bank state');
    }).mockImplementation((_device: unknown, size: number, cart: number) => {
      expect(bank).toBe(1);
      expect(cart).toBe(0xfff0);
      expect(size).toBe(16);
      return expected;
    });
    const result = await adapter.readRAM(16, options(0x1fff0, 16));
    expect(result.success).toBe(true);
    if (!('data' in result) || !result.data) throw new Error('Expected RAM bytes');
    assertBinaryEqual(result.data, expected);
    expect(switchBank.mock.calls).toEqual([[1], [1]]);
  });
});
