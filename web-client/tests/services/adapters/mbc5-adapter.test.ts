import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions, MbcType } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const { mockCartPower, mockGbcRead, mockGbcRomProgram, mockGbcRomEraseSector } = vi.hoisted(() => ({
  mockCartPower: vi.fn(),
  mockGbcRead: vi.fn(),
  mockGbcRomProgram: vi.fn(),
  mockGbcRomEraseSector: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    cart_power: mockCartPower,
    gbc_read: mockGbcRead,
    gbc_rom_program: mockGbcRomProgram,
    gbc_rom_erase_sector: mockGbcRomEraseSector,
  };
});

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

function createCfiInfo(): CFIInfo {
  return {
    flashId: new Uint8Array([0x01, 0x02]),
    magic: 'QRY',
    dataSwap: null,
    cfiDetected: true,
    isSwapD0D1: false,
    isIntel: false,
    vddMin: 3,
    vddMax: 5,
    singleWrite: true,
    bufferWrite: true,
    sectorErase: true,
    chipErase: true,
    tbBootSector: false,
    tbBootSectorRaw: 0,
    deviceSize: 0x8000,
    eraseSectorRegions: 1,
    eraseSectorBlocks: [{
      sectorSize: 0x4000,
      sectorCount: 2,
      totalSize: 0x8000,
      startAddress: 0,
      endAddress: 0x7fff,
    }],
    reverseSectorRegion: false,
    info: 'test-cfi',
  };
}

function createOptions(
  mbcType: MbcType,
  overrides: Partial<CommandOptions> = {},
): CommandOptions {
  return {
    mbcType,
    baseAddress: 0x4000,
    romPageSize: 1,
    cfiInfo: createCfiInfo(),
    size: 1,
    ...overrides,
  };
}

function createMockDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    port: null,
    connection: null,
    transport: {
      send: vi.fn(),
      read: vi.fn(),
      sendAndReceive: vi.fn(),
      setSignals: vi.fn(),
      flushInput: vi.fn(),
    },
    ...overrides,
  };
}

describe('MBC5Adapter.verifyROM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGbcRead.mockReset();
    mockCartPower.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
  });

  it.each([
    'MBC3',
    'MBC1',
  ] as const)('passes resolved %s type into bank switching during verify', async (mbcType) => {
    const adapter = new MBC5Adapter(createMockDevice());
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const result = await adapter.verifyROM(new Uint8Array([0xab]), createOptions(mbcType));

    expect(result.success).toBe(true);
    expect(switchSpy).toHaveBeenCalledWith(1, mbcType);
  });

  it('rejects enable5V when firmware profile does not support cartPowerControl', async () => {
    const adapter = new MBC5Adapter(createMockDevice({ firmwareProfile: STM_FIRMWARE_PROFILE }));
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    const result = await adapter.verifyROM(new Uint8Array([0xab]), createOptions('MBC5', { enable5V: true }));

    expect(result.success).toBe(false);
    expect(mockCartPower).not.toHaveBeenCalled();
    expect(switchSpy).not.toHaveBeenCalled();
    expect(mockGbcRead).not.toHaveBeenCalled();
  });

  it('enables 5V before verify and restores 3.3V on success, mismatch, error, and cancellation', async () => {
    // 1. Success
    const device = createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE });
    const adapter = new MBC5Adapter(device);
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockCartPower.mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const okRes = await adapter.verifyROM(new Uint8Array([0xab]), createOptions('MBC5', { enable5V: true }));
    expect(okRes.success).toBe(true);
    expect(mockCartPower.mock.calls.map((c) => c[1])).toEqual([0, 2, 1]);

    // 2. Mismatch failure
    mockCartPower.mockClear();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xcd]));
    const mismatchRes = await adapter.verifyROM(new Uint8Array([0xab]), createOptions('MBC5', { enable5V: true }));
    expect(mismatchRes.success).toBe(false);
    expect(mockCartPower.mock.calls.map((c) => c[1])).toEqual([0, 2, 1]);

    // 3. Read error (with retries = 0)
    mockCartPower.mockClear();
    AdvancedSettings.romReadRetryCount = 0;
    mockGbcRead.mockRejectedValue(new Error('read timeout'));
    const errRes = await adapter.verifyROM(new Uint8Array([0xab]), createOptions('MBC5', { enable5V: true }));
    expect(errRes.success).toBe(false);
    expect(mockCartPower.mock.calls.map((c) => c[1])).toEqual([0, 2, 1]);

    // 4. Cancellation during loop
    mockCartPower.mockClear();
    const controller = new AbortController();
    mockGbcRead.mockImplementation(async () => {
      controller.abort();
      return new Uint8Array([0xab]);
    });
    const cancelRes = await adapter.verifyROM(
      new Uint8Array([0xab, 0xcd]),
      createOptions('MBC5', { enable5V: true, size: 2, romPageSize: 1 }),
      controller.signal,
    );
    expect(cancelRes.success).toBe(false);
    expect(mockCartPower.mock.calls.map((c) => c[1])).toEqual([0, 2, 1]);
  });

  it('stabilizes command channel, restores bank, and retries failed verify chunk reads', async () => {
    const device = createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE });
    const adapter = new MBC5Adapter(device);
    const stabilizeSpy = vi.spyOn(adapter as unknown as { stabilizeCommandChannel: (ms?: number) => Promise<void> }, 'stabilizeCommandChannel');
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    AdvancedSettings.romReadRetryCount = 2;
    AdvancedSettings.romReadRetryDelayMs = 0;

    let attempts = 0;
    mockGbcRead.mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('transient read error');
      }
      return new Uint8Array([0xab]);
    });

    const result = await adapter.verifyROM(new Uint8Array([0xab]), createOptions('MBC5'));

    expect(result.success).toBe(true);
    expect(mockGbcRead).toHaveBeenCalledTimes(2);
    // Once at start of verifyROM, once on retry
    expect(stabilizeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Initial bank switch + bank restore after transient error
    expect(switchSpy).toHaveBeenCalledTimes(2);
    expect(switchSpy).toHaveBeenNthCalledWith(1, 1, 'MBC5');
    expect(switchSpy).toHaveBeenNthCalledWith(2, 1, 'MBC5');
  });
});

describe('MBC5Adapter.writeROM recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGbcRead.mockReset();
    mockCartPower.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romEraseRetryCount = 1;
    AdvancedSettings.romWriteRetryCount = 1;
  });

  it('erases the sector before writing', async () => {
    const logs: string[] = [];
    const adapter = new MBC5Adapter(
      createMockDevice(),
      (message) => {
        if (typeof message === 'string') {
          logs.push(message);
          return;
        }
        logs.push(message.message);
        if (message.details) {
          logs.push(message.details);
        }
      },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(1);
    expect(logs).toContain('messages.operation.eraseSector');
  });

  it('fully erases the target range before starting to program', async () => {
    const logs: string[] = [];
    const adapter = new MBC5Adapter(
      createMockDevice(),
      (message) => { logs.push(typeof message === 'string' ? message : message.message); },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(1);
    expect(mockGbcRomEraseSector.mock.invocationCallOrder[0]).toBeLessThan(mockGbcRomProgram.mock.invocationCallOrder[0]);
  });

  it('retries the current sector from its start after a program failure', async () => {
    const adapter = new MBC5Adapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff]));
    mockGbcRomProgram
      .mockRejectedValueOnce(new Error('program timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(true);
    // 写前擦除 1 次 + 恢复重试时再擦除 1 次
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(2);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(2);
  });

  it('rolls back to the sector start after a dirty partial write', async () => {
    const adapter = new MBC5Adapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff]));
    mockGbcRomProgram
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('chunk timeout'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const fileData = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const result = await adapter.writeROM(
      fileData,
      createOptions('MBC5', { romPageSize: 2, size: 4 }),
    );

    expect(result.success).toBe(true);
    // 写前擦除 1 次 + 恢复重试时再擦除 1 次
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(2);
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(4);
    expect(mockGbcRomProgram.mock.calls.map(([_, chunk]) => Array.from(chunk as Uint8Array))).toEqual([
      [0x11, 0x22],
      [0x33, 0x44],
      [0x11, 0x22],
      [0x33, 0x44],
    ]);
  });

  it('fails deterministically when erase retries are exhausted', async () => {
    const adapter = new MBC5Adapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    AdvancedSettings.romEraseRetryCount = 1;
    mockGbcRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockGbcRomEraseSector.mockRejectedValue(new Error('erase timeout'));

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions('MBC5'),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('retry exhausted');
    expect(result.message).toContain('erase timeout');
    expect(mockGbcRomEraseSector).toHaveBeenCalledTimes(2);
  });
});

describe('MBC5Adapter firmware capability gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCartPower.mockReset();
    mockGbcRead.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    mockGbcRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
  });

  it('rejects 5V power control on STM firmware before cart_power', async () => {
    const adapter = new MBC5Adapter(createMockDevice({
      firmwareProfile: STM_FIRMWARE_PROFILE,
    }));

    const result = await adapter.readROM(1, createOptions('MBC5', { enable5V: true }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('MBC 5V power control');
    expect(result.message).toContain('丐中丐 firmware');
    expect(mockCartPower).not.toHaveBeenCalled();
  });

  it('allows 5V power control on carbon firmware', async () => {
    const adapter = new MBC5Adapter({
      port: null,
      connection: null,
      transport: {
        send: vi.fn(),
        read: vi.fn(),
        sendAndReceive: vi.fn(),
        setSignals: vi.fn(),
        flushInput: vi.fn(),
      },
      firmwareProfile: STC_FIRMWARE_PROFILE,
    });
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockCartPower.mockResolvedValue(true);
    mockGbcRead.mockResolvedValue(new Uint8Array([0xab]));

    const result = await adapter.readROM(1, createOptions('MBC5', { enable5V: true }));

    expect(result.success).toBe(true);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 0);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mockCartPower).toHaveBeenCalledWith(expect.anything(), 1);
  });
});

describe('MBC5Adapter transfer planning, efficiency, and stateful recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCartPower.mockReset();
    mockGbcRead.mockReset();
    mockGbcRomProgram.mockReset();
    mockGbcRomEraseSector.mockReset();
    AdvancedSettings.resetToDefaults();
  });

  it('caps MBC read/verify requests at 16KiB bank window even when STC maxReadChunk is 32KiB', async () => {
    AdvancedSettings.romReadPageSize = 32768;
    const adapter = new MBC5Adapter(createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE }));
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRead.mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x22)));

    const res = await adapter.readROM(0x8000, createOptions('MBC5', { romPageSize: undefined }));
    expect(res.success).toBe(true);
    expect(mockGbcRead).toHaveBeenCalledTimes(2);
    expect(mockGbcRead.mock.calls.map(([, s]) => s as number)).toEqual([0x4000, 0x4000]);
  });

  it('skips all-0xFF chunks and recovers from partial-write timeout / lost ACK with non-zero baseAddress', async () => {
    const sectorSize = 0x10000;
    const storage = new Uint8Array(sectorSize).fill(0x00);
    const adapter = new MBC5Adapter(createMockDevice());
    let currentBank = 0;
    vi.spyOn(adapter, 'switchROMBank').mockImplementation((bank: number) => {
      currentBank = bank;
      return Promise.resolve();
    });

    mockGbcRomEraseSector.mockImplementation((_t, addr: number) => {
      const globalAddr = currentBank * 0x4000 + (addr & 0x3fff);
      const start = Math.floor(globalAddr / sectorSize) * sectorSize;
      storage.fill(0xff, start, start + sectorSize);
      return Promise.resolve();
    });

    let callNum = 0;
    mockGbcRomProgram.mockImplementation((_t, chunk: Uint8Array, addr: number) => {
      callNum++;
      const globalOffset = currentBank * 0x4000 + (addr & 0x3fff);
      if (callNum === 1) {
        storage.set(chunk.subarray(0, 8), globalOffset);
        return Promise.reject(new Error('partial write timeout'));
      }
      if (callNum === 2) {
        storage.set(chunk, globalOffset);
        return Promise.reject(new Error('ack lost'));
      }
      storage.set(chunk, globalOffset);
      return Promise.resolve();
    });
    mockGbcRead.mockImplementation((_t, size: number, addr: number) => {
      const globalOffset = currentBank * 0x4000 + (addr & 0x3fff);
      return Promise.resolve(storage.slice(globalOffset, globalOffset + size));
    });

    AdvancedSettings.romWriteRetryCount = 2;
    const baseAddress = 0x2000;
    const total = 0x4000; // [0x2000, 0x6000) 跨越 0x4000 bank 边界；前 0x2000 有数据，后 0x2000 全 0xFF
    const input = new Uint8Array(0x2000).map((_, i) => (i + 1) & 0xff);
    const cfi = createCfiInfo();
    cfi.deviceSize = sectorSize;
    cfi.eraseSectorBlocks = [{
      sectorSize,
      sectorCount: 1,
      totalSize: sectorSize,
      startAddress: 0,
      endAddress: sectorSize - 1,
    }];

    const writeRes = await adapter.writeROM(input, createOptions('MBC5', {
      baseAddress,
      size: total,
      romPageSize: 4096,
      cfiInfo: cfi,
    }));

    expect(writeRes.success).toBe(true);
    // 重试前 2 次都在第一块 (0x2000..0x3000) 失败，第三次成功写 0x2000..0x3000 与 0x3000..0x4000，跳过 0x4000..0x6000 全 0xFF
    expect(mockGbcRomProgram).toHaveBeenCalledTimes(4);
    expect(storage.subarray(baseAddress, baseAddress + input.byteLength)).toEqual(input);
    expect(storage.subarray(baseAddress + input.byteLength, baseAddress + total)).toEqual(new Uint8Array(0x2000).fill(0xff));
  });

  it.each([512, 1024])('honors AdvancedSettings.romPageSize = %d B during writeROM when options.romPageSize is omitted', async (configuredPageSize) => {
    AdvancedSettings.romPageSize = configuredPageSize;
    const adapter = new MBC5Adapter(createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE }));
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const input = new Uint8Array(2048).fill(0x5a);
    const res = await adapter.writeROM(input, createOptions('MBC5', {
      baseAddress: 0x0000,
      size: 2048,
      romPageSize: undefined,
    }));

    expect(res.success).toBe(true);
    const chunkSizes = mockGbcRomProgram.mock.calls.map(([, chunk]) => (chunk as Uint8Array).byteLength);
    expect(chunkSizes).toEqual(Array(2048 / configuredPageSize).fill(configuredPageSize));
  });

  it('caps real-device writeROM chunks at <= 4096 B even when STC romReadPageSize is 32 KiB and options.romPageSize is omitted', async () => {
    AdvancedSettings.romReadPageSize = 0x8000;
    AdvancedSettings.romPageSize = 4096;
    const adapter = new MBC5Adapter(createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE }));
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const input = new Uint8Array(0x4000).fill(0x3c);
    const res = await adapter.writeROM(input, createOptions('MBC5', {
      baseAddress: 0x0000,
      size: 0x4000,
      romPageSize: undefined,
    }));

    expect(res.success).toBe(true);
    const chunkSizes = mockGbcRomProgram.mock.calls.map(([, chunk]) => (chunk as Uint8Array).byteLength);
    expect(chunkSizes.every((len) => len <= 4096)).toBe(true);
    expect(chunkSizes).toEqual([4096, 4096, 4096, 4096]);
  });

  it('preserves independent simulated-device magnification branch in writeROM', async () => {
    AdvancedSettings.romPageSize = 512;
    const device = createMockDevice({
      firmwareProfile: STC_FIRMWARE_PROFILE,
    });
    device.serialHandle = {
      platform: 'simulated',
      transport: device.transport,
    } as unknown as DeviceInfo['serialHandle'];
    const adapter = new MBC5Adapter(device);
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockGbcRomEraseSector.mockResolvedValue(undefined);
    mockGbcRomProgram.mockResolvedValue(undefined);

    const input = new Uint8Array(0x4000).fill(0x7e);
    const res = await adapter.writeROM(input, createOptions('MBC5', {
      baseAddress: 0x0000,
      size: 0x4000,
      romPageSize: undefined,
    }));

    expect(res.success).toBe(true);
    const chunkSizes = mockGbcRomProgram.mock.calls.map(([, chunk]) => (chunk as Uint8Array).byteLength);
    expect(chunkSizes).toEqual([0x4000]);
  });
});
