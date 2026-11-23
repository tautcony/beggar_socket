import { describe, expect, it } from 'vitest';

import {
  createDeviceCatalog,
  createParameterStore,
  createSelectionProvider,
  ParameterError,
  type SettingsStorageAdapter,
  VARIANT_IDS,
} from '@/device';

import { createFakeSettingsStorage } from '../helpers/fake-settings-storage';

function emptyAdapter(selectedVariantId: string | null = null): SettingsStorageAdapter {
  const fake = createFakeSettingsStorage({ selectedVariantId });
  return fake.adapter;
}

function storeFor(fake = createFakeSettingsStorage()) {
  const registry = createDeviceCatalog({ platform: 'windows' });
  const store = createParameterStore({
    adapter: fake.adapter,
    platform: 'windows',
    schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
  });
  return { registry, store, fake };
}

describe('namespaced parameter store', () => {
  it('uses host derived schema defaults when nothing is stored', () => {
    const { store } = storeFor();

    expect(store.get('beggar.stm', 'romPageSize')).toBe(0x1000);
    expect(store.get('beggar.stm', 'romReadPageSize')).toBe(0x1000);
    expect(store.get('beggar.stc', 'romReadPageSize')).toBe(0x2000);
    expect(store.get('flashgbx.cfw', 'romPageSize')).toBe(0x100);
    expect(store.get('flashgbx.cfw', 'baudRate')).toBe('auto');
    expect(store.get('beggar.stm', 'defaultTimeout')).toBe(3000);
  });

  it('declares the GBFlash editable packet ceiling at 0x2000', () => {
    const { registry } = storeFor();
    const flashgbx = registry.resolveNamespaceSchema('flashgbx.cfw')?.schema ?? [];

    const romPage = flashgbx.find(descriptor => descriptor.key === 'romPageSize');
    const romRead = flashgbx.find(descriptor => descriptor.key === 'romReadPageSize');
    expect(romPage?.constraints?.max).toBe(0x2000);
    expect(romPage?.default).toBe(0x100);
    expect(romRead?.constraints?.max).toBe(0x2000);
  });

  it('reads persisted values from the v2 record through the single adapter', () => {
    const fake = createFakeSettingsStorage({ selectedVariantId: VARIANT_IDS.gbflash });
    fake.values.set('beggar.stm.romPageSize', 0x800);
    fake.values.set('flashgbx.cfw.baudRate', 1_500_000);
    fake.values.set('global.romReadThrottleMs', 12);

    const { store } = storeFor(fake);

    expect(store.get('beggar.stm', 'romPageSize')).toBe(0x800);
    expect(store.get('flashgbx.cfw', 'baudRate')).toBe(1_500_000);
    expect(store.get('beggar.stm', 'romReadThrottleMs')).toBe(12);
  });

  it('writes global parameters into the global scope only', () => {
    const { store, fake } = storeFor();

    store.set('beggar.stc', 'operationTimeout', 45_000);
    expect(fake.writes).toEqual([{ namespace: 'global', key: 'operationTimeout', value: 45_000 }]);
    expect(store.get('flashgbx.cfw', 'operationTimeout')).toBe(45_000);
  });

  it('validates a write and reports the namespace and key on failure', () => {
    const { store, fake } = storeFor(createFakeSettingsStorage({ independentSizes: true }));

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

  it('mirrors linked Beggar sizes while sizes are not independent, and stops when they are', () => {
    const linked = storeFor();
    linked.store.set('beggar.stm', 'romReadPageSize', 0x2000);
    // STM and STC share `beggar-sizes`.
    expect(linked.store.get('beggar.stc', 'romReadPageSize')).toBe(0x2000);
    expect(linked.fake.writes.map(write => write.namespace)).toEqual(['beggar.stm', 'beggar.stc']);

    const independent = createFakeSettingsStorage({ independentSizes: true });
    const { store } = storeFor(independent);
    store.set('beggar.stm', 'romReadPageSize', 0x2000);
    store.set('beggar.stc', 'romReadPageSize', 0x1000);
    expect(store.get('beggar.stm', 'romReadPageSize')).toBe(0x2000);
    expect(store.get('beggar.stc', 'romReadPageSize')).toBe(0x1000);
  });

  it('never mirrors a linked size into the independent GBFlash namespace', () => {
    const { store } = storeFor();
    store.set('beggar.stm', 'romReadPageSize', 0x2000);
    expect(store.get('flashgbx.cfw', 'romReadPageSize')).toBe(0x100);
  });

  it('shares one namespace between standard STM and Boost', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });
    expect(registry.selectVariant(VARIANT_IDS.stm).parameterNamespace)
      .toBe(registry.selectVariant(VARIANT_IDS.stmBoost).parameterNamespace);

    const { store } = storeFor();
    store.set('beggar.stm', 'romPageSize', 0x800);
    expect(store.get('beggar.stm', 'romPageSize')).toBe(0x800);
  });

  it('stamps an operation snapshot with global values plus namespaced values', () => {
    const fake = createFakeSettingsStorage();
    fake.values.set('global.operationTimeout', 45_000);
    const { store } = storeFor(fake);

    const snapshot = store.operationSnapshot('beggar.stc');
    expect(snapshot.namespace).toBe('beggar.stc');
    expect(snapshot.values.operationTimeout).toBe(45_000);
    expect(snapshot.values.romReadPageSize).toBe(0x2000);
    expect(snapshot.values.baudRate).toBeUndefined();
  });

  it('re-reads settings for every operation so changes apply to the next operation only', () => {
    const { store, fake } = storeFor();

    const first = store.operationSnapshot('beggar.stm');
    fake.values.set('beggar.stm.romPageSize', 0x800);
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

describe('selection provider', () => {
  const registry = createDeviceCatalog({ platform: 'windows' });

  function provider(selectedVariantId: string | null = null) {
    const fake = createFakeSettingsStorage({ selectedVariantId });
    return {
      fake,
      provider: createSelectionProvider({ adapter: fake.adapter, registry }),
    };
  }

  it.each([VARIANT_IDS.stm, VARIANT_IDS.stmBoost, VARIANT_IDS.stc, VARIANT_IDS.gbflash])(
    'reads the persisted variant %s',
    (variantId) => {
      const { provider: selection } = provider(variantId);
      expect(selection.read()).toEqual({ variantId, source: 'v2' });
    },
  );

  it('reports an invalid selection without falling back to a default', () => {
    const { provider: selection } = provider('retired-variant');
    expect(selection.read()).toEqual({ source: 'invalid' });
    expect(selection.read().variantId).toBeUndefined();

    const empty = provider(null);
    expect(empty.provider.read()).toEqual({ source: 'invalid' });
  });

  it('writes only registered variants', () => {
    const { fake, provider: selection } = provider();
    selection.write?.(VARIANT_IDS.stmBoost);
    expect(fake.selectedVariantId).toBe(VARIANT_IDS.stmBoost);

    expect(() => selection.write?.('retired-variant')).toThrow(/not registered/);
  });
});
