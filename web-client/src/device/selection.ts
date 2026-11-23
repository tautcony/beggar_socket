/**
 * Selection provider over the persisted v2 record.
 *
 * `selectedVariantId` is the single source of truth. An unregistered (or removed) variant is
 * reported as `invalid` so the connection flow asks the user to pick a device again instead
 * of sending protocol bytes to a guessed default. Boost is never inferred from a probe.
 */
import type { SettingsStorageAdapter } from './parameters';
import type { DeviceRegistry, SelectionProvider, SelectionSnapshot, VariantId } from './types';

export interface SelectionProviderOptions {
  readonly adapter: SettingsStorageAdapter;
  readonly registry: DeviceRegistry;
}

export function createSelectionProvider(options: SelectionProviderOptions): SelectionProvider {
  const { adapter, registry } = options;

  function snapshot(variantId: string | null | undefined): SelectionSnapshot {
    if (!variantId) {
      return { source: 'invalid' };
    }
    const selection = registry.findVariant(variantId);
    return selection ? { variantId: selection.variantId, source: 'v2' } : { source: 'invalid' };
  }

  return {
    read(): SelectionSnapshot {
      return snapshot(adapter.readSelection());
    },
    write(variantId: VariantId): void {
      if (!registry.findVariant(variantId)) {
        throw new Error(`SelectionProvider: variant ${variantId} is not registered`);
      }
      adapter.writeSelection(variantId);
    },
  };
}
