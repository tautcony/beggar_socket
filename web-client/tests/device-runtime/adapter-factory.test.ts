import { describe, expect, it, vi } from 'vitest';

import { VARIANT_IDS } from '@/device/definitions';
import type { SessionProfile } from '@/device/session';
import {
  createBeggarAdapterFactory,
  createFlashgbxAdapterFactory,
  flashgbxModeSync,
  type AdapterContext,
} from '@/device-runtime';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { FlashgbxGbaAdapter } from '@/services/flashgbx-gba-adapter';
import { FlashgbxMbcAdapter } from '@/services/flashgbx-mbc-adapter';
import { FlashgbxBaseAdapter } from '@/services/flashgbx-base-adapter';
import type { DeviceInfo } from '@/types/device-info';

import { buildFlashgbxSession, buildStmSession, buildTestSession } from '../helpers/session-profile';

/** The factories are the only place adapters learn which session they belong to. */
function sessionOf(adapter: unknown): SessionProfile | undefined {
  return (adapter as { sessionProfile?: SessionProfile }).sessionProfile;
}

function contextFor(profile: SessionProfile): AdapterContext {
  const device: DeviceInfo = {
    port: null,
    // The FlashGBX adapters bind a command client to the transport of their device.
    transport: {
      send: vi.fn(() => Promise.resolve(true)),
      read: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
      sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
      setSignals: vi.fn(() => Promise.resolve()),
      flushInput: vi.fn(() => Promise.resolve()),
      flushOutput: vi.fn(() => Promise.resolve()),
    },
    connection: null,
    connectionId: 'session-1',
    session: profile,
  };
  return {
    device,
    profile,
    log: vi.fn(),
    updateProgress: vi.fn(),
    t: (key: string) => key,
  };
}

describe('Runtime adapter factories', () => {
  it('assembles the Beggar GBA / MBC5 adapters from the committed session', () => {
    const profile = buildStmSession();
    const factory = createBeggarAdapterFactory();
    const context = contextFor(profile);

    const gba = factory.create('gba', context);
    const mbc5 = factory.create('mbc5', context);

    expect(gba).toBeInstanceOf(GBAAdapter);
    expect(mbc5).toBeInstanceOf(MBC5Adapter);
    expect(sessionOf(gba)?.variantId).toBe(VARIANT_IDS.stm);
    expect(sessionOf(mbc5)?.variantId).toBe(VARIANT_IDS.stm);
    expect((gba as unknown as { device: DeviceInfo }).device).toBe(context.device);
  });

  it('assembles the FlashGBX GBA / DMG adapters from the committed session', () => {
    const profile = buildFlashgbxSession();
    const factory = createFlashgbxAdapterFactory();
    const context = contextFor(profile);

    const gba = factory.create('gba', context);
    const mbc5 = factory.create('mbc5', context);

    expect(gba).toBeInstanceOf(FlashgbxGbaAdapter);
    expect(mbc5).toBeInstanceOf(FlashgbxMbcAdapter);
    expect(sessionOf(gba)?.variantId).toBe(VARIANT_IDS.gbflash);
    expect(sessionOf(mbc5)?.variantId).toBe(VARIANT_IDS.gbflash);
  });

  it('binds every adapter to the session it was created for, never to a previous one', () => {
    const factory = createBeggarAdapterFactory();
    const first = buildStmSession();
    const second = buildTestSession(VARIANT_IDS.stc);

    const firstGba = factory.create('gba', contextFor(first));
    const secondGba = factory.create('gba', contextFor(second));

    expect(sessionOf(firstGba)?.variantId).toBe(VARIANT_IDS.stm);
    expect(sessionOf(secondGba)?.variantId).toBe(VARIANT_IDS.stc);
    expect(sessionOf(firstGba)).not.toBe(sessionOf(secondGba));
    // Creating adapters never mutates the profile they came from.
    expect(first.variantId).toBe(VARIANT_IDS.stm);
  });

  it('routes mode sync through the FlashGBX hardware switch', async () => {
    const spy = vi.spyOn(FlashgbxBaseAdapter.prototype, 'syncHardwareMode').mockResolvedValue(undefined);

    try {
      const adapter = createFlashgbxAdapterFactory().create('gba', contextFor(buildFlashgbxSession()));

      await flashgbxModeSync(adapter, 'gba');
      await flashgbxModeSync(adapter, 'mbc5');

      expect(spy.mock.calls).toEqual([['GBA'], ['MBC5']]);
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves the Beggar binding without a mode-sync strategy (it switches in hardware)', async () => {
    const { createBeggarRuntimeBinding, createFlashgbxRuntimeBinding } = await import('@/device-runtime');

    expect(createBeggarRuntimeBinding().modeSyncStrategy).toBeUndefined();
    expect(createFlashgbxRuntimeBinding().modeSyncStrategy).toBe(flashgbxModeSync);
  });
});
