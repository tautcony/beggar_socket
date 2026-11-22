/**
 * Legacy-backed selection provider.
 *
 * P1/P2 is read-only: it maps v1 `firmware.profile` (or a v2 `selectedVariantId` once
 * the migration writes one) to a registered variant and never guesses a default.
 */
import type { LegacySettingsAdapter } from './parameters';
import type { DeviceRegistry, SelectionProvider, SelectionSnapshot, VariantId } from './types';

export interface LegacySelectionProviderOptions {
  readonly adapter: LegacySettingsAdapter;
  readonly registry: DeviceRegistry;
  /** v1 `firmware.profile` → registered variant id. */
  readonly legacyProfileVariants: Readonly<Record<string, VariantId>>;
}

export function createLegacySelectionProvider(options: LegacySelectionProviderOptions): SelectionProvider {
  const { adapter, registry, legacyProfileVariants } = options;

  function snapshot(variantId: string | null | undefined, source: 'legacy' | 'v2'): SelectionSnapshot {
    if (!variantId) {
      return { source: 'invalid' };
    }
    const selection = registry.findVariant(variantId);
    return selection ? { variantId: selection.variantId, source } : { source: 'invalid' };
  }

  return {
    read(): SelectionSnapshot {
      const v2VariantId = adapter.readSelectionV2?.();
      if (v2VariantId) {
        return snapshot(v2VariantId, 'v2');
      }
      const legacyProfileId = adapter.readLegacyProfileId();
      // A v1 `stmBoost` flag never selects the Boost variant: Boost is an explicit
      // advanced-settings choice, not an inferred capability.
      return snapshot(legacyProfileVariants[legacyProfileId], 'legacy');
    },
  };
}
