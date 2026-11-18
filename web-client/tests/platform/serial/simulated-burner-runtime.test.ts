import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimulatedDeviceGateway } from '@/platform/serial/simulated/device-gateway';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { DebugSettings } from '@/settings/debug-settings';
import type { CommandOptions } from '@/types/command-options';

vi.mock('@/utils/async-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/async-utils')>();

  return {
    ...actual,
    timeout: vi.fn().mockResolvedValue(undefined),
  };
});

const t = (key: string) => key;

function toDeviceInfo(handle: Awaited<ReturnType<SimulatedDeviceGateway['connect']>>) {
  return {
    port: handle.port,
    connection: null,
    transport: handle.transport,
    serialHandle: handle,
    portInfo: handle.portInfo,
    firmwareProfile: handle.firmwareProfile,
  };
}

function createTestData(size: number, seed: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    data[index] = (seed + (index * 17)) & 0xff;
  }
  return data;
}

describe('Simulated burner runtime', () => {
  beforeEach(() => {
    DebugSettings.debugMode = true;
    DebugSettings.simulatedDelay = 0;
    DebugSettings.simulateErrors = false;
    DebugSettings.errorProbability = 0;
    DebugSettings.clearAllSimulatedMemoryImages();
  });

  it('runs GBA ROM flows through the real adapter against a simulated device', async () => {
    const gateway = new SimulatedDeviceGateway();
    const handle = await gateway.connect();
    await gateway.init(handle);

    const device = toDeviceInfo(handle);
    const adapter = new GBAAdapter(device, null, null, t);
    const cfiInfo = await adapter.getCartInfo();

    expect(cfiInfo).not.toBe(false);
    if (!cfiInfo) {
      throw new Error('Expected simulated GBA CFI info');
    }
    expect(cfiInfo.deviceSize).toBe(32 * 1024 * 1024);

    const payload = createTestData(512, 0x31);
    const options: CommandOptions = {
      cfiInfo,
      baseAddress: 0,
      size: payload.length,
    };

    const writeResult = await adapter.writeROM(payload, options);
    expect(writeResult.success).toBe(true);

    const readResult = await adapter.readROM(payload.length, options, undefined, false);
    expect(readResult.success).toBe(true);
    expect(readResult.data).toEqual(payload);
  });

  it('runs MBC5 ROM flows through the real adapter against a simulated device', async () => {
    const gateway = new SimulatedDeviceGateway();
    const handle = await gateway.connect();
    await gateway.init(handle);

    const device = toDeviceInfo(handle);
    const adapter = new MBC5Adapter(device, null, null, t);
    const cfiInfo = await adapter.getCartInfo();

    expect(cfiInfo).not.toBe(false);
    if (!cfiInfo) {
      throw new Error('Expected simulated MBC5 CFI info');
    }
    expect(cfiInfo.deviceSize).toBe(8 * 1024 * 1024);

    const payload = createTestData(384, 0x57);
    const options: CommandOptions = {
      cfiInfo,
      baseAddress: 0,
      size: payload.length,
      mbcType: 'MBC5',
    };

    const writeResult = await adapter.writeROM(payload, options);
    expect(writeResult.success).toBe(true);

    const readResult = await adapter.readROM(payload.length, options, undefined, false);
    expect(readResult.success).toBe(true);
    expect(readResult.data).toEqual(payload);
  });

  it('initializes simulated ROM from user-provided image data', async () => {
    const configuredImage = createTestData(64, 0x22);
    DebugSettings.setSimulatedMemoryImage('gbaRom', configuredImage, 'configured.gba');

    const gateway = new SimulatedDeviceGateway();
    const handle = await gateway.connect();
    await gateway.init(handle);

    const device = toDeviceInfo(handle);
    const adapter = new GBAAdapter(device, null, null, t);
    const cfiInfo = await adapter.getCartInfo();
    expect(cfiInfo).not.toBe(false);
    if (!cfiInfo) {
      throw new Error('Expected simulated GBA CFI info');
    }

    const readResult = await adapter.readROM(configuredImage.length, {
      cfiInfo,
      baseAddress: 0,
      size: configuredImage.length,
    }, undefined, false);

    expect(readResult.success).toBe(true);
    expect(readResult.data).toEqual(configuredImage);
  });

  it.each([
    ['GBA', 'SRAM'],
    ['GBA', 'FRAM'],
    ['MBC5', 'SRAM'],
    ['MBC5', 'FRAM'],
  ] as const)('round trips 128 KiB %s %s through representable frames', async (platform, ramType) => {
    const gateway = new SimulatedDeviceGateway();
    const handle = await gateway.connect();
    await gateway.init(handle);
    const transport = handle.transport;
    if (!transport) throw new Error('Expected simulated transport');
    const send = vi.spyOn(transport, 'send');
    const device = toDeviceInfo(handle);
    const adapter = platform === 'GBA'
      ? new GBAAdapter(device, null, null, t)
      : new MBC5Adapter(device, null, null, t);
    const data = new Uint8Array(128 * 1024);
    for (let index = 0; index < data.length; index++) {
      data[index] = (index * 17 + Math.floor(index / 0x2000) * 31) & 0xff;
    }
    const cfiInfo = await adapter.getCartInfo();
    if (!cfiInfo) throw new Error('Expected simulated CFI info');
    const options: CommandOptions = { cfiInfo, ramType, mbcType: 'MBC5', baseAddress: 0, size: data.length };
    expect((await adapter.writeRAM(data, options)).success).toBe(true);
    const read = await adapter.readRAM(data.length, options);
    expect(read.success).toBe(true);
    expect('data' in read ? read.data : undefined).toEqual(data);
    const frames = send.mock.calls.map(([frame]) => frame);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.byteLength).toBeLessThanOrEqual(0xffff);
      expect((frame[0] ?? 0) | ((frame[1] ?? 0) << 8)).toBe(frame.byteLength);
      expect(frame.subarray(-2)).toEqual(new Uint8Array([0, 0]));
    }
    const maxFrameSize = Math.max(...frames.map(frame => frame.byteLength));
    expect(maxFrameSize).toBe(0x2000 + (ramType === 'FRAM' ? 10 : 9));
  });
});
