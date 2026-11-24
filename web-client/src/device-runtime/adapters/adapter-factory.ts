/**
 * Per-session adapter assembly.
 *
 * Adapters are created from the committed `SessionProfile`, so one connection can never
 * mix adapters from another session: the factory only runs while the caller holds the
 * session it came from, and every adapter reads its transfer limits from that profile.
 */
import type { CartridgeAdapter } from '@/services/cartridge-adapter';
import { GbflashBaseAdapter } from '@/services/gbflash-base-adapter';
import { GbflashGbaAdapter } from '@/services/gbflash-gba-adapter';
import { GbflashMbcAdapter } from '@/services/gbflash-mbc-adapter';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';

import type { AdapterContext, AdapterFactory, ModeSyncStrategy } from '../composition-registry';

/**
 * Operations that own an `OperationSettingsSnapshot`.
 *
 * Page sizes, throttles, retries and timeouts are re-read when one of these starts, so a
 * settings edit applies to the next operation and never mid-transfer. Internal calls
 * (`this.verifyROM(...)`) run on the adapter itself and keep the snapshot they started with.
 */
const OPERATION_ENTRY_POINTS: readonly string[] = [
  'eraseSectors',
  'writeROM',
  'readROM',
  'verifyROM',
  'writeRAM',
  'readRAM',
  'verifyRAM',
  'getCartInfo',
  'searchBatteryless',
  'writeBatterylessSave',
  'readBatterylessSave',
  'verifyBatterylessSave',
];

/**
 * Binds the session parameters and gives every operation entry point its own snapshot.
 *
 * The snapshot is a scope, not a field: it is released on every exit — success, thrown
 * failure or cancellation — so a protocol call made on the same transport after the
 * operation can never read the deadlines of the operation that just finished.
 */
function bindSession(adapter: CartridgeAdapter, context: AdapterContext): CartridgeAdapter {
  adapter.applySessionProfile(context.profile);
  adapter.bindParameters(context.store);
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof property !== 'string' || typeof value !== 'function' || !OPERATION_ENTRY_POINTS.includes(property)) {
        return value;
      }
      return (...args: unknown[]) => {
        target.beginOperation();
        const release = (): void => {
          target.endOperation();
        };
        let result: unknown;
        try {
          result = (value as (...inner: unknown[]) => unknown).apply(target, args);
        } catch (error) {
          release();
          throw error;
        }
        if (result !== null && typeof (result as PromiseLike<unknown>).then === 'function') {
          return Promise.resolve(result).finally(release);
        }
        release();
        return result;
      };
    },
  });
}

/** GBA / MBC5 adapters of the Beggar family. */
export function createBeggarAdapterFactory(): AdapterFactory {
  return {
    create(platform, context) {
      const adapter = platform === 'gba'
        ? new GBAAdapter(context.device, context.log, context.updateProgress, context.t)
        : new MBC5Adapter(context.device, context.log, context.updateProgress, context.t);
      return bindSession(adapter, context);
    },
  };
}

/** GBFlash GBA / DMG adapters, plus the shared hardware mode sync. */
export function createGbflashAdapterFactory(): AdapterFactory {
  return {
    create(platform, context) {
      const adapter = platform === 'gba'
        ? new GbflashGbaAdapter(context.device, context.log, context.updateProgress, context.t)
        : new GbflashMbcAdapter(context.device, context.log, context.updateProgress, context.t);
      return bindSession(adapter, context);
    },
  };
}

/**
 * GBFlash models expose one GBA/DMG switch over the shared command client, so mode sync
 * belongs to the session that owns it.
 */
export const gbflashModeSync: ModeSyncStrategy = async (adapter, mode, enable5V = false) => {
  // Both GBFlash models extend the shared base class; anything else must not be forced
  // through a cast, because the hardware switch only exists on that transport.
  if (!(adapter instanceof GbflashBaseAdapter)) {
    throw new Error('GBFlash mode sync requires a GBFlash adapter');
  }
  await adapter.syncHardwareMode(mode === 'gba' ? 'GBA' : 'MBC5', enable5V);
};
