/**
 * Parameter model and the namespaced store.
 *
 * The store reads schema defaults and the persisted v2 `advanced_settings` record through
 * one adapter, so callers never import parameters UI modules.
 */
import type { HostPlatform } from '@/types/host-platform';
import { floorPowerOfTwo } from '@/utils/transfer-plan';

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
  /**
   * Byte alignment an `int` value must satisfy. The form, the store and the compatibility
   * accessors all read it, so the rule is declared once instead of hard-coded in the UI.
   */
  readonly alignment?: number;
  /**
   * Normalization applied by every write path (store, migration, compatibility accessor),
   * so "stored" and "usable" stay the same value.
   */
  readonly normalize?: (value: number) => number;
  /** Coarse grouping of global parameters used by the settings form sections. */
  readonly section?: 'throttle' | 'retry' | 'timeout';
  /** Unit rendered next to the value in the settings form. */
  readonly unit?: 'ms' | 'count';
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

/**
 * Global (non namespace) parameters: throttles, retries and timeouts.
 *
 * `section`/`unit` describe how the settings form groups and annotates a parameter, so the
 * form no longer keeps its own copy of the ranges, units and field names: the descriptor is
 * the only place a bound or a unit is declared.
 */
export const GLOBAL_PARAMETER_SCHEMA: ParameterSchema = [
  { key: 'romReadThrottleMs', kind: 'int', default: 0, constraints: { min: 0, max: 1000 }, label: 'ROM read throttle', group: 'advanced', scope: 'global', section: 'throttle', unit: 'ms' },
  { key: 'ramReadThrottleMs', kind: 'int', default: 0, constraints: { min: 0, max: 1000 }, label: 'RAM read throttle', group: 'advanced', scope: 'global', section: 'throttle', unit: 'ms' },
  { key: 'romReadRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM read retry count', group: 'advanced', scope: 'global', section: 'retry', unit: 'count' },
  { key: 'ramReadRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'RAM read retry count', group: 'advanced', scope: 'global', section: 'retry', unit: 'count' },
  { key: 'romReadRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM read retry delay', group: 'advanced', scope: 'global', section: 'retry', unit: 'ms' },
  { key: 'ramReadRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'RAM read retry delay', group: 'advanced', scope: 'global', section: 'retry', unit: 'ms' },
  { key: 'romEraseRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM erase retry count', group: 'advanced', scope: 'global', section: 'retry', unit: 'count' },
  { key: 'romEraseRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM erase retry delay', group: 'advanced', scope: 'global', section: 'retry', unit: 'ms' },
  { key: 'romWriteRetryCount', kind: 'int', default: 1, constraints: { min: 0, max: 10 }, label: 'ROM write retry count', group: 'advanced', scope: 'global', section: 'retry', unit: 'count' },
  { key: 'romWriteRetryDelayMs', kind: 'int', default: 0, constraints: { min: 0, max: 5000 }, label: 'ROM write retry delay', group: 'advanced', scope: 'global', section: 'retry', unit: 'ms' },
  { key: 'defaultTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Default timeout', group: 'advanced', scope: 'global', section: 'timeout', unit: 'ms' },
  { key: 'packageSendTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Package send timeout', group: 'advanced', scope: 'global', section: 'timeout', unit: 'ms' },
  { key: 'packageReceiveTimeout', kind: 'int', default: 3000, constraints: { min: 1000, max: 300000 }, label: 'Package receive timeout', group: 'advanced', scope: 'global', section: 'timeout', unit: 'ms' },
  { key: 'operationTimeout', kind: 'int', default: 30000, constraints: { min: 1000, max: 300000 }, label: 'Operation timeout', group: 'advanced', scope: 'global', section: 'timeout', unit: 'ms' },
];

export function findParameterDescriptor(
  schema: ParameterSchema,
  key: string,
): ParameterDescriptor | undefined {
  return schema.find(descriptor => descriptor.key === key);
}

function coerceValue(descriptor: ParameterDescriptor, value: unknown): ParameterValue | undefined {
  switch (descriptor.kind) {
    case 'int':
    case 'hex': {
      if (typeof value === 'number') {
        return Math.trunc(value);
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
      }
      return undefined;
    }
    case 'bool': {
      if (typeof value === 'boolean') {
        return value;
      }
      if (value === 0 || value === 1) {
        return value === 1;
      }
      return undefined;
    }
    case 'enum':
      // Enums are validated by their option list, never coerced.
      return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
        ? value
        : undefined;
  }
}

/**
 * Legal step of a page size: a power of two, except the platform's 3 KiB (0x0c00) step.
 *
 * Shared by the parameter schema, the v1 migration and the compatibility accessors so one
 * value cannot be legal in one path and silently rewritten in another.
 */
export function normalizePageSize(value: number, minimum = 0x40): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  const floored = Math.floor(value);
  if (floored === 0x0c00) {
    return floored;
  }
  return Math.max(floorPowerOfTwo(floored, minimum), minimum);
}

/** Clamps into the descriptor range and applies its declared normalization. */
export function normalizeNumber(descriptor: ParameterDescriptor, value: number): number {
  const { min, max } = descriptor.constraints ?? {};
  let next = Math.trunc(value);
  if (min !== undefined && next < min) {
    next = min;
  }
  if (max !== undefined && next > max) {
    next = max;
  }
  if (descriptor.normalize) {
    next = descriptor.normalize(next);
  }
  const alignment = descriptor.alignment;
  if (alignment && alignment > 1 && next % alignment !== 0) {
    const aligned = Math.floor(next / alignment) * alignment;
    next = min !== undefined && aligned < min ? min : aligned;
  }
  return next;
}

/**
 * Normalizes one stored value against its descriptor.
 *
 * `undefined` means "this value cannot be served": the caller substitutes the descriptor
 * default. That is the only way a persisted `baudRate: 123456` or `"bogus"` cannot leak
 * into a connection plan or an un-fixable form field.
 */
export function normalizeStoredValue(
  descriptor: ParameterDescriptor,
  stored: unknown,
): ParameterValue | undefined {
  const coerced = coerceValue(descriptor, stored);
  if (coerced === undefined) {
    return undefined;
  }
  if (descriptor.kind === 'enum') {
    const options = descriptor.constraints?.options;
    return options && !options.includes(coerced) ? undefined : coerced;
  }
  if (typeof coerced !== 'number') {
    return coerced;
  }
  if (!Number.isFinite(coerced)) {
    return undefined;
  }
  return normalizeNumber(descriptor, coerced);
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
    if (descriptor.alignment && descriptor.alignment > 1 && value % descriptor.alignment !== 0) {
      throw new ParameterError(context.namespace, descriptor.key, `not aligned to ${descriptor.alignment} bytes`);
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

/** Validation context for callers that have no live session capability set. */
export function createParameterContext(namespace: string, platform: HostPlatform): ParameterContext {
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

/**
 * Non-throwing variant of `assertValidParameter`: the reason is returned instead.
 *
 * The settings form, the migration and the compatibility facade all report the same verdict,
 * so a value cannot be rejected by one and accepted by another.
 */
export function validateParameter(
  descriptor: ParameterDescriptor,
  value: ParameterValue,
  context: ParameterContext,
): string | undefined {
  try {
    assertValidParameter(descriptor, value, context);
    return undefined;
  } catch (error) {
    return error instanceof ParameterError ? error.reason : String(error);
  }
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
    // Read through the descriptor: an out-of-range number is clamped, an unusable value
    // (wrong type, unknown enum option) falls back to the default instead of reaching a
    // connection plan or the settings form.
    return normalizeStoredValue(descriptor, stored) ?? descriptor.default;
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
      adapter.writeParameter(sibling, descriptor.key, normalizeNumber(siblingDescriptor, Number(value)));
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
      const validated = assertValidParameter(descriptor, value, createParameterContext(namespace, platform));
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
