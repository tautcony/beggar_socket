import { describe, expect, it } from 'vitest';

import {
  FLASHGBX_FIRMWARE_PROFILE,
  getFirmwareProfile,
  getFirmwareProfileById,
  isRamTypeSupportedByFirmware,
  STC_FIRMWARE_PROFILE,
  STM_FIRMWARE_PROFILE,
  UNKNOWN_FIRMWARE_PROFILE,
  withBeggarBoostProfile,
} from '@/device/compat/firmware-profile';
import type { DeviceInfo } from '@/types/device-info';

describe('legacy firmware profile facade', () => {
  it('derives the legacy ids, labels and read ceilings from registered definitions', () => {
    expect(getFirmwareProfileById('stm')).toBe(STM_FIRMWARE_PROFILE);
    expect(getFirmwareProfileById('stc')).toBe(STC_FIRMWARE_PROFILE);
    expect(getFirmwareProfileById('flashgbx')).toBe(FLASHGBX_FIRMWARE_PROFILE);
    expect(getFirmwareProfileById('unknown')).toBe(UNKNOWN_FIRMWARE_PROFILE);

    expect(STM_FIRMWARE_PROFILE).toMatchObject({ label: '丐中丐', maxReadChunk: 0x1000 });
    expect(STC_FIRMWARE_PROFILE).toMatchObject({ label: '碳酸丐', maxReadChunk: 0x8000 });
    expect(FLASHGBX_FIRMWARE_PROFILE).toMatchObject({ label: 'FlashGBX', maxReadChunk: 0x100 });
  });

  it('projects capability declarations onto the legacy boolean flags', () => {
    expect(STM_FIRMWARE_PROFILE.capabilities).toEqual({
      gbaSectorErase: true,
      gbaFramRam: true,
      gbcFramRam: true,
      cartPowerControl: false,
      boostMode: false,
      nativeFlashgbxProtocol: false,
      audioWePin: false,
    });

    expect(STC_FIRMWARE_PROFILE.capabilities.gbaFramRam).toBe(false);
    expect(STC_FIRMWARE_PROFILE.capabilities.gbcFramRam).toBe(true);
    expect(STC_FIRMWARE_PROFILE.capabilities.cartPowerControl).toBe(true);

    expect(FLASHGBX_FIRMWARE_PROFILE.capabilities.nativeFlashgbxProtocol).toBe(true);
    // Conditional capabilities read as unavailable in the static legacy view.
    expect(FLASHGBX_FIRMWARE_PROFILE.capabilities.cartPowerControl).toBe(false);
    expect(FLASHGBX_FIRMWARE_PROFILE.capabilities.audioWePin).toBe(false);
  });

  it('keeps the Boost compat helper off the standard STM constant', () => {
    const boost = withBeggarBoostProfile(STM_FIRMWARE_PROFILE, 'v1.2');
    expect(boost.id).toBe('stm');
    expect(boost.label).toBe('丐中丐 (Boost)');
    expect(boost.maxReadChunk).toBe(0x2000);
    expect(boost.firmwareVersion).toBe('v1.2');
    expect(boost.capabilities.boostMode).toBe(true);
    expect(STM_FIRMWARE_PROFILE.capabilities.boostMode).toBe(false);
    expect(STM_FIRMWARE_PROFILE.maxReadChunk).toBe(0x1000);
  });

  it('keeps loose defaults for unknown devices only in the facade', () => {
    const profile = getFirmwareProfileById('unknown');
    expect(profile.capabilities.gbaSectorErase).toBe(true);
    expect(profile.capabilities.cartPowerControl).toBe(true);
    // No registered firmware opts into that permissiveness.
    expect(STM_FIRMWARE_PROFILE.capabilities.cartPowerControl).toBe(false);
    expect(FLASHGBX_FIRMWARE_PROFILE.capabilities.cartPowerControl).toBe(false);
  });

  it('still reads a profile from a device with no session', () => {
    const device = {
      port: null,
      portInfo: { path: '/dev/cu.usbmodem6D83538A48851', vendorId: '0483', productId: '0721' },
    } as DeviceInfo;
    expect(getFirmwareProfile(device)).toBe(STM_FIRMWARE_PROFILE);
  });

  it('keeps the FRAM gap readable through the legacy helper', () => {
    expect(isRamTypeSupportedByFirmware(STC_FIRMWARE_PROFILE, 'gba', 'FRAM')).toBe(false);
    expect(isRamTypeSupportedByFirmware(STC_FIRMWARE_PROFILE, 'mbc5', 'FRAM')).toBe(true);
    expect(isRamTypeSupportedByFirmware(STM_FIRMWARE_PROFILE, 'gba', 'FRAM')).toBe(true);
  });
});
