import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toLegacyDeviceInfo } from '@/platform/serial';
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

    const device = toLegacyDeviceInfo(handle);
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

    const device = toLegacyDeviceInfo(handle);
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

    const device = toLegacyDeviceInfo(handle);
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
});
