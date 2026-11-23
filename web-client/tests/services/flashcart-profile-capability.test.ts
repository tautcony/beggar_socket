/**
 * The flashcart database is a session capability, not a firmware identity.
 *
 * `profile.flashcartDb` is the only gate: a GBFlash session declares it, the Beggar
 * variants do not. Everything the adapter decides about profiles (adopting an externally
 * supplied id, validating it, falling back to Auto/CFI) goes through that one query.
 */
import { describe, expect, it, vi } from 'vitest';

import { FLASHGBX_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { VARIANT_IDS } from '@/device/definitions';
import { FlashgbxMbcAdapter } from '@/services/flashgbx-mbc-adapter';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';

import { buildFlashgbxSession, buildTestSession, TEST_FLASHGBX_INFO } from '../helpers/session-profile';

const PROFILE_ID = 'dmg:some-profile';

/** Exposes the protected profile gate so the decision can be asserted without I/O. */
class ProbeAdapter extends FlashgbxMbcAdapter {
  supportsProfiles(): boolean {
    return this.supportsFlashcartProfiles();
  }

  profileIdFor(options?: Partial<CommandOptions>): string | undefined {
    return this.flashcartProfileIdFor(options);
  }
}

function deviceWith(session: DeviceInfo['session']): DeviceInfo {
  return {
    port: null,
    connection: null,
    transport: {
      send: vi.fn(() => Promise.resolve(true)),
      read: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
      sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
      setSignals: vi.fn(() => Promise.resolve()),
      flushInput: vi.fn(() => Promise.resolve()),
      flushOutput: vi.fn(() => Promise.resolve()),
    },
    firmwareProfile: FLASHGBX_FIRMWARE_PROFILE,
    flashgbxInfo: TEST_FLASHGBX_INFO,
    session,
  };
}

describe('flashcart profile capability gate', () => {
  it('lets a GBFlash session adopt an externally supplied profile', () => {
    const adapter = new ProbeAdapter(deviceWith(buildFlashgbxSession()));

    expect(adapter.supportsProfiles()).toBe(true);
    expect(adapter.profileIdFor({ flashcartProfileId: PROFILE_ID })).toBe(PROFILE_ID);
    // No id supplied: nothing is adopted, the CFI path stays the default.
    expect(adapter.profileIdFor({})).toBeUndefined();
  });

  it.each([VARIANT_IDS.stm, VARIANT_IDS.stmBoost, VARIANT_IDS.stc])(
    'drops an externally supplied profile on the %s session',
    variantId => {
      const adapter = new ProbeAdapter(deviceWith(buildTestSession(variantId)));

      expect(adapter.supportsProfiles()).toBe(false);
      expect(adapter.profileIdFor({ flashcartProfileId: PROFILE_ID })).toBeUndefined();
    },
  );

  it('treats a device without a committed session as incapable', () => {
    const adapter = new ProbeAdapter({ ...deviceWith(undefined), session: undefined });

    expect(adapter.supportsProfiles()).toBe(false);
    expect(adapter.profileIdFor({ flashcartProfileId: PROFILE_ID })).toBeUndefined();
  });
});
