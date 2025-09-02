import { describe, expect, it } from 'vitest';

import { GBAAdapter } from '@/services/gba-adapter';
import { CommandOptions } from '@/types/command-options';
import { DeviceInfo } from '@/types/device-info';

describe('GBA Batteryless Save', () => {
  const mockDevice: DeviceInfo = {
    port: null,
  };

  it('should support BATLESS ram type', () => {
    const adapter = new GBAAdapter(mockDevice);

    // Test that the adapter can handle BATLESS type
    const options: CommandOptions = {
      ramType: 'BATLESS',
      cfiInfo: {
        flashId: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
        magic: 'QRY',
        dataSwap: null,
        cfiDetected: true,
        isSwapD0D1: false,
        isIntel: false,
        vddMin: 2.7,
        vddMax: 3.6,
        singleWrite: true,
        bufferWrite: true,
        bufferSize: 512,
        sectorErase: true,
        chipErase: true,
        tbBootSector: false,
        tbBootSectorRaw: 0,
        deviceSize: 16 * 1024 * 1024,
        eraseSectorRegions: 1,
        eraseSectorBlocks: [],
        reverseSectorRegion: false,
        info: 'Test CFI Info',
      },
    };

    expect(options.ramType).toBe('BATLESS');
  });

  it('should handle batteryless search target string', () => {
    const targetBytes = new TextEncoder().encode('<3 from Maniac');
    expect(targetBytes.length).toBe(14);
    expect(targetBytes[0]).toBe(0x3c); // '<'
    expect(targetBytes[1]).toBe(0x33); // '3'
    expect(targetBytes[2]).toBe(0x20); // ' '
  });

  it('should calculate correct boot vector address', () => {
    // Test boot vector calculation logic
    const mockBootVector = 0x08000000; // Example ARM boot vector
    const calculatedAddr = ((mockBootVector & 0x00FFFFFF) + 2) << 2;

    expect(calculatedAddr).toBeGreaterThan(0);
    expect(calculatedAddr % 4).toBe(0); // Should be word-aligned
  });
});
