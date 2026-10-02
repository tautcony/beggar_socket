import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import { gbc_read, gbc_write, rom_read, rom_write } from '@/protocol';
import { GBARTC } from '@/services/rtc/gba-rtc';
import { MBC3RTC } from '@/services/rtc/mbc3-rtc';

vi.mock('@/protocol', () => ({
  gbc_read: vi.fn(),
  gbc_write: vi.fn(),
  rom_read: vi.fn(),
  rom_write: vi.fn(),
  toLittleEndian: (value: number) => new Uint8Array([value & 0xff, value >> 8]),
}));

interface Command { kind: 'read' | 'write'; address: number | undefined; value?: number }
interface DelayRTC { delay: (ms: number) => Promise<void> }
const device = { port: null, transport: {} as Transport };
const primary = new Error('device command failed');
const input = { day: 300, hour: 3, minute: 4, second: 5 };
const gbaInput = { year: 24, month: 1, date: 2, ...input, day: 2 };

function mbc3Model(failAt = -1, high = 0x81) {
  const commands: Command[] = [];
  const registers = [5, 4, 3, 2, high];
  let bank = 0;
  let enabled = false;
  let latched = false;
  const step = (command: Command) => {
    commands.push(command);
    if (commands.length === failAt) throw primary;
  };
  vi.mocked(gbc_write).mockImplementation(async (_transport, data, address) => {
    await Promise.resolve();
    if (address === 0x0000) enabled = data[0] === 0x0a;
    if (address === 0x4000) bank = data[0];
    if (address === 0x6000) latched = data[0] === 1;
    if (address === 0xa000 && enabled) registers[bank - 8] = data[0];
    step({ kind: 'write', address, value: data[0] });
  });
  vi.mocked(gbc_read).mockImplementation(async (_transport, _length, address) => {
    await Promise.resolve();
    step({ kind: 'read', address });
    if (!enabled) throw new Error('RTC read with RAM disabled');
    return new Uint8Array([registers[bank - 8] ?? 0]);
  });
  const rtc = new MBC3RTC(device);
  vi.spyOn(rtc as unknown as DelayRTC, 'delay').mockResolvedValue();
  return { rtc, commands, registers, idle: () => !enabled && bank === 0 && !latched };
}

function gbaModel(failAt = -1, status = 0, verification = true) {
  const commands: Command[] = [];
  let capabilityRead = 0;
  let bit = 0;
  const bytes = [status, ...(verification ? [0x40] : []), 0x24, 1, 2, 2, 3, 4, 5];
  const step = (command: Command) => {
    commands.push(command);
    if (commands.length === failAt) throw primary;
  };
  vi.mocked(rom_write).mockImplementation(async (_transport, data, address) => {
    await Promise.resolve();
    step({ kind: 'write', address, value: data[0] });
  });
  vi.mocked(rom_read).mockImplementation(async (_transport, length, address) => {
    await Promise.resolve();
    step({ kind: 'read', address });
    if (length === 6) return new Uint8Array(6).fill(capabilityRead++ % 2);
    const value = bytes[Math.floor(bit / 8) % bytes.length];
    return new Uint8Array([((value >> (bit++ % 8)) & 1) << 1, 0]);
  });
  const rtc = new GBARTC(device);
  vi.spyOn(rtc as unknown as DelayRTC, 'delay').mockResolvedValue();
  return { rtc, commands };
}

const mbc3Idle = [
  { kind: 'write', address: 0x6000, value: 0 },
  { kind: 'write', address: 0x4000, value: 0 },
  { kind: 'write', address: 0x0000, value: 0 },
];
const gbaIdle = [
  { kind: 'write', address: 0xc4 >> 1, value: 1 },
  { kind: 'write', address: 0xc8 >> 1, value: 0 },
];

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('MBC3 RTC failure recovery', () => {
  it('keeps RAM enabled through readback, resumes new time, and leaves RAM ready', async () => {
    const model = mbc3Model();
    await model.rtc.setTime(input);
    expect(model.registers).toEqual([5, 4, 3, 44, 1]);
    expect(model.idle()).toBe(true);
    expect(model.commands.slice(-3)).toEqual(mbc3Idle);
    await model.rtc.readTime();
    expect(model.idle()).toBe(true);
  });

  it.each([0x81, 0xc1])('restores original high/control 0x%s after every failed command', async high => {
    const baseline = mbc3Model(-1, high);
    await baseline.rtc.setTime(input);
    const count = baseline.commands.length - 3;
    for (let index = 1; index <= count; index++) {
      const model = mbc3Model(index, high);
      const result = expect(model.rtc.setTime(input), `command ${index}`).rejects;
      // The snapshot's final unlatch is now an independent cleanup step.
      if (index === count) await result.toMatchObject({ errors: [primary] });
      else await result.toBe(primary);
      expect(model.registers[4], `high register after command ${index}`).toBe(high);
      expect(model.commands.slice(-3)).toEqual(mbc3Idle);
      expect(model.idle()).toBe(true);
    }
  });

  it.each(['readTime', 'checkCapability'] as const)('cleans every failed %s command', async operation => {
    const baseline = mbc3Model();
    await baseline.rtc[operation]();
    const count = baseline.commands.length - 3;
    for (let index = 1; index <= count; index++) {
      const model = mbc3Model(index);
      const result = await model.rtc[operation]();
      expect(operation === 'readTime' ? (result as { status: boolean }).status : result).toBe(false);
      expect(model.commands.slice(-3)).toEqual(mbc3Idle);
      expect(model.idle()).toBe(true);
    }
  });

  it('attempts all cleanup steps and logs primary plus each cleanup cause', async () => {
    const model = mbc3Model();
    const cleanupErrors = [new Error('unlatch'), new Error('bank'), new Error('disable')];
    vi.mocked(gbc_read).mockRejectedValue(primary);
    const write = vi.mocked(gbc_write).getMockImplementation();
    vi.mocked(gbc_write).mockImplementation(async (...args) => {
      await write?.(...args);
      const [, data, address] = args;
      const index = mbc3Idle.findIndex(step => step.address === address && step.value === data[0]);
      if (index >= 0) throw cleanupErrors[index];
    });
    await expect(model.rtc.setTime(input)).rejects.toBe(primary);
    expect(model.commands.slice(-3)).toEqual(mbc3Idle);
    expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cause: primary, cleanupErrors }));
  });

  it.each([0, 1, 2])('reports cleanup-only failure in idle step %s and attempts later steps', async step => {
    const baseline = mbc3Model();
    await baseline.rtc.setTime(input);
    const model = mbc3Model(baseline.commands.length - 2 + step);
    await expect(model.rtc.setTime(input)).rejects.toMatchObject({ errors: [primary] });
    expect(model.commands.slice(-3)).toEqual(mbc3Idle);
    expect(model.registers[4]).toBe(1);
  });

  it.each([false, true])('attempts mapping cleanup even if control restoration fails (selection=%s)', async selection => {
    const model = mbc3Model();
    const cleanupError = new Error('control restoration');
    const write = vi.mocked(gbc_write).getMockImplementation();
    let restoring = false;
    vi.mocked(gbc_write).mockImplementation(async (...args) => {
      const [, data, address] = args;
      if (!restoring && address === 0xa000 && data[0] === 0xc1) {
        await write?.(...args);
        restoring = true;
        throw primary;
      }
      if (restoring && (selection ? address === 0x4000 && data[0] === 0x0c : address === 0xa000)) {
        model.commands.push({ kind: 'write', address, value: data[0] });
        throw cleanupError;
      }
      await write?.(...args);
    });
    await expect(model.rtc.setTime(input)).rejects.toBe(primary);
    expect(model.commands.slice(-3)).toEqual(mbc3Idle);
    expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cause: primary, cleanupErrors: [cleanupError] }));
  });
});

describe('GBA RTC failure recovery', () => {
  it.each([
    { operation: 'setTime', status: 0 },
    { operation: 'setTime', status: 0x80 },
    { operation: 'readTime', status: 0 },
    { operation: 'readTime', status: 0x80 },
    { operation: 'checkCapability', status: 0 },
  ] as const)('cleans every failed $operation device command with status $status', async ({ operation, status }) => {
    const baseline = gbaModel(-1, status, operation === 'setTime');
    await (operation === 'setTime' ? baseline.rtc.setTime(gbaInput) : baseline.rtc[operation]());
    const count = baseline.commands.length - 2;
    const verificationReleases = baseline.commands.flatMap((command, index) =>
      command.kind === 'write' && command.address === 0xc4 >> 1 && command.value === 1 ? [index + 1] : [],
    ).slice(-3, -1);
    for (let index = 1; index <= count; index++) {
      const model = gbaModel(index, status, operation === 'setTime');
      if (operation === 'setTime') {
        // Capability probes keep their existing boolean contract.
        if (verificationReleases.includes(index)) await expect(model.rtc.setTime(gbaInput)).rejects.toMatchObject({ errors: [primary] });
        else if (index > 5) await expect(model.rtc.setTime(gbaInput)).rejects.toBe(primary);
        else await expect(model.rtc.setTime(gbaInput)).rejects.toThrow();
      } else {
        const result = await model.rtc[operation]();
        expect(operation === 'readTime' ? (result as { status: boolean }).status : result).toBe(false);
      }
      expect(model.commands.slice(-2), `command ${index}`).toEqual(gbaIdle);
    }
  }, 60000);

  it.each(['setTime', 'readTime', 'checkCapability'] as const)('finishes successful %s in GPIO idle state', async operation => {
    const model = gbaModel(-1, 0, operation === 'setTime');
    const result = await (operation === 'setTime' ? model.rtc.setTime(gbaInput) : model.rtc[operation]());
    if (operation === 'readTime') expect(result).toMatchObject({ status: true });
    if (operation === 'checkCapability') expect(result).toBe(true);
    expect(model.commands.slice(-2)).toEqual(gbaIdle);
  });

  it.each([0, 1])('reports final GPIO cleanup failure %s once and attempts later steps', async step => {
    const baseline = gbaModel();
    await baseline.rtc.setTime(gbaInput);
    const model = gbaModel(baseline.commands.length - 1 + step);
    await expect(model.rtc.setTime(gbaInput)).rejects.toMatchObject({ errors: [primary] });
    expect(model.commands.slice(-2)).toEqual(gbaIdle);
  });

  it('does not repeat cleanup after a cleanup-only failure and still disables GPIO', async () => {
    const model = gbaModel();
    const cleanupError = new Error('chip select release');
    vi.mocked(rom_write).mockImplementation(async (_transport, data, address) => {
      await Promise.resolve();
      model.commands.push({ kind: 'write', address, value: data[0] });
      if (address === 0xc4 >> 1) throw cleanupError;
    });
    expect(await model.rtc.checkCapability()).toBe(false);
    expect(model.commands.slice(-2)).toEqual(gbaIdle);
    expect(model.commands.filter(command => command.address === 0xc4 >> 1 && command.kind === 'write')).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cleanupErrors: [cleanupError] }));
  });

  it('preserves primary set failure while both GPIO cleanup commands fail', async () => {
    const model = gbaModel();
    vi.spyOn(model.rtc, 'checkCapability').mockResolvedValue(true);
    const cleanupErrors = [new Error('release'), new Error('disable')];
    let first = true;
    vi.mocked(rom_write).mockImplementation(async (_transport, data, address) => {
      await Promise.resolve();
      model.commands.push({ kind: 'write', address, value: data[0] });
      if (first) { first = false; throw primary; }
      throw cleanupErrors[address === 0xc4 >> 1 ? 0 : 1];
    });
    await expect(model.rtc.setTime(gbaInput)).rejects.toBe(primary);
    expect(model.commands.slice(-2)).toEqual(gbaIdle);
    expect(console.error).toHaveBeenCalledWith('RTC cleanup failed', expect.objectContaining({ cause: primary, cleanupErrors }));
  });
});
