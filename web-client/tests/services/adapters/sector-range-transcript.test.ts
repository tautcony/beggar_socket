import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type { ProgressInfo } from '@/types/progress-info';
import { parseCFI } from '@/utils/parsers/cfi-parser';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), program: vi.fn(), erase: vi.fn(), reset: vi.fn(),
}));

vi.mock('@/protocol', async () => ({
  ...await vi.importActual<typeof import('@/protocol')>('@/protocol'),
  rom_read: mocks.read,
  gbc_read: mocks.read,
  rom_program: mocks.program,
  gbc_rom_program: mocks.program,
  rom_erase_sector: mocks.erase,
  gbc_rom_erase_sector: mocks.erase,
  rom_write: mocks.reset,
  gbc_write: mocks.reset,
}));

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

function cfi(boot: number) {
  const query = new Uint8Array(256);
  query[0x20] = 0x51; query[0x22] = 0x52; query[0x24] = 0x59;
  query[0x36] = 0x27; query[0x38] = 0x36;
  query[0x4e] = 20; query[0x54] = 0; query[0x58] = 2;
  query[0x5a] = 7; query[0x5e] = 0x20;
  query[0x62] = 14; query[0x68] = 1;
  query[0x2a] = 0x40;
  query[0x80] = 0x50; query[0x82] = 0x52; query[0x84] = 0x49;
  query[0x9e] = boot;
  const result = parseCFI(query);
  if (!result) throw new Error('Expected valid 1MiB boot geometry');
  return result;
}

describe.each(['gba', 'mbc5'] as const)('%s physical sector transcripts', (platform) => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(mocks).forEach(mock => mock.mockReset());
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romWriteRetryCount = 1;
    AdvancedSettings.romWriteRetryDelayMs = 0;
    mocks.reset.mockResolvedValue(undefined);
  });

  function session(boot: number, baseAddress: number, size: number) {
    const geometry = cfi(boot);
    const memory = new Uint8Array(geometry.deviceSize).fill(0x5a);
    const progress: ProgressInfo[] = [];
    const transcript: { type: string; address: number; bytes: number[] }[] = [];
    const device: DeviceInfo = {
      port: null,
      transport: {
        send: vi.fn(), read: vi.fn(), sendAndReceive: vi.fn(), setSignals: vi.fn(), flushInput: vi.fn(),
      },
    };
    const adapter = platform === 'gba'
      ? new GBAAdapter(device, null, info => progress.push(info))
      : new MBC5Adapter(device, null, info => progress.push(info));
    let currentBank = 0;
    vi.spyOn(adapter, 'switchROMBank').mockImplementation((bank: number) => { currentBank = bank; return Promise.resolve(); });
    const absolute = (address: number) => platform === 'gba' || currentBank === 0
      ? address
      : currentBank * 0x4000 + address - 0x4000;

    mocks.read.mockImplementation((_transport, length: number, address: number) => {
      const start = absolute(address);
      const data = memory.slice(start, start + length);
      transcript.push({ type: 'read', address: start, bytes: Array.from(data) });
      return Promise.resolve(data);
    });
    mocks.erase.mockImplementation((_transport, address: number) => {
      const start = absolute(address);
      const region = geometry.eraseSectorBlocks.find(block => start >= block.startAddress && start <= block.endAddress);
      if (!region || (start - region.startAddress) % region.sectorSize !== 0) {
        throw new Error(`Invalid physical erase address ${start}`);
      }
      transcript.push({ type: 'erase', address: start, bytes: [] });
      memory.fill(0xff, start, start + region.sectorSize);
      return Promise.resolve();
    });
    let failSecondProgram = false;
    let programCount = 0;
    mocks.program.mockImplementation((_transport, bytes: Uint8Array, address: number) => {
      const start = absolute(address);
      transcript.push({ type: 'program', address: start, bytes: Array.from(bytes) });
      memory.set(bytes, start);
      if (failSecondProgram && ++programCount === 2) return Promise.reject(new Error('dirty partial program timeout'));
      return Promise.resolve();
    });
    const options: CommandOptions = {
      mbcType: 'MBC5', cfiInfo: geometry, baseAddress, size, romPageSize: 4,
    };
    const file = Uint8Array.from({ length: size }, (_, i) => (i * 17 + 3) & 0xff);
    return { adapter, options, file, memory, progress, transcript, failProgram: () => { failSecondProgram = true; } };
  }

  it.each([
    [2, 0x20000, 12, [0x20000]],
    [2, 0xfffa, 12, [0xe000, 0x10000]],
    [3, 0xefffa, 12, [0xe0000, 0xf0000]],
    [2, 0xffff4, 12, [0xf0000]],
  ])('erases physical sectors once and transfers logical range (boot %i base %i)', async (boot, base, size, addresses) => {
    const state = session(boot, base, size);
    const write = await state.adapter.writeROM(state.file, state.options);
    expect(write.success, write.message).toBe(true);
    expect(state.transcript.filter(call => call.type === 'erase').map(call => call.address)).toEqual(addresses);
    const programmed = state.transcript.filter(call => call.type === 'program');
    expect(programmed[0].address).toBe(base);
    expect(programmed.flatMap(call => call.bytes)).toEqual(Array.from(state.file));
    expect(programmed.every(call => call.address >= base && call.address + call.bytes.length <= base + size)).toBe(true);
    expect(state.memory.slice(base, base + size)).toEqual(state.file);
    const finalWrite = state.progress[state.progress.length - 1];
    expect(finalWrite.transferredBytes).toBe(size);
    expect(finalWrite.sectorProgress?.addresses).toEqual(addresses);
    expect(finalWrite.sectorProgress?.completedSectors).toBe(addresses.length);
    // Entire affected sectors are erased; only completely untouched sectors retain the sentinel.
    if (addresses[0] > 0) expect(state.memory[addresses[0] - 1]).toBe(0x5a);
    const lastAddress = addresses[addresses.length - 1];
    const lastRegion = state.options.cfiInfo.eraseSectorBlocks.find(block => lastAddress >= block.startAddress && lastAddress <= block.endAddress);
    if (!lastRegion) throw new Error('Missing last physical erase region');
    const eraseEnd = lastAddress + lastRegion.sectorSize;
    if (eraseEnd < state.memory.length) expect(state.memory[eraseEnd]).toBe(0x5a);
    if (base > addresses[0]) expect(state.memory[base - 1]).toBe(0xff);
    if (base + size < eraseEnd) expect(state.memory[base + size]).toBe(0xff);

    state.transcript.length = 0;
    const verify = await state.adapter.verifyROM(state.file, state.options);
    expect(verify.success, verify.message).toBe(true);
    expect(state.transcript.every(call => call.type === 'read' && call.address >= base && call.address + call.bytes.length <= base + size)).toBe(true);
    expect(state.transcript.flatMap(call => call.bytes)).toEqual(Array.from(state.file));
  });

  it('replays a dirty partial first sector from the requested base without negative offsets', async () => {
    const base = 0xfffa;
    const state = session(2, base, 12);
    state.failProgram();
    const write = await state.adapter.writeROM(state.file, state.options);
    expect(write.success, write.message).toBe(true);
    expect(state.transcript.filter(call => call.type === 'erase').map(call => call.address)).toEqual([0xe000, 0x10000, 0xe000]);
    const calls = state.transcript.filter(call => call.type === 'program');
    expect(calls.map(call => call.address)).toEqual([base, base + 4, base, base + 4, base + 6, base + 10]);
    expect(calls.every(call => call.address >= base && call.address + call.bytes.length <= base + state.file.length)).toBe(true);
    expect(calls[2].bytes).toEqual(Array.from(state.file.slice(0, 4)));
    expect(state.memory.slice(base, base + state.file.length)).toEqual(state.file);
    expect(state.progress.filter(info => info.type === 'write').every(info => (info.transferredBytes ?? 0) >= 0)).toBe(true);
    expect(state.progress[state.progress.length - 1]?.sectorProgress?.completedSectors).toBe(2);
  });

  it('rejects a range beyond capacity before any device IO', async () => {
    const state = session(2, 0xffffa, 12);
    const result = await state.adapter.writeROM(state.file, state.options);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient sector space');
    expect(result.error?.cause).toBeInstanceOf(Error);
    expect(state.transcript).toEqual([]);
  });
});
