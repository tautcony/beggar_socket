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
  GBFLASH_BINDING,
  LEGACY_PROFILE_VARIANT_IDS,
} from '@/device/definitions';
import type { DeviceFirmwareBinding } from '@/device/types';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';

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

/** Every namespace a v2 record can hold, in a stable order. */
export const PARAMETER_NAMESPACES: readonly string[] = Object.freeze(
  [...new Set(BINDINGS.map(binding => binding.parameterNamespace))],
);

/** v1 `firmware.profile` → v2 `selectedVariantId` (Boost is never inferred). */
export const LEGACY_PROFILE_VARIANTS: Readonly<Record<string, string>> = LEGACY_PROFILE_VARIANT_IDS;

const DEFAULT_VARIANT_NAMESPACE = BEGGAR_STM_BINDING.parameterNamespace;

export function namespaceForVariant(variantId: string | null | undefined): string {
  if (!variantId) {
    return DEFAULT_VARIANT_NAMESPACE;
  }
  return NAMESPACE_BY_VARIANT[variantId] ?? DEFAULT_VARIANT_NAMESPACE;
}

export function defaultSizesForNamespace(namespace: string): SizeSettings {
  const binding = BINDING_BY_NAMESPACE[namespace] ?? BEGGAR_STM_BINDING;
  const limits = binding.transport.packetLimits[detectHostPlatform()];
  return {
    romPageSize: limits.romWrite,
    romReadPageSize: limits.romRead,
    ramPageSize: limits.ramPage,
  };
}

// --- limits and normalization (unchanged rules) ---

export type ValidatorType = 'pageSize' | 'readPageSize' | 'throttle' | 'retryCount' | 'retryDelay' | 'timeout';

export const SETTING_LIMITS = {
  pageSize: { min: 0x40, max: 0x2000 },
  readPageSize: { min: 0x40, max: 0x8000 },
  throttle: { min: 0, max: 1000 },
  retryCount: { min: 0, max: 10 },
  retryDelay: { min: 0, max: 5000 },
  timeout: { min: 1000, max: 300000 },
} as const;

export const FLASHGBX_BAUD_RATES = ['auto', 1_000_000, 1_500_000, 2_000_000] as const;
export type FlashgbxBaudRate = (typeof FLASHGBX_BAUD_RATES)[number];

function floorPowerOfTwo(value: number, minimum: number): number {
  if (value <= minimum) {
    return minimum;
  }
  let result = 1;
  while (result * 2 <= value) {
    result *= 2;
  }
  return Math.max(result, minimum);
}

/** Clamps and normalizes a numeric parameter with the historical rules. */
export function normalizeValue(value: number, type: ValidatorType): number {
  if (!Number.isFinite(value)) {
    return SETTING_LIMITS[type].min;
  }
  const { min, max } = SETTING_LIMITS[type];
  const truncFirst = type === 'throttle' || type === 'retryDelay' || type === 'timeout' || type === 'retryCount';
  const candidate = truncFirst ? Math.trunc(value) : value;
  const clamped = Math.min(Math.max(candidate, min), max);
  if ((type === 'pageSize' || type === 'readPageSize') && clamped !== 0x0c00 && (clamped & (clamped - 1)) !== 0) {
    return floorPowerOfTwo(clamped, min);
  }
  return clamped;
}

export function normalizeBaudRate(value: unknown): FlashgbxBaudRate {
  return (FLASHGBX_BAUD_RATES as readonly unknown[]).includes(value)
    ? (value as FlashgbxBaudRate)
    : 'auto';
}

// --- global parameter descriptors used by migration and the compatibility facade ---

interface GlobalParameterSpec {
  readonly key: string;
  readonly validator: ValidatorType;
  readonly defaultValue: number;
  /** v1 section and field inside `advanced_settings`. */
  readonly legacyGroup: 'throttle' | 'retry' | 'timeout';
  readonly legacyField: string;
}

export const GLOBAL_PARAMETER_SPECS: readonly GlobalParameterSpec[] = [
  { key: 'romReadThrottleMs', validator: 'throttle', defaultValue: 0, legacyGroup: 'throttle', legacyField: 'romRead' },
  { key: 'ramReadThrottleMs', validator: 'throttle', defaultValue: 0, legacyGroup: 'throttle', legacyField: 'ramRead' },
  { key: 'romReadRetryCount', validator: 'retryCount', defaultValue: 1, legacyGroup: 'retry', legacyField: 'romReadCount' },
  { key: 'ramReadRetryCount', validator: 'retryCount', defaultValue: 1, legacyGroup: 'retry', legacyField: 'ramReadCount' },
  { key: 'romReadRetryDelayMs', validator: 'retryDelay', defaultValue: 0, legacyGroup: 'retry', legacyField: 'romReadDelay' },
  { key: 'ramReadRetryDelayMs', validator: 'retryDelay', defaultValue: 0, legacyGroup: 'retry', legacyField: 'ramReadDelay' },
  { key: 'romEraseRetryCount', validator: 'retryCount', defaultValue: 1, legacyGroup: 'retry', legacyField: 'romEraseRetryCount' },
  { key: 'romEraseRetryDelayMs', validator: 'retryDelay', defaultValue: 0, legacyGroup: 'retry', legacyField: 'romEraseRetryDelay' },
  { key: 'romWriteRetryCount', validator: 'retryCount', defaultValue: 1, legacyGroup: 'retry', legacyField: 'romWriteRetryCount' },
  { key: 'romWriteRetryDelayMs', validator: 'retryDelay', defaultValue: 0, legacyGroup: 'retry', legacyField: 'romWriteRetryDelay' },
  { key: 'defaultTimeout', validator: 'timeout', defaultValue: 3000, legacyGroup: 'timeout', legacyField: 'default' },
  { key: 'packageSendTimeout', validator: 'timeout', defaultValue: 3000, legacyGroup: 'timeout', legacyField: 'packageSend' },
  { key: 'packageReceiveTimeout', validator: 'timeout', defaultValue: 3000, legacyGroup: 'timeout', legacyField: 'packageReceive' },
  { key: 'operationTimeout', validator: 'timeout', defaultValue: 30000, legacyGroup: 'timeout', legacyField: 'operation' },
];

export const GLOBAL_PARAMETER_KEYS: readonly string[] = GLOBAL_PARAMETER_SPECS.map(spec => spec.key);

export type GlobalParameterKey = (typeof GLOBAL_PARAMETER_SPECS)[number]['key'];

export function defaultGlobalParameters(): ParameterBag {
  return Object.fromEntries(GLOBAL_PARAMETER_SPECS.map(spec => [spec.key, spec.defaultValue]));
}

// --- v1 shapes (migration input only) ---

const SIZE_KEYS = ['romPageSize', 'romReadPageSize', 'ramPageSize'] as const;

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

function normalizeSize(value: unknown, key: (typeof SIZE_KEYS)[number]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return normalizeValue(value, key === 'romReadPageSize' ? 'readPageSize' : 'pageSize');
}

/** Fills the namespace page sizes of `target` from a v1 size bag. */
function applyLegacySizes(target: ParameterBag, sizes: Partial<SizeSettings> | undefined): void {
  if (!sizes) {
    return;
  }
  for (const key of SIZE_KEYS) {
    const value = normalizeSize(sizes[key], key);
    if (value !== undefined) {
      target[key] = value;
    }
  }
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
      const bag = record.parametersByNamespace[namespace] ?? {};
      applyLegacySizes(bag, sizes);
      record.parametersByNamespace[namespace] = bag;
    }
  }

  if (config.size) {
    // Legacy pre-parameter builds wrote placeholder 0x200/0x100 defaults; replace them
    // with the current defaults exactly like the old loader did.
    const sizes: Partial<SizeSettings> = { ...config.size };
    const defaults = defaultSizesForNamespace(activeNamespace);
    if (sizes.romPageSize === LEGACY_DEFAULTS.romPageSize) {
      sizes.romPageSize = defaults.romPageSize;
    }
    if (sizes.ramPageSize === LEGACY_DEFAULTS.ramPageSize) {
      sizes.ramPageSize = defaults.ramPageSize;
    }
    const bag = record.parametersByNamespace[activeNamespace] ?? {};
    for (const key of SIZE_KEYS) {
      if (bag[key] !== undefined) {
        continue;
      }
      const value = normalizeSize(sizes[key], key);
      if (value !== undefined) {
        bag[key] = value;
      }
    }
    record.parametersByNamespace[activeNamespace] = bag;

    if (!record.independentSizes) {
      // Linked sizes: keep the Beggar namespaces identical to the active selection.
      for (const namespace of PARAMETER_NAMESPACES) {
        if (namespace === activeNamespace || namespace === GBFLASH_BINDING.parameterNamespace) {
          continue;
        }
        const sibling = record.parametersByNamespace[namespace] ?? {};
        for (const key of SIZE_KEYS) {
          if (bag[key] !== undefined) {
            sibling[key] = bag[key];
          }
        }
        record.parametersByNamespace[namespace] = sibling;
      }
    }
  }

  for (const spec of GLOBAL_PARAMETER_SPECS) {
    const group: Record<string, unknown> | undefined = config[spec.legacyGroup];
    const raw = group?.[spec.legacyField];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      record.global[spec.key] = normalizeValue(raw, spec.validator);
    }
  }

  if (config.firmware?.flashgbxBaudRate !== undefined) {
    const namespace = GBFLASH_BINDING.parameterNamespace;
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
      record.parametersByNamespace[namespace] = { ...bag };
    }
  }
  if (isBag(value.global)) {
    for (const [key, entry] of Object.entries(value.global)) {
      if (typeof entry === 'number' || typeof entry === 'string' || typeof entry === 'boolean') {
        record.global[key] = entry;
      }
    }
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
