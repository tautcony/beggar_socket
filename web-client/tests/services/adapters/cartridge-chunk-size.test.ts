import { beforeEach, describe, expect, it } from 'vitest';

import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { VARIANT_IDS } from '@/device/definitions';
import type { SessionProfile } from '@/device/session';
import { CartridgeAdapter } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DeviceInfo } from '@/types/device-info';

import { buildTestSession } from '../../helpers/session-profile';

class ChunkAdapter extends CartridgeAdapter {
  constructor(
    private readonly simulated: boolean,
    // Without a session the adapter still needs an explicit profile: nothing is inferred.
    device: DeviceInfo = { port: null, firmwareProfile: STM_FIRMWARE_PROFILE },
  ) {
    super(device);
  }

  protected override isSimulatedDevice(): boolean {
    return this.simulated;
  }

  pageSizes(requested?: number): number[] {
    return [this.resolveRomPageSize(requested), this.resolveRamPageSize(requested)];
  }

  /** `[romWrite, romRead]` from the resolved limits. */
  romSizes(requested?: number): number[] {
    return [this.resolveRomPageSize(requested), this.resolveRomReadPageSize(requested)];
  }

  maxReadChunk(): number {
    return this.resolveMaxReadChunk();
  }

  withSession(profile?: SessionProfile): this {
    return this.applySessionProfile(profile);
  }
}

function deviceWith(firmwareProfile: DeviceInfo['firmwareProfile']): DeviceInfo {
  return { port: null, firmwareProfile };
}

describe('Cartridge adapter transfer chunks', () => {
  beforeEach(() => {
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.romPageSize = 0x1000;
    AdvancedSettings.ramPageSize = 0x1000;
  });

  it('keeps accelerated simulation aligned to the smallest cartridge window', () => {
    const adapter = new ChunkAdapter(true);
    expect(adapter.pageSizes()).toEqual([0x2000, 0x2000]);
    expect(adapter.pageSizes(0x40)).toEqual([0x2000, 0x2000]);
    expect(adapter.pageSizes(0xffff)).toEqual([0x2000, 0x2000]);
  });

  it('preserves configured and requested page sizes for hardware', () => {
    const adapter = new ChunkAdapter(false);
    expect(adapter.pageSizes()).toEqual([0x1000, 0x1000]);
    expect(adapter.pageSizes(0x100)).toEqual([0x100, 0x100]);
    expect(adapter.pageSizes(0xffff)).toEqual([0x1000, 0x1000]);
  });

  it('caps a standard STM session at its 4 KiB read ceiling', () => {
    const adapter = new ChunkAdapter(false).withSession(buildTestSession(VARIANT_IDS.stm));

    expect(adapter.maxReadChunk()).toBe(0x1000);
    expect(adapter.romSizes(0x8000)).toEqual([0x1000, 0x1000]);
  });

  it('lets an STC session read a configured 32 KiB page', () => {
    AdvancedSettings.setNamespaceSize('beggar.stc', 'romReadPageSize', 0x8000);
    const adapter = new ChunkAdapter(false, deviceWith(STC_FIRMWARE_PROFILE))
      .withSession(buildTestSession(VARIANT_IDS.stc));

    expect(adapter.maxReadChunk()).toBe(0x8000);
    // STC reads use its own configured page; the write page keeps the inherited STM rules.
    expect(adapter.romSizes()).toEqual([0x1000, 0x8000]);
  });

  it('gives Boost its own 8 KiB read ceiling while sharing the STM packet settings', () => {
    const adapter = new ChunkAdapter(false, deviceWith(STM_FIRMWARE_PROFILE))
      .withSession(buildTestSession(VARIANT_IDS.stmBoost));

    expect(STM_FIRMWARE_PROFILE.maxReadChunk).toBe(0x1000);
    // The ceiling comes from the Boost session, not from the legacy STM profile.
    expect(adapter.maxReadChunk()).toBe(0x2000);
    expect(adapter.romSizes(0x8000)).toEqual([0x1000, 0x1000]);
  });

  it('declares the same FlashGBX read buffer for CH340 and CDC sessions', () => {
    // One CART_READ fills the 4 KiB buffer; the 256B packet limit only bounds a frame, so
    // it must not become the read chunk.
    const ch340 = new ChunkAdapter(false).withSession(buildTestSession(VARIANT_IDS.gbflash));
    expect(ch340.maxReadChunk()).toBe(0x1000);

    const cdc = new ChunkAdapter(false).withSession(
      buildTestSession(VARIANT_IDS.gbflash, { usb: { vendorId: '16c0', productId: '27dd' } }),
    );
    expect(cdc.maxReadChunk()).toBe(0x1000);
  });

  it('follows the host packet limits published by the session, not the host the code runs on', () => {
    const windows = new ChunkAdapter(false).withSession(buildTestSession(VARIANT_IDS.stm, { hostPlatform: 'windows' }));
    const linux = new ChunkAdapter(false).withSession(buildTestSession(VARIANT_IDS.stm, { hostPlatform: 'linux' }));

    expect(windows.romSizes(0x8000)).toEqual([0x1000, 0x1000]);
    expect(linux.romSizes(0x8000)).toEqual([0x0c00, 0x0c00]);
  });

  it('falls back to the legacy lookup when no session is attached', () => {
    const adapter = new ChunkAdapter(false).withSession(undefined);
    expect(adapter.romSizes(0x8000)).toEqual([0x1000, 0x1000]);
  });
});
