/**
 * Composition root of the device abstraction.
 *
 * Builds the pure catalog, the runtime bindings, the namespaced parameter store, the
 * selection provider and the session establishment transaction, and fails fast when a
 * binding references an unwired runtime.
 */
import { createDeviceCatalog } from '@/device/definitions';
import { createParameterStore, type ParameterStore } from '@/device/parameters';
import { createSelectionProvider } from '@/device/selection';
import type { DeviceRegistry, SelectionProvider } from '@/device/types';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';
import type { HostPlatform } from '@/types/host-platform';

import { createSettingsStorageAdapter } from './adapters/settings-storage-adapter';
import type { RuntimeCompositionRegistry } from './composition-registry';
import { createBeggarRuntimeBinding, createGbflashRuntimeBinding, createRuntimeComposition } from './runtime-bindings';
import { createSessionEstablishment, type SessionEstablishment } from './session-establishment';
import { createSessionResolver, type SessionResolver } from './session-resolver';

export {
  createBeggarAdapterFactory,
  createGbflashAdapterFactory,
  gbflashModeSync,
} from './adapters/adapter-factory';
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
  type ConnectionPlanDeps,
  planConnection,
  requireVariant,
  selectionFailure,
} from './connection-plan';
export {
  createDiagnostic,
  diagnosticToString,
  isSessionStageError,
  type SessionFailureStage,
  SessionStageError,
  type SessionStageErrorOptions,
} from './diagnostics';
export { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
export { createGbflashDriver, gbflashCapabilitySignals, type GbflashProbeFacts } from './drivers/gbflash-driver';
export { createBeggarRuntimeBinding, createGbflashRuntimeBinding, createRuntimeComposition } from './runtime-bindings';
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

  // STM and STC share the `beggar-sizes` link group; GBFlash never joins it.
  const linkableNamespaces = [...new Set(registry.listBindings().map(binding => binding.parameterNamespace))];
  const adapter = createSettingsStorageAdapter({ linkableNamespaces });
  const store = createParameterStore({
    adapter,
    platform,
    schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
  });
  const selection = createSelectionProvider({ adapter, registry });
  const resolver = createSessionResolver({ platform, composition });
  const establishment = createSessionEstablishment({ selection, registry, store, resolver, composition });

  return { registry, composition, resolver, selection, store, establishment };
}
