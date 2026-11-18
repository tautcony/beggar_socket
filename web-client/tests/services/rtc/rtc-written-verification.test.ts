import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import { gbc_write, rom_write } from '@/protocol';
import { GBARTC, type GBARTCData } from '@/services/rtc/gba-rtc';
import { MBC3RTC, type MBC3RTCData } from '@/services/rtc/mbc3-rtc';

vi.mock('@/protocol', () => ({
  gbc_read: vi.fn(), gbc_write: vi.fn(async () => {}),
  rom_read: vi.fn(), rom_write: vi.fn(async () => {}),
  toLittleEndian: (value: number) => new Uint8Array([value & 0xff, value >> 8]),
}));

interface Reference { started: number; completed: number }
interface Common { delay: (ms: number) => Promise<void> }
interface GBAInternal extends Common {
  s3511_readByte: () => Promise<number>;
  s3511_writeByte: (value: number) => Promise<void>;
  initializeGPIO: () => Promise<void>;
  checkAndResetIfNeeded: (normalize24Hour?: boolean) => Promise<number>;
  verifyWrittenTime: (target: GBARTCData, reference: Reference) => Promise<void>;
}
interface MBCInternal extends Common {
  readRTCRegister: (register: number) => Promise<number>;
  writeRTCRegister: (register: number, value: number) => Promise<void>;
  verifyWrittenTime: (target: MBC3RTCData, reference: Reference) => Promise<void>;
}
const gbaTarget = { year: 24, month: 1, date: 2, day: 4, hour: 3, minute: 4, second: 5 };
const mbcTarget = { day: 300, hour: 3, minute: 4, second: 5 };
const device = { port: null, transport: {} as Transport };
let clock = 0;

function gbaBytes(data = gbaTarget, status = 0x40) {
  const bcd = (value: number) => Math.floor(value / 10) * 16 + value % 10;
  return [status, ...Object.values(data).map(bcd)];
}
function gbaHarness(snapshots: number[][]) {
  const rtc = new GBARTC(device);
  const internal = rtc as unknown as GBAInternal;
  let byte = 0;
  const read = vi.spyOn(internal, 's3511_readByte').mockImplementation(async () => {
    await Promise.resolve();
    const snapshot = snapshots[Math.min(Math.floor(byte / 8), snapshots.length - 1)];
    return snapshot[byte++ % 8];
  });
  const write = vi.spyOn(internal, 's3511_writeByte').mockResolvedValue();
  const delay = vi.spyOn(internal, 'delay').mockImplementation(async ms => { await Promise.resolve(); clock += ms; });
  const publicRead = vi.spyOn(rtc, 'readTime');
  return { rtc, internal, read, write, delay, publicRead };
}
function mbcHarness(snapshots: number[][]) {
  const rtc = new MBC3RTC(device);
  const internal = rtc as unknown as MBCInternal;
  let byte = 0;
  const read = vi.spyOn(internal, 'readRTCRegister').mockImplementation(async () => {
    await Promise.resolve();
    const snapshot = snapshots[Math.min(Math.floor(byte / 5), snapshots.length - 1)];
    return snapshot[byte++ % 5];
  });
  const delay = vi.spyOn(internal, 'delay').mockImplementation(async ms => { await Promise.resolve(); clock += ms; });
  return { rtc, internal, read, delay };
}
beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('GBA written time verification', () => {
  it('returns on first valid target without reopening GPIO or calling public readTime', async () => {
    const h = gbaHarness([gbaBytes()]);
    await h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 });
    expect(h.read).toHaveBeenCalledTimes(8);
    expect(h.delay).not.toHaveBeenCalled();
    expect(h.publicRead).not.toHaveBeenCalled();
    expect(rom_write).not.toHaveBeenCalledWith(device.transport, expect.anything(), 0xc8 >> 1);
  });
  it('rejects unchanged old time after five attempts', async () => {
    const h = gbaHarness([gbaBytes({ ...gbaTarget, year: 23 })]);
    await expect(h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 })).rejects.toThrow('RTC write verification failed');
    expect(h.read).toHaveBeenCalledTimes(40);
    expect(h.delay).toHaveBeenCalledTimes(4);
  });
  it('retries mismatch then accepts later matching snapshot', async () => {
    const h = gbaHarness([gbaBytes({ ...gbaTarget, minute: 9 }), gbaBytes()]);
    await h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 });
    expect(h.read).toHaveBeenCalledTimes(16);
  });
  it.each([
    ['bad BCD', 7, 0x1a], ['bad date', 3, 0x32], ['test flag', 7, 0x85],
    ['power flag', 0, 0xc0], ['12 hour mode', 0, 0], ['reserved status', 0, 0x41],
    ['weekday mismatch', 4, 1], ['reserved month', 2, 0x81], ['hour 24', 5, 0x24], ['fractional status', 0, 64.5],
  ])('rejects %s', async (_label, index, value) => {
    const bytes = gbaBytes(); bytes[index] = value;
    const h = gbaHarness([bytes]);
    await expect(h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 })).rejects.toThrow('RTC write verification failed');
  });
  it.each([
    [gbaTarget, { ...gbaTarget, second: 6 }],
    [{ ...gbaTarget, second: 59 }, { ...gbaTarget, minute: 5, second: 0 }],
    [{ ...gbaTarget, date: 31, hour: 23, minute: 59, second: 59 }, { ...gbaTarget, month: 2, date: 1, day: 5, hour: 0, minute: 0, second: 0 }],
    [{ ...gbaTarget, month: 2, date: 29, hour: 23, minute: 59, second: 59 }, { ...gbaTarget, month: 3, date: 1, day: 5, hour: 0, minute: 0, second: 0 }],
    [{ ...gbaTarget, year: 99, month: 12, date: 31, hour: 23, minute: 59, second: 59 }, { ...gbaTarget, year: 0, month: 1, date: 1, day: 5, hour: 0, minute: 0, second: 0 }],
  ])('accepts tick and calendar rollover %#', async (target, actual) => {
    clock = 1000;
    const h = gbaHarness([gbaBytes(actual)]);
    await h.internal.verifyWrittenTime(target, { started: 0, completed: 0 });
  });
  it('uses monotonic elapsed time and rejects stale target beyond precision tolerance', async () => {
    clock = 5000;
    const h = gbaHarness([gbaBytes()]);
    await expect(h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 })).rejects.toThrow();
  });
  it('allows the documented AM/PM hour flag in 24-hour mode', async () => {
    const bytes = gbaBytes(); bytes[5] |= 0x40;
    const h = gbaHarness([bytes]);
    await h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 });
  });
  it('includes slow final write duration and excludes post-snapshot serial read duration', async () => {
    clock = 30000;
    const h = gbaHarness([gbaBytes({ ...gbaTarget, second: 35 })]);
    await h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 30000 });
    expect(h.read).toHaveBeenCalledTimes(8);
    const firstRead = h.read.getMockImplementation();
    h.read.mockImplementation(async () => { clock += 500; return (await firstRead?.()) ?? 0; });
    await h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 30000 });
  });
  it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])('rejects invalid monotonic reference %s', async started => {
    const h = gbaHarness([gbaBytes()]);
    await expect(h.internal.verifyWrittenTime(gbaTarget, { started, completed: 0 })).rejects.toThrow('monotonic');
    expect(h.read).not.toHaveBeenCalled();
  });
  it('propagates read failure and releases chip select', async () => {
    const error = new Error('read failed'); const h = gbaHarness([gbaBytes()]);
    h.read.mockRejectedValue(error);
    await expect(h.internal.verifyWrittenTime(gbaTarget, { started: 0, completed: 0 })).rejects.toBe(error);
    expect(rom_write).toHaveBeenLastCalledWith(device.transport, new Uint8Array([1, 0]), 0xc4 >> 1);
  });
  it('setTime verifies copied input and performs final cleanup on mismatch', async () => {
    const h = gbaHarness([gbaBytes({ ...gbaTarget, year: 23 })]);
    vi.spyOn(h.rtc, 'checkCapability').mockResolvedValue(true);
    vi.spyOn(h.internal, 'initializeGPIO').mockResolvedValue();
    vi.spyOn(h.internal, 'checkAndResetIfNeeded').mockResolvedValue(0x40);
    const input = Object.freeze({ ...gbaTarget });
    await expect(h.rtc.setTime(input)).rejects.toThrow('RTC write verification failed');
    expect(input).toEqual(gbaTarget);
    expect(rom_write).toHaveBeenLastCalledWith(device.transport, new Uint8Array([0, 0]), 0xc8 >> 1);
  });
});

describe('MBC3 written time verification', () => {
  it('rejects ignored write and Halt after bounded attempts', async () => {
    for (const snapshot of [[5, 4, 3, 2, 1], [5, 4, 3, 44, 0x41]]) {
      const h = mbcHarness([snapshot]);
      await expect(h.internal.verifyWrittenTime(mbcTarget, { started: clock, completed: clock })).rejects.toThrow('RTC write verification failed');
      expect(h.read).toHaveBeenCalledTimes(25);
      vi.restoreAllMocks();
      vi.spyOn(performance, 'now').mockImplementation(() => clock);
    }
  });
  it('requires zero-to-one latch and returns on a later match', async () => {
    const h = mbcHarness([[5, 9, 3, 44, 1], [6, 4, 3, 44, 1]]);
    await h.internal.verifyWrittenTime(mbcTarget, { started: 0, completed: 0 });
    expect(h.read).toHaveBeenCalledTimes(10);
    expect(vi.mocked(gbc_write).mock.calls.map(([, bytes]) => bytes[0])).toEqual([0, 1, 0, 0, 1, 0]);
  });
  it.each([
    [mbcTarget, [6, 4, 3, 44, 1]],
    [{ day: 365, hour: 23, minute: 59, second: 59 }, [0, 0, 0, 110, 1]],
    [{ day: 511, hour: 23, minute: 59, second: 59 }, [0, 0, 0, 0, 0x80]],
  ])('accepts raw day counter progression %#', async (target, bytes) => {
    clock = 1000; const h = mbcHarness([bytes]);
    await h.internal.verifyWrittenTime(target, { started: 0, completed: 0 });
  });
  it.each([
    { bytes: [60, 4, 3, 44, 1] }, { bytes: [5, 64, 3, 44, 1] },
    { bytes: [5, 4, 24, 44, 1] }, { bytes: [5, 4, 3, 44, 0x81] },
  ])('rejects invalid registers/carry %#', async ({ bytes }) => {
    const h = mbcHarness([bytes]);
    await expect(h.internal.verifyWrittenTime(mbcTarget, { started: 0, completed: 0 })).rejects.toThrow();
  });
  it('preserves read failure when unlatch also fails', async () => {
    const h = mbcHarness([[5, 4, 3, 44, 1]]);
    const primary = new Error('read failed'); const cleanup = new Error('unlatch failed');
    h.read.mockRejectedValue(primary);
    vi.mocked(gbc_write).mockResolvedValueOnce().mockResolvedValueOnce().mockRejectedValueOnce(cleanup);
    await expect(h.internal.verifyWrittenTime(mbcTarget, { started: 0, completed: 0 })).rejects.toBe(primary);
    expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cause: primary, cleanupErrors: [cleanup] }));
  });
  it.each(['ignored write', 'Halt', 'read failure', 'restore failure', 'match'] as const)('setTime handles %s with original control and idle cleanup', async outcome => {
    const h = mbcHarness([[5, 4, 3, 44, 1]]);
    const primary = new Error('verification read failed');
    const cleanup = new Error('restore failed');
    let reads = 0;
    h.read.mockImplementation(async register => {
      await Promise.resolve();
      if (reads++ < 6) return [5, 4, 3, 2, 0xc1, 0][register - 8];
      if (outcome === 'read failure') throw primary;
      return [5, 4, 3, outcome === 'match' || outcome === 'Halt' ? 44 : 2, outcome === 'Halt' ? 0x41 : 1][register - 8];
    });
    let resumed = false;
    const write = vi.spyOn(h.internal, 'writeRTCRegister').mockImplementation(async (register, value) => {
      await Promise.resolve();
      if (register === 0x0c && value === 1) resumed = true;
      else if (resumed && register === 0x0c && outcome === 'restore failure') throw cleanup;
    });
    const input = Object.freeze({ ...mbcTarget });
    if (outcome === 'match') {
      await h.rtc.setTime(input);
      expect(write).toHaveBeenLastCalledWith(0x0c, 1);
    } else {
      const rejection = expect(h.rtc.setTime(input)).rejects;
      if (outcome === 'read failure') await rejection.toBe(primary);
      else await rejection.toThrow('RTC write verification failed');
      expect(write).toHaveBeenLastCalledWith(0x0c, 0xc1);
    }
    expect(input).toEqual(mbcTarget);
    expect(vi.mocked(gbc_write).mock.calls.slice(-3).map(([, bytes, address]) => [address, bytes[0]])).toEqual([[0x6000, 0], [0x4000, 0], [0, 0]]);
    if (outcome === 'restore failure') expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cleanupErrors: [cleanup] }));
  });
});
