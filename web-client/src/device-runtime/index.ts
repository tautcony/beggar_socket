/**
 * Composition root of the device abstraction.
 *
 * Builds the pure catalog, the runtime bindings, the legacy-backed parameter store and
 * the selection provider, and fails fast when a binding references an unwired runtime.
 */
import { createDeviceCatalog, LEGACY_PROFILE_VARIANT_IDS } from '@/device/definitions';
import { createParameterStore, type ParameterStore } from '@/device/parameters';
import { createLegacySelectionProvider } from '@/device/selection';
import type { DeviceRegistry, SelectionProvider } from '@/device/types';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';
import type { HostPlatform } from '@/types/host-platform';

import { createLegacySettingsAdapter } from './adapters/legacy-settings-adapter';
import type { RuntimeCompositionRegistry } from './composition-registry';
import { createBeggarRuntimeBinding, createFlashgbxRuntimeBinding, createRuntimeComposition } from './runtime-bindings';
import { createSessionResolver, type SessionResolver } from './session-resolver';

export {
  type AdapterContext,
  type AdapterFactory,
  type AnyRuntimeBinding,
  createPendingAdapterFactory,
  createRuntimeCompositionRegistry,
  type ModeSyncStrategy,
  type RuntimeBinding,
  type RuntimeCompositionRegistry,
} from './composition-registry';
export { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
export { createFlashgbxDriver, flashgbxCapabilitySignals, type FlashgbxProbeFacts } from './drivers/flashgbx-driver';
export { createBeggarRuntimeBinding, createFlashgbxRuntimeBinding, createRuntimeComposition } from './runtime-bindings';
export { createSessionResolver, SessionResolutionError, type SessionResolver } from './session-resolver';

export interface DeviceRuntimeOptions {
  /** Defaults to the detected host platform. */
  readonly platform?: HostPlatform;
  /** Defaults to the built-in stub composition; injectable for tests and later drivers. */
  readonly composition?: RuntimeCompositionRegistry;
}

export interface DeviceRuntime {
  readonly registry: DeviceRegistry;
  readonly composition: RuntimeCompositionRegistry;
  readonly resolver: SessionResolver;
  readonly selection: SelectionProvider;
  readonly store: ParameterStore;
}

export function createDeviceRuntime(options: DeviceRuntimeOptions = {}): DeviceRuntime {
  const platform = options.platform ?? detectHostPlatform();
  const registry = createDeviceCatalog({ platform });
  const composition = options.composition ?? createRuntimeComposition();

  for (const binding of registry.listBindings()) {
    if (!composition.has(binding.runtimeBindingId)) {
      throw new Error(
        `DeviceRuntime: variant ${binding.id} references unresolvable runtimeBindingId ${binding.runtimeBindingId}`,
      );
    }
  }

  const adapter = createLegacySettingsAdapter();
  const store = createParameterStore({
    adapter,
    platform,
    schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
  });
  const selection = createLegacySelectionProvider({
    adapter,
    registry,
    legacyProfileVariants: LEGACY_PROFILE_VARIANT_IDS,
  });
  const resolver = createSessionResolver({ platform, composition });

  return { registry, composition, resolver, selection, store };
}
