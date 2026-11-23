/**
 * Parameter model and the namespaced store.
 *
 * The store reads schema defaults and the persisted v2 `advanced_settings` record through
 * one adapter, so callers never import parameters UI modules.
 */
import type { HostPlatform } from '@/types/host-platform';

import type { CapabilityKey, CapabilitySet, ResolvedCapabilityStatus } from './capabilities';
import type { DisplayText } from './display';
import type { TransportRequirements } from './hardware';

export interface SizeSettings {
  romPageSize: number;
  romReadPageSize: number;
  ramPageSize: number;
}

export type ParameterValue = number | string | boolean;

export interface ParameterConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly ParameterValue[];
}

export interface ParameterContext {
  readonly namespace: string;
  readonly platform: HostPlatform;
  readonly capabilities: CapabilitySet;
}

export interface ParameterDescriptor {
  readonly key: string;
  readonly kind: 'int' | 'enum' | 'bool' | 'hex';
  readonly default: ParameterValue;
  readonly constraints?: ParameterConstraints;
  readonly label: DisplayText;
  readonly description?: DisplayText;
  readonly group: 'transfer' | 'connection' | 'advanced';
  /** Storage scope: the binding namespace or the global section. */
  readonly scope: 'parameterNamespace' | 'global';
  /** Parameters sharing a link group are kept in sync when independent sizes are off. */
  readonly linkGroup?: string;
  readonly requiresReconnect?: boolean;
  readonly visibleWhen?: (capabilities: CapabilitySet) => boolean;
  readonly validate?: (value: ParameterValue, context: ParameterContext) => string | undefined;
}

export type ParameterSchema = readonly ParameterDescriptor[];

export interface ParameterSchemaContext {
  readonly platform: HostPlatform;
  readonly transport: TransportRequirements;
}

/**
 * Schemas are built per resolve because the same namespace is shared by bindings with
 * different firmware ceilings (STM vs Boost) and because defaults are host derived.
 */
export type ParameterSchemaFactory = (context: ParameterSchemaContext) => ParameterSchema;

export interface OperationSettingsSnapshot {
  readonly namespace: string;
  /** Global parameters are merged first, namespace parameters win on collision. */
  readonly values: Readonly<Record<string, ParameterValue>>;
}

export class ParameterError extends Error {
  readonly namespace: string;
  readonly key: string;
  readonly reason: string;

  constructor(namespace: string, key: string, reason: string) {
    super(`Invalid parameter ${namespace}.${key}: ${reason}`);
    this.name = 'ParameterError';
    this.namespace = namespace;
    this.key = key;
    this.reason = reason;
  }
}

export interface ParameterStore {
  get(namespace: string, key: string): ParameterValue;
  set(namespace: string, key: string, value: ParameterValue): void;
  snapshot(namespace: string): Readonly<Record<string, ParameterValue>>;
  operationSnapshot(namespace: string): OperationSettingsSnapshot;
}

/**
 * Storage bridge over the persisted v2 `advanced_settings` record.
 *
 * Only the store talks to it; the interface never mentions firmware profiles, so the
 * selection is a single variant id and every parameter is addressed by its namespace.
 */
export interface SettingsStorageAdapter {
  /** Persisted `selectedVariantId` (validity is decided by the selection provider). */
  readSelection(): string | null | undefined;
  writeSelection(variantId: string): void;
  readParameter(namespace: string, key: string): unknown;
  writeParameter(namespace: string, key: string, value: ParameterValue): void;
  /**
   * Linked size handling: when enabled, a write to a `linkGroup` parameter is mirrored to
   * every namespace the group covers (STM and STC share `beggar-sizes`).
   */
  readonly linking?: {
    isEnabled(): boolean;
    namespaces(): readonly string[];
  };
}

/** Resolves the schema for a binding namespace; supplied by the device registry. */
export interface ParameterSchemaSource {
  resolve(namespace: string): { readonly schema: ParameterSchema; readonly transport: TransportRequirements } | undefined;
}

export interface ParameterStoreOptions {
  readonly adapter: SettingsStorageAdapter;
  readonly platform: HostPlatform;
  readonly schemas: ParameterSchemaSource;
  readonly globalSchema?: ParameterSchema;
}

/** Global (non namespace) parameters: throttles, retries and timeouts. */
export const GLOBAL_PARAMETER_SCHEMA: ParameterSchema = [
  { key: 'romReadThrottleMs', kind: 'int', default: 0, constraints: { min: 0, max: 1000 }, label: 'ROM read throttle', group: 'advanced', scope: 'global' },
  { key: 'ramReadThrottleMs', kind: 'int', default: 0, constraints: { min: 0, max: 1000 }, label: 'RAM read throttle', group: 'advanced', scope: 'global' },
  { key: 'romReadRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM read retry count', group: 'advanced', scope: 'global' },
  { key: 'ramReadRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'RAM read retry count', group: 'advanced', scope: 'global' },
  { key: 'romReadRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM read retry delay', group: 'advanced', scope: 'global' },
  { key: 'ramReadRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'RAM read retry delay', group: 'advanced', scope: 'global' },
  { key: 'romEraseRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM erase retry count', group: 'advanced', scope: 'global' },
  { key: 'romEraseRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM erase retry delay', group: 'advanced', scope: 'global' },
  { key: 'romWriteRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM write retry count', group: 'advanced', scope: 'global' },
  { key: 'romWriteRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM write retry delay', group: 'advanced', scope: 'global' },
  { key: 'defaultTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Default timeout', group: 'advanced', scope: 'global' },
  { key: 'packageSendTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Package send timeout', group: 'advanced', scope: 'global' },
  { key: 'packageReceiveTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Package receive timeout', group: 'advanced', scope: 'global' },
  { key: 'operationTimeout', kind: 'int', default: 30000, constraints: { min: 1000, max: 300000 }, label: 'Operation timeout', group: 'advanced', scope: 'global' },
];

export function findParameterDescriptor(
  schema: ParameterSchema,
  key: string,
): ParameterDescriptor | undefined {
  return schema.find(descriptor => descriptor.key === key);
}

function coerceValue(descriptor: ParameterDescriptor, value: unknown): ParameterValue {
  switch (descriptor.kind) {
    case 'int':
    case 'hex':
      return typeof value === 'number' ? Math.trunc(value) : Number(value);
    case 'bool':
      return typeof value === 'boolean' ? value : Boolean(value);
    case 'enum':
      return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
        ? value
        : descriptor.default;
  }
}

/** Validates a value against a descriptor; throws `ParameterError` on failure. */
export function assertValidParameter(
  descriptor: ParameterDescriptor,
  value: ParameterValue,
  context: ParameterContext,
): ParameterValue {
  const { constraints } = descriptor;
  if (constraints?.options && !constraints.options.includes(value)) {
    throw new ParameterError(context.namespace, descriptor.key, `expected one of ${constraints.options.join(', ')}`);
  }
  if (typeof value === 'number') {
    if (constraints?.min !== undefined && value < constraints.min) {
      throw new ParameterError(context.namespace, descriptor.key, `below minimum ${constraints.min}`);
    }
    if (constraints?.max !== undefined && value > constraints.max) {
      throw new ParameterError(context.namespace, descriptor.key, `above maximum ${constraints.max}`);
    }
    if (constraints?.step !== undefined && value % constraints.step !== 0) {
      throw new ParameterError(context.namespace, descriptor.key, `not a multiple of ${constraints.step}`);
    }
  }
  const matchesOption = constraints?.options?.includes(value) ?? false;
  if (!matchesOption && typeof value !== typeof descriptor.default) {
    throw new ParameterError(context.namespace, descriptor.key, `expected ${typeof descriptor.default}`);
  }
  const custom = descriptor.validate?.(value, context);
  if (custom) {
    throw new ParameterError(context.namespace, descriptor.key, custom);
  }
  return value;
}

const EMPTY_CAPABILITIES = new Map<CapabilityKey, ResolvedCapabilityStatus>();

function clampToDescriptor(descriptor: ParameterDescriptor, value: ParameterValue): ParameterValue {
  if (typeof value !== 'number') {
    return value;
  }
  const min = descriptor.constraints?.min;
  const max = descriptor.constraints?.max;
  let next = value;
  if (min !== undefined && next < min) {
    next = min;
  }
  if (max !== undefined && next > max) {
    next = max;
  }
  return next;
}

function contextFor(namespace: string, platform: HostPlatform): ParameterContext {
  return {
    namespace,
    platform,
    capabilities: {
      has: () => false,
      explain: () => undefined,
      all: () => EMPTY_CAPABILITIES,
    },
  };
}

export function createParameterStore(options: ParameterStoreOptions): ParameterStore {
  const { adapter, platform, schemas } = options;
  const globalSchema = options.globalSchema ?? GLOBAL_PARAMETER_SCHEMA;

  function resolveNamespace(namespace: string): ParameterSchema {
    const resolved = schemas.resolve(namespace);
    if (!resolved) {
      throw new ParameterError(namespace, '*', 'namespace is not registered');
    }
    return resolved.schema;
  }

  /**
   * Reads one value, clamped into the descriptor range.
   *
   * The schema is the only authority on what a namespace accepts, but storage can hold a
   * value another build (or the v1 migration) considered legal — e.g. a legacy STM read
   * page of `0x4000` against the shared STM/Boost ceiling of `0x2000`. Serving it as-is
   * would make the value both unusable at runtime and impossible to re-apply, because the
   * settings form validates every namespace at once. Clamping keeps "stored" and "usable"
   * the same value.
   */
  function readValue(descriptor: ParameterDescriptor, namespace: string): ParameterValue {
    const stored = descriptor.scope === 'global'
      ? adapter.readParameter('global', descriptor.key)
      : adapter.readParameter(namespace, descriptor.key);
    if (stored === undefined || stored === null) {
      return descriptor.default;
    }
    const coerced = coerceValue(descriptor, stored);
    return typeof coerced === 'number' ? clampToDescriptor(descriptor, coerced) : coerced;
  }

  function collect(schema: ParameterSchema, namespace: string): Record<string, ParameterValue> {
    const values: Record<string, ParameterValue> = {};
    for (const descriptor of schema) {
      values[descriptor.key] = readValue(descriptor, namespace);
    }
    return values;
  }

  /**
   * Mirrors a linked size parameter (e.g. `beggar-sizes`) into the other namespaces of the
   * group while sizes are not independent. The sibling ceiling applies, so an STC read
   * setting never leaves an illegal value in the smaller STM namespace.
   */
  function syncLinkGroup(
    namespace: string,
    descriptor: ParameterDescriptor,
    value: ParameterValue,
  ): void {
    const linking = adapter.linking;
    if (!descriptor.linkGroup || !linking?.isEnabled()) {
      return;
    }
    for (const sibling of linking.namespaces()) {
      if (sibling === namespace || sibling === 'global') {
        continue;
      }
      const siblingSchema = schemas.resolve(sibling)?.schema;
      const siblingDescriptor = siblingSchema
        ? findParameterDescriptor(siblingSchema, descriptor.key)
        : undefined;
      if (siblingDescriptor?.linkGroup !== descriptor.linkGroup) {
        continue;
      }
      adapter.writeParameter(sibling, descriptor.key, clampToDescriptor(siblingDescriptor, value));
    }
  }

  return {
    get(namespace: string, key: string): ParameterValue {
      const descriptor = findParameterDescriptor(resolveNamespace(namespace), key)
        ?? findParameterDescriptor(globalSchema, key);
      if (!descriptor) {
        throw new ParameterError(namespace, key, 'unknown parameter');
      }
      return readValue(descriptor, namespace);
    },
    set(namespace: string, key: string, value: ParameterValue): void {
      const descriptor = findParameterDescriptor(resolveNamespace(namespace), key)
        ?? findParameterDescriptor(globalSchema, key);
      if (!descriptor) {
        throw new ParameterError(namespace, key, 'unknown parameter');
      }
      const validated = assertValidParameter(descriptor, value, contextFor(namespace, platform));
      adapter.writeParameter(descriptor.scope === 'global' ? 'global' : namespace, key, validated);
      if (descriptor.scope !== 'global') {
        syncLinkGroup(namespace, descriptor, validated);
      }
    },
    snapshot(namespace: string): Readonly<Record<string, ParameterValue>> {
      return collect(resolveNamespace(namespace), namespace);
    },
    operationSnapshot(namespace: string): OperationSettingsSnapshot {
      const values = {
        ...collect(globalSchema, namespace),
        ...collect(resolveNamespace(namespace), namespace),
      };
      return { namespace, values };
    },
  };
}
