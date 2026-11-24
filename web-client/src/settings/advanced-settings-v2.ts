/**
 * v2 advanced settings storage.
 *
 * One record holds the persisted selection (`selectedVariantId`), the firmware parameter
 * namespaces, the global operation parameters and the STM/STC linking state. The layout is
 * the single source of truth for both the `ParameterStore` adapter and the compatibility
 * facade in `advanced-settings.ts`.
 *
 * Migration is one way: an unversioned v1 record is normalized into v2, the raw v1 JSON is
 * copied to `advanced_settings_v1_backup` (best effort) and v2 is written back. Unknown
 * versions and malformed JSON stay in memory only, so the source record is never
 * overwritten with defaults.
 */
import {
  BEGGAR_STC_BINDING,
  BEGGAR_STM_BINDING,
  createDeviceCatalog,
  GBFLASH_BINDING,
  LEGACY_PROFILE_VARIANT_IDS,
} from '@/device/definitions';
import {
  findParameterDescriptor,
  GLOBAL_PARAMETER_SCHEMA,
  normalizeStoredValue,
  type ParameterSchema,
} from '@/device/parameters';
import type { DeviceFirmwareBinding, DeviceRegistry } from '@/device/types';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';
import type { HostPlatform } from '@/types/host-platform';

/** Value shapes the storage can hold (structurally identical to `ParameterValue`). */
export type StoredValue = number | string | boolean;

export const ADVANCED_SETTINGS_STORAGE_KEY = 'advanced_settings';
export const LEGACY_SETTINGS_BACKUP_KEY = 'advanced_settings_v1_backup';
export const ADVANCED_SETTINGS_VERSION = 2;

export interface SizeSettings {
  romPageSize: number;
  romReadPageSize: number;
  ramPageSize: number;
}

export type ParameterBag = Record<string, StoredValue>;

export interface AdvancedSettingsV2 {
  version: typeof ADVANCED_SETTINGS_VERSION;
  selectedVariantId: string | null;
  parametersByNamespace: Record<string, ParameterBag>;
  global: ParameterBag;
  /** When false, namespaces sharing a `linkGroup` are kept in sync. */
  independentSizes: boolean;
}

export type SettingsLoadOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'migrated'; readonly from: 'unversioned' | 'v1' }
  | { readonly kind: 'unsupported'; readonly version: unknown }
  | { readonly kind: 'malformed' };

// --- layout of the registered bindings ---

const BINDINGS: readonly DeviceFirmwareBinding[] = [BEGGAR_STM_BINDING, BEGGAR_STC_BINDING, GBFLASH_BINDING];

/** variant id → parameter namespace, derived from the registered bindings. */
export const NAMESPACE_BY_VARIANT: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(BINDINGS.map(binding => [binding.id, binding.parameterNamespace])),
);

const BINDING_BY_NAMESPACE: Readonly<Record<string, DeviceFirmwareBinding>> = Object.freeze(
  Object.fromEntries(BINDINGS.map(binding => [binding.parameterNamespace, binding])),
);

/** Binding that owns a namespace, if any. */
export function bindingForNamespace(namespace: string): DeviceFirmwareBinding | undefined {
  return BINDING_BY_NAMESPACE[namespace];
}

/** Every namespace a v2 record can hold, in a stable order. */
export const PARAMETER_NAMESPACES: readonly string[] = Object.freeze(
  [...new Set(BINDINGS.map(binding => binding.parameterNamespace))],
);

/** v1 `firmware.profile` → v2 `selectedVariantId` (Boost is never inferred). */
export const LEGACY_PROFILE_VARIANTS: Readonly<Record<string, string>> = LEGACY_PROFILE_VARIANT_IDS;

const DEFAULT_VARIANT_NAMESPACE = BEGGAR_STM_BINDING.parameterNamespace;

const SIZE_KEYS = ['romPageSize', 'romReadPageSize', 'ramPageSize'] as const;

/**
 * Catalogs used to resolve a namespace schema, one per host platform.
 *
 * Storage normalization has to ask the same catalog the runtime asks, otherwise a value can be
 * legal for the persisted record and illegal for the session (or the other way round). The
 * per-platform map matters because packet ceilings are host derived and the platform can be
 * re-detected at runtime (tests and the Tauri/Web switch both do it).
 */
const catalogs = new Map<HostPlatform, DeviceRegistry>();

function deviceCatalog(): DeviceRegistry {
  const platform = detectHostPlatform();
  let catalog = catalogs.get(platform);
  if (!catalog) {
    catalog = createDeviceCatalog({ platform });
    catalogs.set(platform, catalog);
  }
  return catalog;
}

export function namespaceForVariant(variantId: string | null | undefined): string {
  if (!variantId) {
    return DEFAULT_VARIANT_NAMESPACE;
  }
  return NAMESPACE_BY_VARIANT[variantId] ?? DEFAULT_VARIANT_NAMESPACE;
}

/**
 * Schema of a registered namespace, or `undefined` for a namespace this build does not know.
 *
 * Persisted records can hold namespaces from another build; those must not be rewritten with
 * the fallback firmware's ceilings, so callers that normalize storage ask for this first.
 */
function registeredSchema(namespace: string): ParameterSchema | undefined {
  return deviceCatalog().resolveNamespaceSchema(namespace)?.schema;
}

/** Schema of one namespace, falling back to the default firmware for unknown names. */
export function schemaForNamespace(namespace: string): ParameterSchema {
  return registeredSchema(namespace) ?? registeredSchema(DEFAULT_VARIANT_NAMESPACE) ?? [];
}

function descriptorOf(namespace: string, key: string) {
  return findParameterDescriptor(schemaForNamespace(namespace), key);
}

export function defaultSizesForNamespace(namespace: string): SizeSettings {
  const schema = schemaForNamespace(namespace);
  const sizeDefault = (key: (typeof SIZE_KEYS)[number]): number => {
    const descriptor = findParameterDescriptor(schema, key);
    return typeof descriptor?.default === 'number' ? descriptor.default : 0x40;
  };
  return {
    romPageSize: sizeDefault('romPageSize'),
    // FlashGBX declares the real read request size; its 256B packet limit only bounds a frame.
    romReadPageSize: sizeDefault('romReadPageSize'),
    ramPageSize: sizeDefault('ramPageSize'),
  };
}

// --- normalization (the parameter descriptors own every rule) ---

/** Baud rates the FlashGBX binding accepts, taken from its descriptor. */
export type FlashgbxBaudRate = 'auto' | 1_000_000 | 1_500_000 | 2_000_000;

const GBFLASH_NAMESPACE = GBFLASH_BINDING.parameterNamespace;

export const FLASHGBX_BAUD_RATES: readonly FlashgbxBaudRate[] =
  (findParameterDescriptor(schemaForNamespace(GBFLASH_NAMESPACE), 'baudRate')
    ?.constraints?.options ?? ['auto']) as readonly FlashgbxBaudRate[];

/**
 * Normalizes one stored value against the descriptor of its namespace.
 *
 * `undefined` means the schema cannot serve the value; the caller substitutes the default.
 */
export function normalizeStoredParameter(
  namespace: string,
  key: string,
  stored: unknown,
): number | string | boolean | undefined {
  const descriptor = descriptorOf(namespace, key);
  return descriptor ? normalizeStoredValue(descriptor, stored) : undefined;
}

/** Normalizes one global parameter against its descriptor. */
export function normalizeGlobalParameter(key: string, stored: unknown): number | undefined {
  const descriptor = findParameterDescriptor(GLOBAL_PARAMETER_SCHEMA, key);
  const normalized = descriptor ? normalizeStoredValue(descriptor, stored) : undefined;
  return typeof normalized === 'number' ? normalized : undefined;
}

export function normalizeBaudRate(value: unknown): FlashgbxBaudRate {
  const normalized = normalizeStoredParameter(GBFLASH_NAMESPACE, 'baudRate', value);
  return typeof normalized === 'number' || typeof normalized === 'string'
    ? normalized as FlashgbxBaudRate
    : 'auto';
}

// --- global parameter descriptors used by migration and the compatibility facade ---

interface GlobalParameterSpec {
  readonly key: string;
  /** v1 section and field inside `advanced_settings`. */
  readonly legacyGroup: 'throttle' | 'retry' | 'timeout';
  readonly legacyField: string;
}

export const GLOBAL_PARAMETER_SPECS: readonly GlobalParameterSpec[] = [
  { key: 'romReadThrottleMs', legacyGroup: 'throttle', legacyField: 'romRead' },
  { key: 'ramReadThrottleMs', legacyGroup: 'throttle', legacyField: 'ramRead' },
  { key: 'romReadRetryCount', legacyGroup: 'retry', legacyField: 'romReadCount' },
  { key: 'ramReadRetryCount', legacyGroup: 'retry', legacyField: 'ramReadCount' },
  { key: 'romReadRetryDelayMs', legacyGroup: 'retry', legacyField: 'romReadDelay' },
  { key: 'ramReadRetryDelayMs', legacyGroup: 'retry', legacyField: 'ramReadDelay' },
  { key: 'romEraseRetryCount', legacyGroup: 'retry', legacyField: 'romEraseRetryCount' },
  { key: 'romEraseRetryDelayMs', legacyGroup: 'retry', legacyField: 'romEraseRetryDelay' },
  { key: 'romWriteRetryCount', legacyGroup: 'retry', legacyField: 'romWriteRetryCount' },
  { key: 'romWriteRetryDelayMs', legacyGroup: 'retry', legacyField: 'romWriteRetryDelay' },
  { key: 'defaultTimeout', legacyGroup: 'timeout', legacyField: 'default' },
  { key: 'packageSendTimeout', legacyGroup: 'timeout', legacyField: 'packageSend' },
  { key: 'packageReceiveTimeout', legacyGroup: 'timeout', legacyField: 'packageReceive' },
  { key: 'operationTimeout', legacyGroup: 'timeout', legacyField: 'operation' },
];

export const GLOBAL_PARAMETER_KEYS: readonly string[] = GLOBAL_PARAMETER_SPECS.map(spec => spec.key);

export type GlobalParameterKey = (typeof GLOBAL_PARAMETER_SPECS)[number]['key'];

export function defaultGlobalParameters(): ParameterBag {
  const values: ParameterBag = {};
  for (const spec of GLOBAL_PARAMETER_SPECS) {
    const descriptor = findParameterDescriptor(GLOBAL_PARAMETER_SCHEMA, spec.key);
    values[spec.key] = descriptor?.default ?? 0;
  }
  return values;
}

// --- v1 shapes (migration input only) ---

/** The historical v1 record. Only read during migration. */
interface LegacyAdvancedSettings {
  firmware?: {
    profile?: string;
    stmBoost?: boolean;
    flashgbxBaudRate?: unknown;
  };
  size?: Partial<SizeSettings>;
  profileSizes?: Partial<Record<string, Partial<SizeSettings>>>;
  throttle?: Record<string, unknown>;
  retry?: Record<string, unknown>;
  timeout?: Record<string, unknown>;
}

const LEGACY_PROFILE_NAMESPACE: Readonly<Record<string, string>> = Object.freeze({
  stm: BEGGAR_STM_BINDING.parameterNamespace,
  stc: BEGGAR_STC_BINDING.parameterNamespace,
  flashgbx: GBFLASH_BINDING.parameterNamespace,
});

/** v1 stored its pre-parameter default page sizes; those were replaced on load. */
const LEGACY_DEFAULTS = { romPageSize: 0x200, ramPageSize: 0x100 } as const;

function emptyRecord(): AdvancedSettingsV2 {
  return {
    version: ADVANCED_SETTINGS_VERSION,
    selectedVariantId: null,
    parametersByNamespace: {},
    global: defaultGlobalParameters(),
    independentSizes: false,
  };
}

/**
 * Writes one v1 size bag into a namespace, normalized against that namespace's descriptors.
 *
 * The ceiling is namespace specific (STM shares the Boost ceiling, FlashGBX caps an editable
 * packet at 0x2000), so a value is never carried over between namespaces without being
 * re-validated by the target schema.
 */
function applyLegacySizes(
  record: AdvancedSettingsV2,
  namespace: string,
  sizes: Partial<SizeSettings> | undefined,
): void {
  if (!sizes) {
    return;
  }
  const bag = { ...(record.parametersByNamespace[namespace] ?? {}) };
  for (const key of SIZE_KEYS) {
    const normalized = normalizeStoredParameter(namespace, key, sizes[key]);
    if (typeof normalized === 'number') {
      bag[key] = normalized;
    }
  }
  record.parametersByNamespace[namespace] = bag;
}

/** Link group declared by a namespace's page-size descriptor, if it declares one. */
function sizeLinkGroup(namespace: string): string | undefined {
  return descriptorOf(namespace, 'romPageSize')?.linkGroup;
}

function migrateLegacy(config: LegacyAdvancedSettings): AdvancedSettingsV2 {
  const record = emptyRecord();

  const legacyProfile = typeof config.firmware?.profile === 'string' ? config.firmware.profile : undefined;
  const variantId = legacyProfile ? LEGACY_PROFILE_VARIANTS[legacyProfile] ?? null : null;
  record.selectedVariantId = variantId;

  const activeNamespace = namespaceForVariant(variantId);

  // v1 always persisted `profileSizes` once it had saved anything, and editing stopped
  // syncing STM/STC at that point; keep those per-profile values authoritative.
  const hasProfileSizes = Boolean(config.profileSizes);
  record.independentSizes = hasProfileSizes;

  if (hasProfileSizes) {
    for (const [profileId, sizes] of Object.entries(config.profileSizes ?? {})) {
      const namespace = LEGACY_PROFILE_NAMESPACE[profileId];
      if (!namespace) {
        continue;
      }
      applyLegacySizes(record, namespace, sizes);
    }
  }

  if (!hasProfileSizes && config.size) {
    // v1 only ever read the flat `size` bag when `profileSizes` was absent (`setSettings`
    // skipped it otherwise), so a partially written `profileSizes` must win outright rather
    // than be patched up key by key from a stale `size`.
    //
    // Legacy pre-parameter builds wrote placeholder 0x200/0x100 defaults; replace them with
    // the current defaults exactly like the old loader did.
    const sizes: Partial<SizeSettings> = { ...config.size };
    const defaults = defaultSizesForNamespace(activeNamespace);
    if (sizes.romPageSize === LEGACY_DEFAULTS.romPageSize) {
      sizes.romPageSize = defaults.romPageSize;
    }
    if (sizes.ramPageSize === LEGACY_DEFAULTS.ramPageSize) {
      sizes.ramPageSize = defaults.ramPageSize;
    }
    applyLegacySizes(record, activeNamespace, sizes);

    // Linked sizes: the flat bag was shared by the Beggar profiles, so STM and STC inherit it.
    // Only a namespace that actually declares the link group is a valid source — a FlashGBX
    // `size` says nothing about the Beggar packet sizes and must not leak into them.
    const linkGroup = sizeLinkGroup(activeNamespace);
    if (linkGroup) {
      for (const namespace of PARAMETER_NAMESPACES) {
        if (namespace === activeNamespace || sizeLinkGroup(namespace) !== linkGroup) {
          continue;
        }
        applyLegacySizes(record, namespace, sizes);
      }
    }
  }

  for (const spec of GLOBAL_PARAMETER_SPECS) {
    const group: Record<string, unknown> | undefined = config[spec.legacyGroup];
    const normalized = normalizeGlobalParameter(spec.key, group?.[spec.legacyField]);
    if (normalized !== undefined) {
      record.global[spec.key] = normalized;
    }
  }

  if (config.firmware?.flashgbxBaudRate !== undefined) {
    const namespace = GBFLASH_NAMESPACE;
    record.parametersByNamespace[namespace] = {
      ...(record.parametersByNamespace[namespace] ?? {}),
      baudRate: normalizeBaudRate(config.firmware.flashgbxBaudRate),
    };
  }

  return record;
}

// --- record validation ---

function isBag(value: unknown): value is ParameterBag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredValue(value: unknown): value is StoredValue {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}

/**
 * Validates a persisted bag against the schema that will serve it.
 *
 * Without this the store would only clamp on read, so a `baudRate: 123456` or a `"bogus"`
 * string would still reach a connection plan and the settings form, and the record would
 * never converge. Entries the schema cannot serve are dropped, which makes the descriptor
 * default the effective value; keys the schema does not know are kept verbatim (a newer
 * build may own them) as long as they are plain storage values.
 */
function normalizeBag(bag: Record<string, unknown>, schema: ParameterSchema | undefined): ParameterBag {
  const next: ParameterBag = {};
  for (const [key, value] of Object.entries(bag)) {
    const descriptor = schema ? findParameterDescriptor(schema, key) : undefined;
    if (!descriptor) {
      if (isStoredValue(value)) {
        next[key] = value;
      }
      continue;
    }
    const normalized = normalizeStoredValue(descriptor, value);
    if (normalized !== undefined) {
      next[key] = normalized;
    }
  }
  return next;
}

function parseV2(value: Record<string, unknown>): AdvancedSettingsV2 | null {
  if (value.version !== ADVANCED_SETTINGS_VERSION) {
    return null;
  }
  const record = emptyRecord();

  const variantId = typeof value.selectedVariantId === 'string' ? value.selectedVariantId : null;
  // An unregistered variant is kept verbatim: the selection provider reports it as
  // invalid instead of silently falling back to a device the user did not choose.
  record.selectedVariantId = variantId;

  if (isBag(value.parametersByNamespace)) {
    for (const [namespace, bag] of Object.entries(value.parametersByNamespace as Record<string, unknown>)) {
      if (!isBag(bag)) {
        continue;
      }
      // Unknown namespaces keep their raw values: their schema lives in another build.
      record.parametersByNamespace[namespace] = normalizeBag(bag, registeredSchema(namespace));
    }
  }
  if (isBag(value.global)) {
    record.global = { ...record.global, ...normalizeBag(value.global, GLOBAL_PARAMETER_SCHEMA) };
  }
  record.independentSizes = value.independentSizes === true;
  return record;
}

// --- store ---

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export class AdvancedSettingsStorage {
  private state: AdvancedSettingsV2 = emptyRecord();

  private persistAllowed = true;

  private loaded = false;

  get record(): AdvancedSettingsV2 {
    return this.state;
  }

  get mayPersist(): boolean {
    return this.persistAllowed;
  }

  get independentSizes(): boolean {
    return this.state.independentSizes;
  }

  get selectedVariantId(): string | null {
    return this.state.selectedVariantId;
  }

  /** Reads storage once; later calls are no-ops so edits are never overwritten. */
  load(): SettingsLoadOutcome {
    if (this.loaded) {
      return { kind: 'loaded' };
    }
    const store = storage();
    const raw = store?.getItem(ADVANCED_SETTINGS_STORAGE_KEY) ?? null;

    if (!raw) {
      this.state = emptyRecord();
      this.loaded = true;
      return { kind: 'empty' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.state = emptyRecord();
      this.persistAllowed = false;
      this.loaded = true;
      return { kind: 'malformed' };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      this.state = emptyRecord();
      this.persistAllowed = false;
      this.loaded = true;
      return { kind: 'malformed' };
    }

    const candidate = parsed as Record<string, unknown>;
    if (candidate.version === ADVANCED_SETTINGS_VERSION) {
      const record = parseV2(candidate);
      this.state = record ?? emptyRecord();
      this.loaded = true;
      return { kind: 'loaded' };
    }

    const unversioned = candidate.version === undefined;
    if (!unversioned && candidate.version !== 1) {
      this.state = emptyRecord();
      this.persistAllowed = false;
      this.loaded = true;
      return { kind: 'unsupported', version: candidate.version };
    }

    this.state = migrateLegacy(candidate);
    this.loaded = true;
    // The source record is preserved once, before the first v2 write.
    try {
      store?.setItem(LEGACY_SETTINGS_BACKUP_KEY, raw);
    } catch {
      // Best effort: an unavailable backup must not block the migration.
    }
    this.persist();
    return { kind: 'migrated', from: unversioned ? 'unversioned' : 'v1' };
  }

  readParameter(namespace: string, key: string): StoredValue | undefined {
    if (namespace === 'global') {
      return this.state.global[key];
    }
    return this.state.parametersByNamespace[namespace]?.[key];
  }

  writeParameter(namespace: string, key: string, value: StoredValue): void {
    if (namespace === 'global') {
      this.state.global[key] = value;
    } else {
      this.state.parametersByNamespace[namespace] = {
        ...(this.state.parametersByNamespace[namespace] ?? {}),
        [key]: value,
      };
    }
    this.persist();
  }

  readGlobal(key: string): StoredValue | undefined {
    return this.state.global[key];
  }

  writeGlobal(key: string, value: StoredValue): void {
    this.state.global[key] = value;
    this.persist();
  }

  setSelectedVariant(variantId: string | null): void {
    this.state.selectedVariantId = variantId;
    this.persist();
  }

  setIndependentSizes(independent: boolean): void {
    this.state.independentSizes = independent;
    this.persist();
  }

  /** Forgets the in-memory state so the next `load()` re-reads the persisted record. */
  resetLoadedState(): void {
    this.state = emptyRecord();
    this.loaded = false;
    this.persistAllowed = true;
  }

  /** Resets the in-memory record to defaults. Persisting is the caller's choice. */
  reset(): void {
    this.state = emptyRecord();
    this.loaded = true;
    this.persistAllowed = true;
  }

  namespaceBag(namespace: string): ParameterBag {
    return { ...(this.state.parametersByNamespace[namespace] ?? {}) };
  }

  persist(): void {
    if (!this.persistAllowed) {
      return;
    }
    const store = storage();
    if (!store) {
      return;
    }
    try {
      store.setItem(ADVANCED_SETTINGS_STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to save advanced settings:', error);
    }
  }
}

/** Process wide record: the facade, the parameter store adapter and the UI share it. */
export const advancedSettingsStorage = new AdvancedSettingsStorage();
