/**
 * Composition root of the device abstraction.
 *
 * Builds the pure catalog, the runtime bindings, the legacy-backed parameter store, the
 * selection provider and the session establishment transaction, and fails fast when a
 * binding references an unwired runtime.
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
import { createSessionEstablishment, type SessionEstablishment } from './session-establishment';
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
export {
  createBeggarAdapterFactory,
  createFlashgbxAdapterFactory,
  flashgbxModeSync,
} from './adapters/adapter-factory';
export {
  createDiagnostic,
  diagnosticToString,
  isSessionStageError,
  SessionStageError,
  type SessionFailureStage,
  type SessionStageErrorOptions,
} from './diagnostics';
export { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
export { createFlashgbxDriver, flashgbxCapabilitySignals, type FlashgbxProbeFacts } from './drivers/flashgbx-driver';
export { createBeggarRuntimeBinding, createFlashgbxRuntimeBinding, createRuntimeComposition } from './runtime-bindings';
export {
  createSessionEstablishment,
  type EstablishedSession,
  type EstablishSessionInput,
  type SessionEstablishment,
} from './session-establishment';
export { createSessionResolver, SessionResolutionError, type SessionResolver } from './session-resolver';
export { asPlatformTransport } from './session-transport';

export interface DeviceRuntimeOptions {
  /** Defaults to the detected host platform. */
  readonly platform?: HostPlatform;
  /** Defaults to the real runtime composition; injectable for tests. */
  readonly composition?: RuntimeCompositionRegistry;
}

export interface DeviceRuntime {
  readonly registry: DeviceRegistry;
  readonly composition: RuntimeCompositionRegistry;
  readonly resolver: SessionResolver;
  readonly selection: SelectionProvider;
  readonly store: ParameterStore;
  readonly establishment: SessionEstablishment;
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
  const establishment = createSessionEstablishment({ selection, registry, store, resolver, composition });

  return { registry, composition, resolver, selection, store, establishment };
}
