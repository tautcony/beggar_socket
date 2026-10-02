import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import { gbc_read, gbc_write, rom_read, rom_write } from '@/protocol';
import { BaseRTC, type RTCWriteReference } from '@/services/rtc/base-rtc';
import { GBARTC, type GBARTCData } from '@/services/rtc/gba-rtc';
import { MBC3RTC, type MBC3RTCData } from '@/services/rtc/mbc3-rtc';

vi.mock('@/protocol', () => ({
  gbc_read: vi.fn(() => Promise.resolve(new Uint8Array(1))),
  gbc_write: vi.fn(async () => {}),
  rom_read: vi.fn(() => Promise.resolve(new Uint8Array(6))),
  rom_write: vi.fn(async () => {}),
  toLittleEndian: (value: number) => new Uint8Array([value & 0xff, value >> 8]),
}));

interface GBAInternals {
  initializeGPIO: () => Promise<void>;
  cleanupGPIO: () => Promise<void>;
  checkAndResetIfNeeded: (normalize24Hour?: boolean) => Promise<number>;
  s3511_writeByte: (value: number) => Promise<void>;
  verifyWrittenTime: (target: GBARTCData, reference: RTCWriteReference) => Promise<void>;
  delay: () => Promise<void>;
}

interface MBC3Internals {
  enableRAMAccess: () => Promise<void>;
  latchTime: () => Promise<void>;
  unlatchTime: () => Promise<void>;
  readRTCRegister: (register: number) => Promise<number>;
  writeRTCRegister: (register: number, value: number) => Promise<void>;
  stopTimer: () => Promise<void>;
  startTimer: () => Promise<void>;
  verifyWrittenTime: (target: MBC3RTCData, reference: RTCWriteReference) => Promise<void>;
}

function gbaHarness() {
  const rtc = new GBARTC({ port: null, transport: {} as Transport });
  const internal = rtc as unknown as GBAInternals;
  const capability = vi.spyOn(rtc, 'checkCapability').mockResolvedValue(true);
  const initialize = vi.spyOn(internal, 'initializeGPIO').mockResolvedValue();
  const cleanup = vi.spyOn(internal, 'cleanupGPIO').mockResolvedValue();
  const reset = vi.spyOn(internal, 'checkAndResetIfNeeded').mockResolvedValue(0);
  const write = vi.spyOn(internal, 's3511_writeByte').mockResolvedValue();
  const verify = vi.spyOn(internal, 'verifyWrittenTime').mockResolvedValue();
  vi.spyOn(internal, 'delay').mockResolvedValue();
  return { rtc, capability, initialize, cleanup, reset, write, verify };
}

function mbc3Harness() {
  const rtc = new MBC3RTC({ port: null, transport: {} as Transport });
  const internal = rtc as unknown as MBC3Internals;
  const enable = vi.spyOn(internal, 'enableRAMAccess').mockResolvedValue();
  const latch = vi.spyOn(internal, 'latchTime').mockResolvedValue();
  const unlatch = vi.spyOn(internal, 'unlatchTime').mockResolvedValue();
  const read = vi.spyOn(internal, 'readRTCRegister').mockResolvedValue(0);
  const write = vi.spyOn(internal, 'writeRTCRegister').mockResolvedValue();
  const stop = vi.spyOn(internal, 'stopTimer').mockResolvedValue();
  const start = vi.spyOn(internal, 'startTimer').mockResolvedValue();
  const verify = vi.spyOn(internal, 'verifyWrittenTime').mockResolvedValue();
  return { rtc, enable, latch, unlatch, read, write, stop, start, verify };
}

const gbaValid = { year: 24, month: 2, date: 29, day: 0, hour: 23, minute: 59, second: 59 };
const mbc3Valid = { day: 366, hour: 23, minute: 59, second: 59 };
const malformed = [NaN, Infinity, -Infinity, 1.5, '1', undefined, null, true, {}, []];

function invalidFields(valid: Record<string, number>) {
  return Object.keys(valid).flatMap(field => malformed.map(value => ({
    field,
    value,
    input: { ...valid, [field]: value },
  })));
}

function expectNoProtocolIO() {
  for (const operation of [gbc_read, gbc_write, rom_read, rom_write]) {
    expect(operation).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('GBA RTC input contract', () => {
  async function rejectsWithoutIO(input: unknown) {
    const harness = gbaHarness();
    await expect(harness.rtc.setTime(input)).rejects.toThrow();
    for (const operation of [harness.capability, harness.initialize, harness.cleanup, harness.reset, harness.write, harness.verify]) {
      expect(operation).not.toHaveBeenCalled();
    }
    expectNoProtocolIO();
  }

  it.each(invalidFields(gbaValid))('rejects malformed $field=$value without I/O or cleanup', async ({ input }) => {
    await rejectsWithoutIO(input);
  });

  it.each([null, undefined, [], 'time', 42, {}, ...Object.keys(gbaValid).map(field => Object.fromEntries(Object.entries(gbaValid).filter(([key]) => key !== field)))])('rejects malformed shape %#', rejectsWithoutIO);

  it.each([
    ['year', -1], ['year', 100], ['month', 0], ['month', 13], ['date', 0], ['date', 30],
    ['day', -1], ['day', 7], ['hour', -1], ['hour', 24], ['minute', -1], ['minute', 60], ['second', -1], ['second', 60],
  ])('rejects out-of-range %s=%s', async (field, value) => {
    await rejectsWithoutIO({ ...gbaValid, [field]: value });
  });

  it('rejects non-leap February 29', async () => {
    await rejectsWithoutIO({ ...gbaValid, year: 23 });
  });

  it.each([
    { year: 0, month: 1, date: 1, day: 6, hour: 0, minute: 0, second: 0 },
    { year: 99, month: 12, date: 31, day: 0, hour: 23, minute: 59, second: 59 },
    gbaValid,
  ])('accepts valid boundaries and independently chosen weekday %#', async input => {
    const { rtc, write } = gbaHarness();
    await rtc.setTime(input);
    const bcd = (value: number) => (Math.floor(value / 10) << 4) | (value % 10);
    expect(write.mock.calls.map(([value]) => value)).toEqual([0x26, ...Object.values(input).map(bcd)]);
  });

  it('snapshots fields before awaiting capability', async () => {
    const { rtc, capability, write, verify } = gbaHarness();
    const input = { ...gbaValid };
    capability.mockImplementation(() => {
      input.year = 99;
      input.second = 0;
      return Promise.resolve(true);
    });
    await rtc.setTime(input);
    expect(write.mock.calls.map(([value]) => value)).toEqual([0x26, 0x24, 0x02, 0x29, 0x00, 0x23, 0x59, 0x59]);
    expect(verify).toHaveBeenCalledWith(gbaValid, { started: expect.any(Number), completed: expect.any(Number) });
  });

  it.each([DateTime.invalid('test'), DateTime.fromObject({ year: 1999 }), DateTime.fromObject({ year: 2100 })])('rejects unsupported DateTime %# without I/O', async dt => {
    const { rtc, capability, cleanup } = gbaHarness();
    await expect(rtc.setTimeFromDateTime(dt)).rejects.toThrow();
    expect(capability).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
    expectNoProtocolIO();
  });
});

describe('MBC3 RTC input contract', () => {
  async function rejectsWithoutIO(input: unknown) {
    const harness = mbc3Harness();
    await expect(harness.rtc.setTime(input)).rejects.toThrow();
    for (const operation of [harness.enable, harness.latch, harness.unlatch, harness.read, harness.write, harness.stop, harness.start, harness.verify]) {
      expect(operation).not.toHaveBeenCalled();
    }
    expectNoProtocolIO();
  }

  it.each(invalidFields(mbc3Valid))('rejects malformed $field=$value without I/O', async ({ input }) => {
    await rejectsWithoutIO(input);
  });

  it.each([null, undefined, [], 'time', 42, {}, ...Object.keys(mbc3Valid).map(field => Object.fromEntries(Object.entries(mbc3Valid).filter(([key]) => key !== field)))])('rejects malformed shape %#', rejectsWithoutIO);

  it.each([['day', 0], ['day', 367], ['day', 511], ['hour', -1], ['hour', 24], ['minute', -1], ['minute', 60], ['second', -1], ['second', 60]])('rejects out-of-range %s=%s', async (field, value) => {
    await rejectsWithoutIO({ ...mbc3Valid, [field]: value });
  });

  it.each([
    { day: 1, hour: 0, minute: 0, second: 0 },
    mbc3Valid,
  ])('accepts leap-year ordinal boundaries %#', async input => {
    const { rtc, write } = mbc3Harness();
    await rtc.setTime(input);
    expect(write.mock.calls).toEqual([[0x08, input.second], [0x09, input.minute], [0x0a, input.hour], [0x0b, input.day & 0xff], [0x0c, input.day >> 8]]);
  });

  it('accepts ordinal 365 and rejects 366 in a common year', async () => {
    vi.setSystemTime(new Date('2023-06-01T12:00:00Z'));
    await rejectsWithoutIO(mbc3Valid);
    const { rtc, write } = mbc3Harness();
    await rtc.setTime({ ...mbc3Valid, day: 365 });
    expect(write).toHaveBeenCalledWith(0x0b, 109);
  });

  it('snapshots fields before awaiting RAM access', async () => {
    const { rtc, enable, write, verify } = mbc3Harness();
    const input = { ...mbc3Valid };
    enable.mockImplementation(() => {
      input.day = 1;
      input.second = 0;
      return Promise.resolve();
    });
    await rtc.setTime(input);
    expect(write.mock.calls).toEqual([[0x08, 59], [0x09, 59], [0x0a, 23], [0x0b, 110], [0x0c, 1]]);
    expect(verify).toHaveBeenCalledWith(mbc3Valid, { started: expect.any(Number), completed: expect.any(Number) });
  });

  it('rejects invalid DateTime before I/O', async () => {
    const { rtc, enable } = mbc3Harness();
    await expect(rtc.setTimeFromDateTime(DateTime.invalid('test'))).rejects.toThrow();
    expect(enable).not.toHaveBeenCalled();
    expectNoProtocolIO();
  });

  it('rejects a leap-year DateTime ordinal outside the current common year', async () => {
    vi.setSystemTime(new Date('2023-06-01T12:00:00Z'));
    const { rtc, enable } = mbc3Harness();
    await expect(rtc.setTimeFromDateTime(DateTime.fromObject({ year: 2024, month: 12, day: 31 }))).rejects.toThrow();
    expect(enable).not.toHaveBeenCalled();
    expectNoProtocolIO();
  });
});

class DateValidatorRTC extends BaseRTC {
  static validate(year: number, month: number, day: number, hour: number, minute: number, second: number) {
    return BaseRTC.isValidDateTime(year, month, day, hour, minute, second);
  }

  setTime(): Promise<void> { return Promise.resolve(); }
  readTime() { return Promise.resolve({ status: false }); }
  checkCapability() { return Promise.resolve(false); }
}

it.each([NaN, Infinity, -Infinity, 1.5])('base date validation rejects non-finite or fractional values %s', value => {
  expect(DateValidatorRTC.validate(2024, 1, 1, 0, 0, value)).toBe(false);
});
