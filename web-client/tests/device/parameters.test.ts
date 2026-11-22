import { describe, expect, it } from 'vitest';

import {
  createDeviceCatalog,
  createLegacySelectionProvider,
  createParameterStore,
  LEGACY_PROFILE_VARIANT_IDS,
  type LegacySettingsAdapter,
  ParameterError,
  VARIANT_IDS,
} from '@/device';

import { createFakeLegacySettings } from '../helpers/fake-legacy-settings';

function emptyAdapter(): LegacySettingsAdapter {
  return {
    readLegacyProfileId: () => 'stm',
    readParameter: () => undefined,
    writeParameter: () => undefined,
    readView: () => ({
      firmwareProfile: 'stm',
      stmBoost: false,
      flashgbxBaudRate: 'auto',
      profileSizes: {},
    }),
  };
}

describe('legacy-backed parameter store', () => {
  it('uses host derived schema defaults when nothing is stored', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const store = createParameterStore({
      adapter: emptyAdapter(),
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });

    expect(store.get('beggar.stm', 'romPageSize')).toBe(0x1000);
    expect(store.get('beggar.stm', 'romReadPageSize')).toBe(0x1000);
    expect(store.get('beggar.stc', 'romReadPageSize')).toBe(0x2000);
    expect(store.get('flashgbx.cfw', 'romPageSize')).toBe(0x100);
    expect(store.get('flashgbx.cfw', 'baudRate')).toBe('auto');
    expect(store.get('beggar.stm', 'defaultTimeout')).toBe(3000);
  });

  it('reads legacy persisted values through the single adapter', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const fake = createFakeLegacySettings();
    fake.profileSizes.stm.romPageSize = 0x800;
    fake.flashgbxBaudRate = 1_500_000;
    fake.values.set('global.romReadThrottleMs', 12);

    const store = createParameterStore({
      adapter: fake.adapter,
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });

    expect(store.get('beggar.stm', 'romPageSize')).toBe(0x800);
    expect(store.get('flashgbx.cfw', 'baudRate')).toBe(1_500_000);
    expect(store.get('beggar.stm', 'romReadThrottleMs')).toBe(12);
    expect(store.legacy.firmwareProfile).toBe('stm');
  });

  it('validates a write and reports the namespace and key on failure', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const fake = createFakeLegacySettings();
    const store = createParameterStore({
      adapter: fake.adapter,
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });

    store.set('beggar.stm', 'romPageSize', 0x800);
    expect(fake.writes).toEqual([{ namespace: 'beggar.stm', key: 'romPageSize', value: 0x800 }]);

    expect(() => { store.set('beggar.stm', 'romPageSize', 0x8000); }).toThrow(ParameterError);
    expect(() => { store.set('beggar.stm', 'romPageSize', 0x8000); }).toThrow(/above maximum/);

    let error: unknown;
    try {
      store.set('flashgbx.cfw', 'baudRate', 1234);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ParameterError);
    expect((error as ParameterError).namespace).toBe('flashgbx.cfw');
    expect((error as ParameterError).key).toBe('baudRate');
    expect((error as ParameterError).reason).toContain('expected one of');

    expect(() => { store.set('beggar.stm', 'nope', 1); }).toThrow(/unknown parameter/);
  });

  it('stamps an operation snapshot with global values plus namespaced values', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const fake = createFakeLegacySettings();
    fake.values.set('global.operationTimeout', 45_000);

    const store = createParameterStore({
      adapter: fake.adapter,
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });

    const snapshot = store.operationSnapshot('beggar.stc');
    expect(snapshot.namespace).toBe('beggar.stc');
    expect(snapshot.values.operationTimeout).toBe(45_000);
    expect(snapshot.values.romReadPageSize).toBe(0x2000);
    expect(snapshot.values.baudRate).toBeUndefined();
  });

  it('re-reads settings for every operation so changes apply to the next operation only', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const fake = createFakeLegacySettings();
    const store = createParameterStore({
      adapter: fake.adapter,
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });

    const first = store.operationSnapshot('beggar.stm');
    fake.profileSizes.stm.romPageSize = 0x800;
    const second = store.operationSnapshot('beggar.stm');

    expect(first.values.romPageSize).toBe(0x1000);
    expect(second.values.romPageSize).toBe(0x800);
    expect(first.values).not.toBe(second.values);
  });

  it('throws for unregistered namespaces', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    const store = createParameterStore({
      adapter: emptyAdapter(),
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });
    expect(() => store.snapshot('missing.ns')).toThrow(/not registered/);
  });
});

describe('legacy selection provider', () => {
  const registry = createDeviceCatalog({ platform: 'windows' });

  function provider(options: { legacyProfileId?: string; stmBoost?: boolean } = {}) {
    const fake = createFakeLegacySettings(options);
    return {
      fake,
      provider: createLegacySelectionProvider({
        adapter: fake.adapter,
        registry,
        legacyProfileVariants: LEGACY_PROFILE_VARIANT_IDS,
      }),
    };
  }

  it.each([
    ['stm', VARIANT_IDS.stm],
    ['stc', VARIANT_IDS.stc],
    ['flashgbx', VARIANT_IDS.gbflash],
  ])('maps legacy profile %s to %s', (legacyProfileId, expected) => {
    const { provider: selection } = provider({ legacyProfileId });
    expect(selection.read()).toEqual({ variantId: expected, source: 'legacy' });
  });

  it('never turns the legacy stmBoost flag into the Boost variant', () => {
    const { provider: selection } = provider({ legacyProfileId: 'stm', stmBoost: true });
    expect(selection.read()).toEqual({ variantId: VARIANT_IDS.stm, source: 'legacy' });
  });

  it('reports an invalid selection without falling back to a default', () => {
    const { provider: selection } = provider({ legacyProfileId: 'retired-device' });
    expect(selection.read()).toEqual({ source: 'invalid' });
    expect(selection.read().variantId).toBeUndefined();
  });

  it('reports v2 selections with source v2 and rejects stale ones', () => {
    const { fake, provider: selection } = provider();
    fake.selectedVariantId = VARIANT_IDS.stmBoost;
    expect(selection.read()).toEqual({ variantId: VARIANT_IDS.stmBoost, source: 'v2' });

    fake.selectedVariantId = 'retired-variant';
    expect(selection.read()).toEqual({ source: 'invalid' });
  });

  it('stays read-only before the v2 migration', () => {
    const { provider: selection } = provider();
    expect('write' in selection).toBe(false);
  });
});
