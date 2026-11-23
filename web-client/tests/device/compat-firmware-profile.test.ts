/**
 * Transitional facade of the legacy `FirmwareProfile` shape.
 *
 * Only the projection of a committed session survives: the app never invents a profile
 * from port strings and never falls back to permissive defaults for unknown devices.
 */
import { describe, expect, it } from 'vitest';

import {
  firmwareProfileFromSession,
  firmwareUnsupportedResult,
  FLASHGBX_FIRMWARE_PROFILE,
  STC_FIRMWARE_PROFILE,
  STM_FIRMWARE_PROFILE,
} from '@/device/compat/firmware-profile';
import { VARIANT_IDS } from '@/device/definitions';

import { buildFlashgbxSession, buildStmSession, buildTestSession } from '../helpers/session-profile';

describe('legacy firmware profile facade', () => {
  it('derives the legacy ids, labels and read ceilings from registered definitions', () => {
    expect(STM_FIRMWARE_PROFILE).toMatchObject({ label: '丐中丐', maxReadChunk: 0x1000 });
    expect(STC_FIRMWARE_PROFILE).toMatchObject({ label: '碳酸丐', maxReadChunk: 0x8000 });
    // FlashGBX reads one 4 KiB buffer per request; the 256B cap is a frame limit.
    expect(FLASHGBX_FIRMWARE_PROFILE).toMatchObject({ label: 'FlashGBX', maxReadChunk: 0x1000 });
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

  it('projects a committed session without drifting from it', () => {
    const stm = firmwareProfileFromSession(buildStmSession({ firmwareVersion: 'v1.2' }));
    expect(stm.id).toBe('stm');
    expect(stm.firmwareVersion).toBe('v1.2');
    expect(stm.maxReadChunk).toBe(0x1000);
    expect(stm.capabilities.boostMode).toBe(false);

    const boost = firmwareProfileFromSession(buildTestSession(VARIANT_IDS.stmBoost));
    expect(boost.id).toBe('stm');
    expect(boost.capabilities.boostMode).toBe(true);
    expect(boost.maxReadChunk).toBe(0x2000);

    const stc = firmwareProfileFromSession(buildTestSession(VARIANT_IDS.stc));
    expect(stc.id).toBe('stc');

    const flashgbx = firmwareProfileFromSession(buildFlashgbxSession());
    expect(flashgbx.id).toBe('flashgbx');
    expect(flashgbx.capabilities.nativeFlashgbxProtocol).toBe(true);
  });

  it('formats the unsupported-operation message from the profile label', () => {
    expect(firmwareUnsupportedResult('GBA ROM sector erase', STC_FIRMWARE_PROFILE)).toEqual({
      success: false,
      message: 'GBA ROM sector erase is not supported by 碳酸丐 firmware',
      errorCode: 'unsupported',
      errorStage: 'protocol',
    });
  });
});
