import { describe, expect, it } from 'vitest';

import { VARIANT_IDS } from '@/device';
import { createDeviceRuntime, createRuntimeCompositionRegistry } from '@/device-runtime';

describe('device runtime assembly', () => {
  const runtime = createDeviceRuntime({ platform: 'windows' });

  it('wires the catalog, composition, resolver, store and selection provider', () => {
    expect(runtime.registry.listBindings()).toHaveLength(4);
    expect(runtime.composition.ids()).toHaveLength(2);
    expect(runtime.registry.selectVariant(VARIANT_IDS.gbflash).runtimeBindingId).toBe('gbflash');
    expect(typeof runtime.store.get('beggar.stm', 'romPageSize')).toBe('number');
    expect(['legacy', 'v2', 'invalid']).toContain(runtime.selection.read().source);
    expect(typeof runtime.resolver.resolve).toBe('function');
  });

  it('fails when a binding references an unwired runtime implementation', () => {
    expect(() => createDeviceRuntime({ platform: 'windows', composition: createRuntimeCompositionRegistry() })).toThrow(
      /unresolvable runtimeBindingId/,
    );
  });

  it('resolves a session through the legacy store without importing UI or parameters modules', () => {
    const selection = runtime.registry.selectVariant(VARIANT_IDS.stc);
    const profile = runtime.resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      runtime.store.operationSnapshot(selection.parameterNamespace).values,
    );

    expect(profile.variantId).toBe(VARIANT_IDS.stc);
    expect(profile.capabilities.has('cart.powerControl')).toBe(true);
    expect(profile.capabilities.has('ram.fram.gba')).toBe(false);
    expect(profile.transport.maxReadChunk).toBe(0x8000);
  });
});
