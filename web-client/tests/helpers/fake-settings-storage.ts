/**
 * In-memory settings storage adapter for device layer tests.
 *
 * Mirrors the persisted v2 record: namespace parameters, global parameters, the single
 * `selectedVariantId` and the linked size flag.
 */
import type { ParameterValue, SettingsStorageAdapter } from '@/device/parameters';

export interface FakeSettingsStorage {
  adapter: SettingsStorageAdapter;
  /** Namespaced / global values read by the adapter, keyed `${namespace}.${key}`. */
  values: Map<string, ParameterValue>;
  selectedVariantId: string | null;
  independentSizes: boolean;
  linkableNamespaces: string[];
  writes: { namespace: string; key: string; value: ParameterValue }[];
}

function key(namespace: string, name: string): string {
  return `${namespace}.${name}`;
}

export function createFakeSettingsStorage(
  options: {
    selectedVariantId?: string | null;
    independentSizes?: boolean;
    linkableNamespaces?: string[];
  } = {},
): FakeSettingsStorage {
  const fake: FakeSettingsStorage = {
    values: new Map<string, ParameterValue>(),
    selectedVariantId: options.selectedVariantId ?? null,
    independentSizes: options.independentSizes ?? false,
    linkableNamespaces: options.linkableNamespaces ?? ['beggar.stm', 'beggar.stc', 'flashgbx.cfw'],
    writes: [],
    adapter: undefined as unknown as SettingsStorageAdapter,
  };

  fake.adapter = {
    readSelection: () => fake.selectedVariantId,
    writeSelection(variantId: string): void {
      fake.selectedVariantId = variantId;
    },
    readParameter(namespace: string, name: string): unknown {
      return fake.values.get(key(namespace, name));
    },
    writeParameter(namespace: string, name: string, value: ParameterValue): void {
      fake.writes.push({ namespace, key: name, value });
      fake.values.set(key(namespace, name), value);
    },
    linking: {
      isEnabled: () => !fake.independentSizes,
      namespaces: () => fake.linkableNamespaces,
    },
  };

  return fake;
}
