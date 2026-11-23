/**
 * Settings storage adapter: the only place the core device layer touches `advanced_settings`.
 *
 * It reads and writes the v2 record (namespace parameters, global parameters and the single
 * `selectedVariantId`). No firmware profile ids, Boost flags or baud rate aliases survive
 * here: every value is addressed by namespace and key.
 */
import type { ParameterValue, SettingsStorageAdapter } from '@/device/parameters';
import {
  advancedSettingsStorage,
  PARAMETER_NAMESPACES,
} from '@/settings/advanced-settings-v2';

export interface SettingsStorageAdapterOptions {
  /** Namespaces that participate in linked size syncing (STM + STC). */
  readonly linkableNamespaces?: readonly string[];
}

export function createSettingsStorageAdapter(
  options: SettingsStorageAdapterOptions = {},
): SettingsStorageAdapter {
  const linkableNamespaces = options.linkableNamespaces ?? PARAMETER_NAMESPACES;

  return {
    readSelection(): string | null {
      return advancedSettingsStorage.selectedVariantId;
    },

    writeSelection(variantId: string): void {
      advancedSettingsStorage.setSelectedVariant(variantId);
    },

    readParameter(namespace: string, key: string): unknown {
      return advancedSettingsStorage.readParameter(namespace, key);
    },

    writeParameter(namespace: string, key: string, value: ParameterValue): void {
      advancedSettingsStorage.writeParameter(namespace, key, value);
    },

    linking: {
      isEnabled: () => !advancedSettingsStorage.independentSizes,
      namespaces: () => linkableNamespaces,
    },
  };
}
