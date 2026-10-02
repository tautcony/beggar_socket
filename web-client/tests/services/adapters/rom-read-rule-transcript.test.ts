import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtocolPacketReadError } from '@/protocol/beggar_socket/packet-read';
import { CartridgeAdapter } from '@/services/cartridge-adapter';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import type { ProgressInfo } from '@/types/progress-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const io = vi.hoisted(() => ({ rom: vi.fn(), gbc: vi.fn(), write: vi.fn(), power: vi.fn(), delay: vi.fn(), program: vi.fn() }));
vi.mock('@/protocol', async original => ({
  ...await original<typeof import('@/protocol')>(),
  rom_read: io.rom, gbc_read: io.gbc, ram_write: io.write, gbc_write: io.write,
  cart_power: io.power, setSignals: (transport: DeviceInfo['transport'], signals: SerialOutputSignals) => transport?.setSignals(signals),
  rom_program: io.program, gbc_rom_program: io.program,
}));
vi.mock('@/utils/async-utils', () => ({ timeout: io.delay }));
vi.mock('@/utils/monitoring/sentry-tracker', () => ({ PerformanceTracker: { trackAsyncOperation: (_name: string, operation: () => unknown) => operation() } }));

type Platform = 'gba' | 'mbc';
interface RetryProbe { readROMChunkWithRetry: (...args: unknown[]) => Promise<Uint8Array> }
interface ReadLoopProbe { readROMWithStrategy: (...args: unknown[]) => Promise<unknown> }
let transcript: unknown[][];
const reset = (settle: number) => [
  ['flush'], ['signals', false], ['delay', 10], ['signals', true], ['delay', 10],
  ['signals', false], ['delay', 200], ['drain'], ['delay', settle],
];
const bank = (platform: Platform, value: number) => platform === 'gba'
  ? [['write', 2, [(value & 15) << 4]], ['write', 3, [64]]]
  : [['write', 0x3000, [value >> 8]], ['write', 0x2000, [value & 255]]];
const power = (mode: number) => [['power', mode], ['signals', true], ['delay', 10], ['signals', false], ['delay', 10]];

function options(baseAddress = 0, romPageSize = 4): CommandOptions {
  return {
    baseAddress, romPageSize, size: 4, mbcType: 'MBC5',
    cfiInfo: { deviceSize: 1 << 26, eraseSectorBlocks: [{ sectorSize: 4, sectorCount: 1, totalSize: 4, startAddress: 0, endAddress: 3 }] } as CFIInfo,
  };
}
function setup(platform: Platform, carbon = false) {
  const device: DeviceInfo = {
    port: null, connection: null, firmwareProfile: carbon ? STC_FIRMWARE_PROFILE : STM_FIRMWARE_PROFILE,
    transport: {
      send: vi.fn(), read: vi.fn(), sendAndReceive: vi.fn(),
      flushInput: () => { transcript.push(['flush']); return Promise.resolve(); },
      drainInput: () => { transcript.push(['drain']); return Promise.resolve(); },
      setSignals: signals => { transcript.push(['signals', signals.dataTerminalReady]); return Promise.resolve(); },
    },
  };
  const events: ProgressInfo[] = [];
  const adapter = platform === 'gba'
    ? new GBAAdapter(device, null, event => events.push(event))
    : new MBC5Adapter(device, null, event => events.push(event));
  const read = platform === 'gba' ? io.rom : io.gbc;
  read.mockImplementation((_device: unknown, size: number, address: number) => {
    transcript.push(['read', size, address]);
    return Promise.resolve(Uint8Array.from({ length: size }, (_, index) => (address + index) & 255));
  });
  return { adapter, events, read };
}

describe('ROM read rule baseline transcripts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(io).forEach(mock => mock.mockReset());
    transcript = [];
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romReadRetryCount = 0;
    io.delay.mockImplementation((ms: number) => { transcript.push(['delay', ms]); return Promise.resolve(); });
    io.write.mockImplementation((_device: unknown, bytes: Uint8Array, address: number) => { transcript.push(['write', address, [...bytes]]); return Promise.resolve(); });
    io.power.mockImplementation((_device: unknown, mode: number) => { transcript.push(['power', mode]); return Promise.resolve(true); });
    io.program.mockResolvedValue(undefined);
  });

  it.each(['gba', 'mbc'] as const)('%s preserves byte addresses and bounded bank transitions', async platform => {
    const { adapter } = setup(platform);
    const window = platform === 'gba' ? 1 << 25 : 0x4000;
    const base = window - 2;
    const result = await adapter.readROM(6, options(base), undefined, false);
    expect(result).toMatchObject({ success: true, message: 'messages.rom.readSuccess' });
    expect([...result.data ?? []]).toEqual([254, 255, 0, 1, 2, 3]);
    expect(transcript).toEqual([...reset(100), ...bank(platform, 0), ['read', 2, platform === 'gba' ? base : 0x7ffe], ...bank(platform, 1), ['read', 4, platform === 'gba' ? window : 0x4000]]);
  });

  it.each([true, false])('preserves showProgress=%s event cadence across ten chunks', async showProgress => {
    for (const platform of ['gba', 'mbc'] as const) {
      const { adapter, events } = setup(platform);
      await adapter.readROM(11, options(0, 1), undefined, showProgress);
      expect(events.map(event => [event.state, event.transferredBytes, event.showProgress])).toEqual([
        ['running', 0, showProgress], ['running', 10, showProgress], ['running', 11, showProgress], ['completed', 11, showProgress],
      ]);
    }
  });

  it.each(['gba', 'mbc'] as const)('%s retains its throttle policy', async platform => {
    const { adapter } = setup(platform);
    AdvancedSettings.romReadThrottleMs = 7;
    await adapter.readROM(3, options(0, 1));
    expect(io.delay.mock.calls.filter(([ms]) => ms === 7)).toHaveLength(platform === 'gba' ? 2 : 0);
  });

  it.each(['gba', 'mbc'] as const)('%s restores bank after reset before attempt-scaled retry delays', async platform => {
    const { adapter, read } = setup(platform);
    const address = platform === 'gba' ? (1 << 25) + 6 : 0x4006;
    const cartAddress = address;
    AdvancedSettings.romReadRetryCount = 2;
    AdvancedSettings.romReadRetryDelayMs = 7;
    read.mockImplementationOnce(() => { transcript.push(['failed']); return Promise.reject(new Error('first')); })
      .mockImplementationOnce(() => { transcript.push(['failed']); return Promise.reject(new Error('second')); });
    expect((await adapter.readROM(4, options(address))).success).toBe(true);
    expect(transcript).toEqual([
      ...reset(100), ...bank(platform, 1), ['failed'], ...reset(120), ...bank(platform, 1), ['delay', 7],
      ['failed'], ...reset(120), ...bank(platform, 1), ['delay', 14], ['read', 4, cartAddress],
    ]);
  });

  it.each(['gba', 'mbc'] as const)('%s preserves last exhausted protocol cause without extra recovery', async platform => {
    const { adapter, read, events } = setup(platform);
    AdvancedSettings.romReadRetryCount = 1;
    const cause = new ProtocolPacketReadError('PACKET_TIMEOUT', 'last', 'detail');
    read.mockRejectedValueOnce(new Error('first')).mockRejectedValue(cause);
    const result = await adapter.readROM(4, options(), undefined, false);
    expect(result.error).toMatchObject({ code: 'timeout', cause });
    expect(result.error?.cause).toBe(cause);
    expect(read).toHaveBeenCalledTimes(2);
    expect(transcript).toEqual([...reset(100), ...bank(platform, 0), ...reset(120), ...bank(platform, 0)]);
    expect(events.map(event => [event.state, event.showProgress])).toEqual([['running', false], ['error', false]]);
  });

  it.each(['gba', 'mbc'] as const)('%s checks abort before hardware and between chunks but accepts the final command', async platform => {
    const { adapter, read, events } = setup(platform);
    const controller = new AbortController();
    const reason = new Error('user');
    controller.abort(reason);
    const pre = await adapter.readROM(4, options(), controller.signal, false);
    expect(pre.error?.cause).toBe(reason);
    expect(pre.error?.code).toBe('aborted');
    expect(transcript).toEqual([]);
    expect(events.map(event => event.state)).toEqual(['error']);

    for (const size of [8, 4]) {
      const during = new AbortController();
      read.mockImplementationOnce((_device: unknown, length: number) => {
        during.abort(reason);
        return Promise.resolve(new Uint8Array(length).fill(9));
      });
      const result = await adapter.readROM(size, options(), during.signal);
      expect(result.success).toBe(size === 4);
      if (size === 8) expect(result.error).toMatchObject({ code: 'aborted', cause: reason });
      else expect([...result.data ?? []]).toEqual([9, 9, 9, 9]);
    }
  });

  it.each(['success', 'failure', 'cancel'] as const)('MBC 5V %s preserves enable/reset/finally command sequence', async outcome => {
    const { adapter, read } = setup('mbc', true);
    const controller = new AbortController();
    if (outcome === 'failure') read.mockRejectedValue(new Error('read failed'));
    if (outcome === 'cancel') read.mockImplementationOnce(() => { controller.abort(); transcript.push(['read', 4, 0x4000]); return Promise.resolve(new Uint8Array(4)); });
    const result = await adapter.readROM(outcome === 'cancel' ? 8 : 4, { ...options(), enable5V: true }, controller.signal);
    expect(result.success).toBe(outcome === 'success');
    expect(transcript).toEqual([
      ...power(0), ['delay', 120], ...power(2), ['delay', 350], ...reset(100), ...bank('mbc', 0),
      ...(outcome === 'failure' ? [] : [['read', 4, 0x4000]]), ...power(1), ['delay', 200],
    ]);
  });

  it('MBC rejects unsupported 5V before progress or hardware', async () => {
    const { adapter, events } = setup('mbc');
    const result = await adapter.readROM(4, { ...options(), enable5V: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('MBC 5V power control');
    expect(result.error).toBeUndefined();
    expect(transcript).toEqual([]);
    expect(events).toEqual([]);
  });

  it('GBA single-bank cartridges never switch bank', async () => {
    const { adapter } = setup('gba');
    const opts = options();
    opts.cfiInfo = { ...opts.cfiInfo, deviceSize: 0x200000 };
    expect((await adapter.readROM(4, opts)).success).toBe(true);
    expect(transcript).toEqual([...reset(100), ['read', 4, 0]]);
  });

  it.each(['gba', 'mbc'] as const)('%s write sampling uses the existing atomic retry entry', async platform => {
    const { adapter, read } = setup(platform);
    AdvancedSettings.romReadRetryCount = 1;
    read.mockRejectedValueOnce(new Error('sample timeout')).mockResolvedValue(new Uint8Array(4).fill(255));
    const retry = vi.spyOn(CartridgeAdapter.prototype as unknown as RetryProbe, 'readROMChunkWithRetry');
    const result = await adapter.writeROM(new Uint8Array([1, 2, 3, 4]), options());
    expect(result.success).toBe(true);
    expect(retry).toHaveBeenCalled();
    expect(retry.mock.calls[0]?.slice(0, 3)).toEqual([4, 0, platform === 'gba' ? 0 : 0x4000]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(transcript).toContainEqual(['delay', 120]);
  });

  it.each(['gba', 'mbc'] as const)('%s public read executes the shared loop and atomic retry', async platform => {
    const { adapter } = setup(platform);
    const loop = vi.spyOn(CartridgeAdapter.prototype as unknown as ReadLoopProbe, 'readROMWithStrategy');
    const retry = vi.spyOn(CartridgeAdapter.prototype as unknown as RetryProbe, 'readROMChunkWithRetry');
    expect((await adapter.readROM(8, options())).success).toBe(true);
    expect(loop).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it('GBA verification retains the shared atomic retry and bank restoration', async () => {
    const { adapter, read } = setup('gba');
    AdvancedSettings.romReadRetryCount = 1;
    read.mockRejectedValueOnce(new Error('verify timeout')).mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const retry = vi.spyOn(CartridgeAdapter.prototype as unknown as RetryProbe, 'readROMChunkWithRetry');
    expect((await adapter.verifyROM(new Uint8Array([1, 2, 3, 4]), options(), new AbortController().signal)).success).toBe(true);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(transcript).toContainEqual(['delay', 120]);
    expect(io.write.mock.calls.map(([, bytes, address]) => [address as number, [...bytes as Uint8Array]])).toEqual([[2, [0]], [3, [64]], [2, [0]], [3, [64]]]);
  });

  it.each(['gba', 'mbc'] as const)('%s zero-length read emits start/completion without bank commands', async platform => {
    const { adapter, events } = setup(platform);
    const result = await adapter.readROM(0, options(), undefined, false);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
    expect(transcript).toEqual(reset(100));
    expect(events.map(event => [event.state, event.transferredBytes])).toEqual([['running', 0], ['completed', 0]]);
  });

  it('MBC3 bank-zero mapping preserves its fixed window and register command', async () => {
    const { adapter } = setup('mbc');
    const result = await adapter.readROM(6, { ...options(0x3ffe), mbcType: 'MBC3' });
    expect(result.success).toBe(true);
    expect(transcript).toEqual([...reset(100), ['write', 0x2000, [1]], ['read', 2, 0x3ffe], ['write', 0x2000, [1]], ['read', 4, 0x4000]]);
  });

  it('base hardware entries explicitly reject unimplemented calls', async () => {
    const adapter = new CartridgeAdapter({ port: null, connection: null });
    await expect(adapter.readROM(4, options())).rejects.toThrow("isn't implemented");
    await expect(adapter.getCartInfo()).rejects.toThrow("isn't implemented");
  });
});
