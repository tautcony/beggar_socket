import { describe, expect, it } from 'vitest';

import {
  getFirmwareProfileById,
  inferFirmwareProfileFromPort,
  isRamTypeSupportedByFirmware,
  STC_FIRMWARE_PROFILE,
  STM_FIRMWARE_PROFILE,
  UNKNOWN_FIRMWARE_PROFILE,
} from '@/types/firmware-profile';

describe('firmware profile detection', () => {
  it('resolves profiles by configured id', () => {
    expect(getFirmwareProfileById('stm')).toBe(STM_FIRMWARE_PROFILE);
    expect(getFirmwareProfileById('stc')).toBe(STC_FIRMWARE_PROFILE);
    expect(getFirmwareProfileById('unknown')).toBe(UNKNOWN_FIRMWARE_PROFILE);
  });

  it('detects STC by descriptor text before VID/PID fallback', () => {
    const profile = inferFirmwareProfileFromPort({
      path: '/dev/cu.usbmodem-stc8',
      vendorId: '0483',
      productId: '0721',
      manufacturer: 'STC MCU Limited',
      product: 'STC8H USB CDC',
    });

    expect(profile).toBe(STC_FIRMWARE_PROFILE);
  });

  it('keeps bare shared VID/PID unknown when no descriptor can distinguish firmware', () => {
    const profile = inferFirmwareProfileFromPort({
      path: 'web-serial',
      vendorId: '0483',
      productId: '0721',
    });

    expect(profile).toBe(UNKNOWN_FIRMWARE_PROFILE);
  });

  it('detects STM by the generated CDC serial suffix in native port paths', () => {
    const profile = inferFirmwareProfileFromPort({
      path: '/dev/cu.usbmodem6D83538A48851',
      vendorId: '0483',
      productId: '0721',
      manufacturer: 'CNY Industry',
      product: 'GBA Burner for ChisFlash',
    });

    expect(profile).toBe(STM_FIRMWARE_PROFILE);
  });

  it('detects STC by the generic numbered CDC path when VID/PID matches', () => {
    const profile = inferFirmwareProfileFromPort({
      path: '/dev/cu.usbmodem101',
      vendorId: '0483',
      productId: '0721',
      manufacturer: 'CNY Industry',
      product: 'GBA Burner for ChisFlash',
    });

    expect(profile).toBe(STC_FIRMWARE_PROFILE);
  });

  it('keeps unknown devices permissive', () => {
    const profile = inferFirmwareProfileFromPort({
      path: '/dev/cu.debug',
      vendorId: '1234',
      productId: '5678',
    });

    expect(profile).toBe(UNKNOWN_FIRMWARE_PROFILE);
    expect(profile.capabilities.gbaSectorErase).toBe(true);
  });

  it('models STC GBA FRAM gap without blocking MBC FRAM', () => {
    expect(isRamTypeSupportedByFirmware(STC_FIRMWARE_PROFILE, 'gba', 'FRAM')).toBe(false);
    expect(isRamTypeSupportedByFirmware(STC_FIRMWARE_PROFILE, 'mbc5', 'FRAM')).toBe(true);
    expect(isRamTypeSupportedByFirmware(STC_FIRMWARE_PROFILE, 'gba', 'SRAM')).toBe(true);
  });
});
