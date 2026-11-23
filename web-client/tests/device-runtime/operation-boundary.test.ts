/**
 * Settings boundaries of a live connection.
 *
 * A connection owns an immutable `SessionProfile`; parameters are persisted per namespace.
 * The two must meet at exactly two places: the next connection (selection, baud rate) and
 * the next operation (page sizes, throttles, retries, timeouts). An edit made while a
 * transfer runs may never change the transfer already in flight.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDeviceCatalog,
  createParameterStore,
  createSelectionProvider,
  GBFLASH_AUTO_BAUD_RATE,
  type ResolvedVariantSelection,
  VARIANT_IDS,
} from '@/device';
import type { ParameterStore } from '@/device/parameters';
import type { SessionProfile } from '@/device/session';
import {
  type AdapterContext,
  createBeggarAdapterFactory,
  createRuntimeComposition,
  createSessionResolver,
  type SessionResolver,
} from '@/device-runtime';
import type { ResolvedOperationSettings } from '@/services/cartridge-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import type { DeviceInfo } from '@/types/device-info';
import type { HostPlatform } from '@/types/host-platform';

import { createFakeSettingsStorage, type FakeSettingsStorage } from '../helpers/fake-settings-storage';

const PLATFORM: HostPlatform = 'windows';
const registry = createDeviceCatalog({ platform: PLATFORM });
const USB_STM = { vendorId: '0483', productId: '0721' };

interface Harness {
  readonly fake: FakeSettingsStorage;
  readonly store: ParameterStore;
  readonly resolver: SessionResolver;
}

function harness(options: { selectedVariantId?: string | null; independentSizes?: boolean } = {}): Harness {
  const fake = createFakeSettingsStorage(options);
  const store = createParameterStore({
    adapter: fake.adapter,
    platform: PLATFORM,
    schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
  });
  const resolver = createSessionResolver({ platform: PLATFORM, composition: createRuntimeComposition() });
  return { fake, store, resolver };
}

function sessionFor(
  resolver: SessionResolver,
  store: ParameterStore,
  variantId: string,
  usb: { vendorId: string; productId: string } | undefined = USB_STM,
): SessionProfile {
  const selection: ResolvedVariantSelection = registry.selectVariant(variantId);
  return resolver.resolve(
    selection,
    { firmwareId: selection.firmware.id, verification: 'verified', facts: {} },
    { backend: 'serial', ...(usb ? { usb } : {}) },
    store.operationSnapshot(selection.parameterNamespace).values,
  );
}

function adapterContext(profile: SessionProfile, store: ParameterStore): AdapterContext {
  const device: DeviceInfo = {
    port: null,
    transport: { send: vi.fn(), read: vi.fn() } as unknown as DeviceInfo['transport'],
    connection: null,
    connectionId: 'session-1',
    session: profile,
  };
  return { device, profile, log: vi.fn(), updateProgress: vi.fn(), t: (key: string) => key, store };
}

/** Operation values are protected on the adapter; the tests read them as a black box. */
function settingsOf(adapter: unknown): ResolvedOperationSettings {
  return (adapter as { settings: ResolvedOperationSettings }).settings;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('operation boundary', () => {
  it('freezes the settings of the running operation and re-reads them on the next boundary', () => {
    const { store, resolver } = harness({ selectedVariantId: VARIANT_IDS.stm });
    store.set('beggar.stm', 'romPageSize', 0x400);
    store.set('beggar.stm', 'romReadThrottleMs', 40);
    const profile = sessionFor(resolver, store, VARIANT_IDS.stm);

    const adapter = createBeggarAdapterFactory().create('gba', adapterContext(profile, store));
    expect(settingsOf(adapter).romPageSize).toBe(0x400);
    expect(settingsOf(adapter).romReadThrottleMs).toBe(40);

    // The user edits the settings while the operation is still running.
    store.set('beggar.stm', 'romPageSize', 0x800);
    store.set('beggar.stm', 'romReadThrottleMs', 0);

    expect(settingsOf(adapter).romPageSize).toBe(0x400);
    expect(settingsOf(adapter).romReadThrottleMs).toBe(40);

    // The next operation starts from the persisted values again.
    (adapter as unknown as { beginOperation(): void }).beginOperation();
    expect(settingsOf(adapter).romPageSize).toBe(0x800);
    expect(settingsOf(adapter).romReadThrottleMs).toBe(0);
  });

  it('starts a fresh snapshot on every operation entry point', async () => {
    const { store, resolver } = harness({ selectedVariantId: VARIANT_IDS.stm });
    const profile = sessionFor(resolver, store, VARIANT_IDS.stm);
    const begin = vi.spyOn(MBC5Adapter.prototype, 'beginOperation');
    const observed: number[] = [];
    vi.spyOn(MBC5Adapter.prototype, 'writeROM').mockImplementation(function (this: MBC5Adapter) {
      observed.push(settingsOf(this).romPageSize);
      return Promise.resolve({ success: true, message: 'ok' } as CommandResult);
    });

    const adapter = createBeggarAdapterFactory().create('mbc5', adapterContext(profile, store));

    store.set('beggar.stm', 'romPageSize', 0x400);
    await adapter.writeROM(new Uint8Array(4), {} as CommandOptions);
    store.set('beggar.stm', 'romPageSize', 0x800);
    await adapter.writeROM(new Uint8Array(4), {} as CommandOptions);

    expect(begin).toHaveBeenCalledTimes(2);
    expect(observed).toEqual([0x400, 0x800]);
  });

  it('keeps the live session on its own namespace while the saved selection changes', () => {
    const { fake, store, resolver } = harness({ selectedVariantId: VARIANT_IDS.stm, independentSizes: true });
    store.set('beggar.stm', 'romPageSize', 0x400);
    store.set('beggar.stc', 'romPageSize', 0x800);
    const live = sessionFor(resolver, store, VARIANT_IDS.stm);
    const adapter = createBeggarAdapterFactory().create('gba', adapterContext(live, store));

    // The user picks another firmware while the device stays connected.
    fake.adapter.writeSelection(VARIANT_IDS.stc);

    // The committed session is an immutable snapshot: it never follows the selection.
    expect(live.variantId).toBe(VARIANT_IDS.stm);
    expect(live.parameterNamespace).toBe('beggar.stm');
    expect(live.connectionParameters.romPageSize).toBe(0x400);
    expect(settingsOf(adapter).romPageSize).toBe(0x400);

    // Reconnecting resolves the new selection with its own namespace and values.
    const reconnected = sessionFor(resolver, store, VARIANT_IDS.stc);
    expect(reconnected.variantId).toBe(VARIANT_IDS.stc);
    expect(reconnected.parameterNamespace).toBe('beggar.stc');
    expect(reconnected.connectionParameters.romPageSize).toBe(0x800);
    expect(reconnected.capabilities).not.toBe(live.capabilities);
  });

  it('applies a baud rate change on reconnect, never on the running session', () => {
    const { store, resolver } = harness({ selectedVariantId: VARIANT_IDS.gbflash });
    const live = sessionFor(resolver, store, VARIANT_IDS.gbflash);
    expect(live.transport.baudRate).toBe(GBFLASH_AUTO_BAUD_RATE);

    store.set('flashgbx.cfw', 'baudRate', 1_500_000);

    // `requiresReconnect`: the open port keeps the speed it was opened with.
    expect(live.transport.baudRate).toBe(GBFLASH_AUTO_BAUD_RATE);
    expect(sessionFor(resolver, store, VARIANT_IDS.gbflash).transport.baudRate).toBe(1_500_000);
  });

  it('reads the values of the connected namespace, not of the newly selected one', () => {
    const { store, resolver } = harness({ selectedVariantId: VARIANT_IDS.stm });
    const live = sessionFor(resolver, store, VARIANT_IDS.stm);
    const adapter = createBeggarAdapterFactory().create('gba', adapterContext(live, store));
    const view = adapter as unknown as { parameterNamespace(): string; beginOperation(): void };

    // FlashGBX values stay untouched by a Beggar session, even after an edit elsewhere.
    store.set('flashgbx.cfw', 'romPageSize', 0x2000);
    view.beginOperation();

    expect(view.parameterNamespace()).toBe('beggar.stm');
    expect(settingsOf(adapter).romPageSize).not.toBe(0x2000);
  });
});
