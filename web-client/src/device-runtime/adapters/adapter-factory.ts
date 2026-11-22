/**
 * Per-session adapter assembly.
 *
 * Adapters are created from the committed `SessionProfile`, so one connection can never
 * mix adapters from another session: the factory only runs while the caller holds the
 * session it came from, and every adapter reads its transfer limits from that profile.
 */
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { FlashgbxGbaAdapter } from '@/services/flashgbx-gba-adapter';
import { FlashgbxMbcAdapter } from '@/services/flashgbx-mbc-adapter';
import type { FlashgbxBaseAdapter } from '@/services/flashgbx-base-adapter';

import type { AdapterFactory, ModeSyncStrategy } from '../composition-registry';

/** GBA / MBC5 adapters of the Beggar family. */
export function createBeggarAdapterFactory(): AdapterFactory {
  return {
    create(platform, context) {
      const adapter = platform === 'gba'
        ? new GBAAdapter(context.device, context.log, context.updateProgress, context.t)
        : new MBC5Adapter(context.device, context.log, context.updateProgress, context.t);
      return adapter.applySessionProfile(context.profile);
    },
  };
}

/** FlashGBX GBA / DMG adapters, plus the shared hardware mode sync. */
export function createFlashgbxAdapterFactory(): AdapterFactory {
  return {
    create(platform, context) {
      const adapter = platform === 'gba'
        ? new FlashgbxGbaAdapter(context.device, context.log, context.updateProgress, context.t)
        : new FlashgbxMbcAdapter(context.device, context.log, context.updateProgress, context.t);
      return adapter.applySessionProfile(context.profile);
    },
  };
}

/**
 * FlashGBX models expose one GBA/DMG switch over the shared command client, so mode sync
 * belongs to the session that owns it.
 */
export const flashgbxModeSync: ModeSyncStrategy = async (adapter, mode) => {
  await (adapter as FlashgbxBaseAdapter).syncHardwareMode(mode === 'gba' ? 'GBA' : 'MBC5');
};
