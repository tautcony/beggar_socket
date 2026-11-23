/**
 * Runtime composition registry: the only place that maps a `runtimeBindingId` to the
 * concrete driver, display contributor, adapter factory and mode-sync strategy.
 *
 * `RuntimeBinding<TFacts>` closes the facts type at the definition site, so a FlashGBX
 * contributor cannot be combined with Beggar probe facts.
 */
import type { CapabilitySignals } from '@/device/capabilities';
import type { ParameterStore } from '@/device/parameters';
import type { DisplayContributor, ProtocolDriver, SessionProfile } from '@/device/session';
import type { PlatformId, RuntimeBindingId } from '@/device/types';
import type { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import type { DeviceInfo } from '@/types/device-info';

export interface AdapterContext {
  readonly device: DeviceInfo;
  readonly profile: SessionProfile;
  readonly log: LogCallback;
  readonly updateProgress: ProgressCallback;
  readonly t: TranslateFunction;
  /** Parameter store of the session; adapters read operation snapshots from it. */
  readonly store?: ParameterStore;
}

export interface AdapterFactory {
  create(platform: PlatformId, context: AdapterContext): CartridgeAdapter;
  syncMode?(adapter: CartridgeAdapter, mode: PlatformId): Promise<void>;
}

export type ModeSyncStrategy = (adapter: CartridgeAdapter, mode: PlatformId) => Promise<void>;

export interface RuntimeBinding<TFacts> {
  readonly driver: ProtocolDriver<TFacts>;
  readonly displayContributor: DisplayContributor<TFacts>;
  readonly adapterFactory: AdapterFactory;
  readonly modeSyncStrategy?: ModeSyncStrategy;
  /**
   * Normalizes typed probe facts into the signals evaluated by conditional capability
   * rules. Optional: without it conditional capabilities stay unsupported.
   */
  readonly capabilitySignals?: (facts: TFacts) => CapabilitySignals;
}

/** Storage slot type only; `resolve` is the single assertion point of the project. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRuntimeBinding = RuntimeBinding<any>;

export interface RuntimeCompositionRegistry {
  register(id: RuntimeBindingId, binding: AnyRuntimeBinding): void;
  resolve<TFacts>(id: RuntimeBindingId): RuntimeBinding<TFacts>;
  has(id: RuntimeBindingId): boolean;
  ids(): readonly RuntimeBindingId[];
}

export function createRuntimeCompositionRegistry(): RuntimeCompositionRegistry {
  const bindings = new Map<string, AnyRuntimeBinding>();
  return {
    register(id, binding) {
      if (bindings.has(id)) {
        throw new Error(`RuntimeCompositionRegistry: duplicate runtime binding ${id}`);
      }
      bindings.set(id, binding);
    },
    resolve<TFacts>(id: RuntimeBindingId): RuntimeBinding<TFacts> {
      const binding = bindings.get(id);
      if (!binding) {
        throw new Error(`RuntimeCompositionRegistry: runtime binding ${id} is not registered`);
      }
      return binding as RuntimeBinding<TFacts>;
    },
    has: (id) => bindings.has(id),
    ids: () => [...bindings.keys()] as RuntimeBindingId[],
  };
}

/**
 * P0 skeleton: adapter construction arrives with `refactor-device-lifecycle-drivers`.
 * Failing loudly keeps callers from silently using a wrong adapter family.
 */
export function createPendingAdapterFactory(runtimeBindingId: RuntimeBindingId): AdapterFactory {
  return {
    create(): CartridgeAdapter {
      throw new Error(`AdapterFactory for ${runtimeBindingId} is delivered by refactor-device-lifecycle-drivers`);
    },
  };
}
