import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { GBAAdapter } from '@/services/gba-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const { mockRomRead, mockRomProgram, mockRomEraseSector } = vi.hoisted(() => ({
  mockRomRead: vi.fn(),
  mockRomProgram: vi.fn(),
  mockRomEraseSector: vi.fn(),
}));

vi.mock('@/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/protocol')>('@/protocol');
  return {
    ...actual,
    rom_read: mockRomRead,
    rom_program: mockRomProgram,
    rom_erase_sector: mockRomEraseSector,
  };
});

vi.mock('@/utils/monitoring/sentry-tracker', () => ({
  PerformanceTracker: {
    trackAsyncOperation: vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation()),
  },
}));

function createCfiInfo(deviceSize = 0x8000): CFIInfo {
  const sectorSize = 0x4000;
  const sectorCount = Math.max(1, Math.ceil(deviceSize / sectorSize));
  const totalSize = sectorCount * sectorSize;
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
    deviceSize,
    eraseSectorRegions: 1,
    eraseSectorBlocks: [{
      sectorSize,
      sectorCount,
      totalSize,
      startAddress: 0,
      endAddress: totalSize - 1,
    }],
    reverseSectorRegion: false,
    info: 'test-cfi',
  };
}

function createOptions(overrides: Partial<CommandOptions> = {}): CommandOptions {
  const cfiInfo = overrides.cfiInfo ?? createCfiInfo();
  return {
    baseAddress: 0,
    romPageSize: 1,
    cfiInfo,
    size: 1,
    ...overrides,
  };
}

function createMockDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    port: null,
    connection: null,
    // Direct adapter use: capabilities come from the profile unless a committed session exists.
    firmwareProfile: STM_FIRMWARE_PROFILE,
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

describe('GBAAdapter.writeROM recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRomRead.mockReset();
    mockRomProgram.mockReset();
    mockRomEraseSector.mockReset();
    mockRomRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romEraseRetryCount = 1;
  });

  it('erases the sector before writing', async () => {
    const logs: string[] = [];
    const adapter = new GBAAdapter(
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

    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
    expect(logs).toContain('messages.operation.eraseSector');
  });

  it('fully erases the target range before starting to program', async () => {
    const logs: string[] = [];
    const adapter = new GBAAdapter(
      createMockDevice(),
      (message) => { logs.push(typeof message === 'string' ? message : message.message); },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
    expect(mockRomEraseSector.mock.invocationCallOrder[0]).toBeLessThan(mockRomProgram.mock.invocationCallOrder[0]);
  });

  it('switches ROM bank once when erasing multiple sectors in the same bank', async () => {
    const adapter = new GBAAdapter(createMockDevice());
    const switchSpy = vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockResolvedValue(undefined);

    const multiBankCfi = createCfiInfo(1 << 26);
    multiBankCfi.eraseSectorBlocks = [{
      sectorSize: 0x20000,
      sectorCount: 4,
      totalSize: 0x80000,
      startAddress: 0x01f00000,
      endAddress: 0x01f7ffff,
    }];

    const result = await adapter.eraseSectors(multiBankCfi.eraseSectorBlocks, createOptions({
      cfiInfo: multiBankCfi,
    }));

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(4);
    expect(switchSpy).toHaveBeenCalledTimes(1);
    expect(switchSpy).toHaveBeenCalledWith(0);
  });

  it('retries the write command directly without re-erasing on a transient program failure', async () => {
    const adapter = new GBAAdapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff]));
    mockRomProgram
      .mockRejectedValueOnce(new Error('program timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await adapter.writeROM(
      new Uint8Array([0xaa]),
      createOptions({
        baseAddress: 1 << 25,
        cfiInfo: createCfiInfo(1 << 26),
      }),
    );

    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(2);
  });

  it('fails deterministically when erase retries are exhausted', async () => {
    const adapter = new GBAAdapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);

    mockRomRead.mockResolvedValueOnce(new Uint8Array([0x00, 0xff, 0xff, 0xff]));
    mockRomEraseSector.mockRejectedValue(new Error('erase timeout'));

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    expect(result.success).toBe(false);
    expect(result.message).toContain('retry exhausted');
    expect(result.message).toContain('erase timeout');
    expect(mockRomEraseSector).toHaveBeenCalledTimes(2);
  });
});

describe('GBAAdapter firmware capability gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRomRead.mockReset();
    mockRomProgram.mockReset();
    mockRomEraseSector.mockReset();
    AdvancedSettings.resetToDefaults();
  });

  it('performs sector erase on carbon firmware via passthrough commands', async () => {
    const adapter = new GBAAdapter(createMockDevice({
      firmwareProfile: STC_FIRMWARE_PROFILE,
    }));
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockResolvedValue(undefined);

    const result = await adapter.eraseSectors(createCfiInfo().eraseSectorBlocks, createOptions());

    // rom_erase_sector 通过 rom_write/rom_read 透传实现，碳酸丐固件同样支持
    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalled();
  });

  it('rejects GBA FRAM RAM operations on carbon firmware', async () => {
    const adapter = new GBAAdapter(createMockDevice({
      firmwareProfile: STC_FIRMWARE_PROFILE,
    }));

    const result = await adapter.writeRAM(new Uint8Array([0xaa]), createOptions({ ramType: 'FRAM' }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('GBA FRAM RAM write');
    expect(result.message).toContain('碳酸丐 firmware');
  });

  it('erases before programming on STC firmware instead of relying on blank sampling', async () => {
    const adapter = new GBAAdapter(createMockDevice({
      firmwareProfile: STC_FIRMWARE_PROFILE,
    }));
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomProgram.mockResolvedValue(undefined);

    const result = await adapter.writeROM(new Uint8Array([0xaa]), createOptions());

    // 抽样跳过误判会导致在未擦除数据上编程，固件 DQ7 轮询死循环；
    // 碳酸丐支持透传扇区擦除后，写前与丐中丐一样无条件擦除。
    expect(result.success).toBe(true);
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(1);
  });
});

describe('GBAAdapter transfer planning, efficiency, and stateful recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRomRead.mockReset();
    mockRomProgram.mockReset();
    mockRomEraseSector.mockReset();
    AdvancedSettings.resetToDefaults();
  });

  it('pads short input in writeROM and verifyROM so padding differences fail verify', async () => {
    const storage = new Uint8Array(0x4000).fill(0xff);
    const verifyLogs: unknown[] = [];
    const adapter = new GBAAdapter(
      createMockDevice(),
      null,
      null,
      (key, params) => {
        if (key === 'messages.rom.verifyFailedAt' && params) {
          verifyLogs.push(params);
        }
        return key;
      },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockImplementation((_t, addr: number) => {
      const start = Math.floor(addr / 0x4000) * 0x4000;
      storage.fill(0xff, start, start + 0x4000);
      return Promise.resolve();
    });
    mockRomProgram.mockImplementation((_t, chunk: Uint8Array, addr: number) => {
      storage.set(chunk, addr);
      return Promise.resolve();
    });
    mockRomRead.mockImplementation((_t, size: number, addr: number) => Promise.resolve(storage.slice(addr, addr + size)));

    const shortInput = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const writeRes = await adapter.writeROM(shortInput, createOptions({ size: 8, romPageSize: 8 }));
    expect(writeRes.success).toBe(true);
    expect(Array.from(storage.subarray(0, 8))).toEqual([0x12, 0x34, 0x56, 0x78, 0xff, 0xff, 0xff, 0xff]);

    // 破坏补齐区的 1 个字节，verifyROM 应发现差异
    storage[6] = 0x00;
    const verifyRes = await adapter.verifyROM(shortInput, createOptions({ size: 8, romPageSize: 8 }));
    expect(verifyRes.success).toBe(false);
    expect(verifyLogs).toHaveLength(1);
    expect((verifyLogs[0] as { address: string }).address).toBe('0x00000006');
  });

  it('normalizes pageSize=1000 down to 512 and aligns F4 payload starts to bufferSize', async () => {
    const adapter = new GBAAdapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff]));
    mockRomProgram.mockResolvedValue(undefined);

    const cfi = createCfiInfo(0x8000);
    cfi.bufferSize = 512;
    const data = new Uint8Array(2048).fill(0x5a);

    const result = await adapter.writeROM(data, createOptions({
      baseAddress: 0x100,
      size: 2048,
      romPageSize: 1000,
      cfiInfo: cfi,
    }));

    expect(result.success).toBe(true);
    const lengths = mockRomProgram.mock.calls.map(([, chunk]) => (chunk as Uint8Array).byteLength);
    const addresses = mockRomProgram.mock.calls.map(([, , addr]) => addr as number);
    expect(lengths).toEqual([256, 512, 512, 512, 256]);
    for (let i = 1; i < addresses.length; i++) {
      expect(addresses[i] % 512).toBe(0);
    }
  });

  it('skips all-0xFF chunks during writeROM and still verifies them', async () => {
    const storage = new Uint8Array(0x200000).fill(0x00);
    const summaries: Record<string, unknown>[] = [];
    const adapter = new GBAAdapter(
      createMockDevice(),
      null,
      null,
      (key, params) => {
        if (key === 'messages.rom.writeSummary' && params) {
          summaries.push(params as Record<string, unknown>);
        }
        return key;
      },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockImplementation((_t, addr: number) => {
      const start = Math.floor(addr / 0x4000) * 0x4000;
      storage.fill(0xff, start, start + 0x4000);
      return Promise.resolve();
    });
    mockRomProgram.mockImplementation((_t, chunk: Uint8Array, addr: number) => {
      storage.set(chunk, addr);
      return Promise.resolve();
    });
    mockRomRead.mockImplementation((_t, size: number, addr: number) => Promise.resolve(storage.slice(addr, addr + size)));

    // 1MiB 有效数据 + 1MiB 全 0xFF 补齐（共 2MiB）
    const total = 0x200000;
    const cfi = createCfiInfo(total);
    const rom = new Uint8Array(total).fill(0xff);
    rom.fill(0xab, 0, 0x100000);

    const writeRes = await adapter.writeROM(rom, createOptions({ size: total, romPageSize: 4096, cfiInfo: cfi }));
    expect(writeRes.success).toBe(true);
    // 只有前 1MiB（256 个 4KiB 块）发出 program 请求，后 1MiB 跳过
    expect(mockRomProgram).toHaveBeenCalledTimes(256);

    const verifyRes = await adapter.verifyROM(rom, createOptions({ size: total, romPageSize: 4096, cfiInfo: cfi }));
    expect(verifyRes.success).toBe(true);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].programRequests).toBe(256);
    expect(summaries[0].skippedBytes).toBe('1.0 MiB');
  });

  it('caps read chunk size by FirmwareProfile.maxReadChunk (4KiB on stm, 32KiB on stc)', async () => {
    // The STM ceiling keeps this at 8 KiB; the STC namespace accepts the full 32 KiB page.
    AdvancedSettings.romReadPageSize = 32768;
    AdvancedSettings.setNamespaceSize('beggar.stc', 'romReadPageSize', 32768);

    const stmAdapter = new GBAAdapter(createMockDevice({ firmwareProfile: STM_FIRMWARE_PROFILE }));
    mockRomRead.mockImplementation((_t, size: number) => Promise.resolve(new Uint8Array(size).fill(0x11)));
    await stmAdapter.readROM(65536, createOptions({ romPageSize: undefined, cfiInfo: createCfiInfo(65536) }));
    expect(Math.max(...mockRomRead.mock.calls.map(([, s]) => s as number))).toBe(4096);

    mockRomRead.mockClear();
    const stcAdapter = new GBAAdapter(createMockDevice({ firmwareProfile: STC_FIRMWARE_PROFILE }));
    await stcAdapter.readROM(65536, createOptions({ romPageSize: undefined, cfiInfo: createCfiInfo(65536) }));
    expect(Math.max(...mockRomRead.mock.calls.map(([, s]) => s as number))).toBe(32768);
    expect(mockRomRead).toHaveBeenCalledTimes(2);
  });

  it('writes across sectors and logs writeSummary with retryCount 0', async () => {
    const sectorSize = 0x4000;
    const storage = new Uint8Array(sectorSize * 2).fill(0x00);
    const summaryCalls: Record<string, unknown>[] = [];
    const adapter = new GBAAdapter(
      createMockDevice(),
      null,
      null,
      (key, params) => {
        if (key === 'messages.rom.writeSummary' && params) {
          summaryCalls.push(params as Record<string, unknown>);
        }
        return key;
      },
    );
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockImplementation((_t, addr: number) => {
      const start = Math.floor(addr / sectorSize) * sectorSize;
      storage.fill(0xff, start, start + sectorSize);
      return Promise.resolve();
    });
    mockRomProgram.mockImplementation((_t, chunk: Uint8Array, addr: number) => {
      storage.set(chunk, addr);
      return Promise.resolve();
    });
    mockRomRead.mockImplementation((_t, size: number, addr: number) => Promise.resolve(storage.slice(addr, addr + size)));

    const baseAddress = 0x2000; // 落在第 0 个扇区 [0, 0x4000) 中部
    const total = 0x4000; // 跨越第 0 扇区尾部和第 1 扇区头部
    const image = new Uint8Array(total).map((_, i) => (i * 7 + 3) & 0xff);

    const writeRes = await adapter.writeROM(image, createOptions({
      baseAddress,
      size: total,
      romPageSize: 4096,
      cfiInfo: createCfiInfo(sectorSize * 2),
    }));

    expect(writeRes.success).toBe(true);
    expect(storage.subarray(baseAddress, baseAddress + total)).toEqual(image);
    expect(summaryCalls).toHaveLength(1);
    expect(summaryCalls[0].retryCount).toBe(0);
    expect(summaryCalls[0].totalSize).toBe('16.0 KiB');
  });

  it('returns failure without re-erasing when direct write retries are exhausted', async () => {
    const adapter = new GBAAdapter(createMockDevice());
    vi.spyOn(adapter, 'switchROMBank').mockResolvedValue(undefined);
    mockRomEraseSector.mockResolvedValue(undefined);
    mockRomRead.mockResolvedValue(new Uint8Array([0xff]));
    mockRomProgram.mockRejectedValue(new Error('persistent program fault'));

    const writeRes = await adapter.writeROM(new Uint8Array(64).fill(0x33), createOptions({
      baseAddress: 0x4000,
      size: 64,
      romPageSize: 64,
      cfiInfo: createCfiInfo(0x8000),
    }));

    expect(writeRes.success).toBe(false);
    expect(writeRes.message).toContain('persistent program fault');
    expect(mockRomEraseSector).toHaveBeenCalledTimes(1);
    expect(mockRomProgram).toHaveBeenCalledTimes(2);
  });
});
