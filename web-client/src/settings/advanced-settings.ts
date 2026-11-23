/**
 * Advanced settings compatibility facade.
 *
 * The persisted record lives in `advanced-settings-v2.ts` (single `selectedVariantId`,
 * firmware namespaces, global parameters and the STM/STC linking flag). This module keeps
 * the numeric accessors the transfer, protocol and adapter layers already use, and resolves
 * page sizes through the namespace of the selected variant instead of a firmware profile id.
 *
 * There is deliberately no `firmwareProfile` / `stmBoost` / `flashgbxBaudRate` alias any
 * more: the selection is `selectedVariantId` and the baud rate is `flashgbx.cfw.baudRate`.
 */
import { displayTextToString } from '@/device/display';
import type { ParameterDescriptor, ParameterSchema } from '@/device/parameters';

import {
  advancedSettingsStorage,
  defaultGlobalParameters,
  defaultSizesForNamespace,
  FLASHGBX_BAUD_RATES,
  type FlashgbxBaudRate,
  GLOBAL_PARAMETER_KEYS,
  GLOBAL_PARAMETER_SPECS,
  namespaceForVariant,
  normalizeBaudRate,
  normalizeValue,
  PARAMETER_NAMESPACES,
  type ParameterBag,
  SETTING_LIMITS,
  type SettingsLoadOutcome,
  type SizeSettings,
  type StoredValue,
  type ValidatorType,
} from './advanced-settings-v2';

export {
  ADVANCED_SETTINGS_STORAGE_KEY,
  ADVANCED_SETTINGS_VERSION,
  type AdvancedSettingsV2,
  type FlashgbxBaudRate,
  type GlobalParameterKey,
  LEGACY_SETTINGS_BACKUP_KEY,
  NAMESPACE_BY_VARIANT,
  normalizeBaudRate,
  PARAMETER_NAMESPACES,
  type ParameterBag,
  SETTING_LIMITS,
  type SettingsLoadOutcome,
  type SizeSettings,
  type StoredValue,
} from './advanced-settings-v2';

const SIZE_KEYS = ['romPageSize', 'romReadPageSize', 'ramPageSize'] as const;
type SizeKey = (typeof SIZE_KEYS)[number];

function validatorForSize(key: SizeKey): ValidatorType {
  return key === 'romReadPageSize' ? 'readPageSize' : 'pageSize';
}

const GBFLASH_NAMESPACE = 'flashgbx.cfw';

function activeNamespace(): string {
  return namespaceForVariant(advancedSettingsStorage.selectedVariantId);
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}

function errorRange(descriptor: ParameterDescriptor): string {
  const min = descriptor.constraints?.min;
  const max = descriptor.constraints?.max;
  if (min === undefined || max === undefined) {
    return '';
  }
  if (descriptor.kind === 'int' || descriptor.kind === 'hex') {
    return `${min} and ${max}`;
  }
  return `${min} and ${max}`;
}

/**
 * Schema-driven validation: the UI form, the store and the compatibility accessors all
 * read the same descriptor ranges, so a new parameter needs no extra validation code.
 */
export function validateSettings(
  schema: ParameterSchema,
  values: Readonly<Record<string, unknown>>,
): SettingsValidationResult {
  const errors: string[] = [];
  for (const descriptor of schema) {
    const value = values[descriptor.key];
    if (value === undefined) {
      continue;
    }
    const { constraints } = descriptor;
    if (constraints?.options && !constraints.options.includes(value as never)) {
      errors.push(`${displayTextToString(descriptor.label)} must be one of ${constraints.options.join(', ')}`);
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (constraints?.min !== undefined && value < constraints.min) {
        errors.push(`${displayTextToString(descriptor.label)} must be between ${errorRange(descriptor)}`);
      }
      if (constraints?.max !== undefined && value > constraints.max) {
        errors.push(`${displayTextToString(descriptor.label)} must be between ${errorRange(descriptor)}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export class AdvancedSettings {
  declare static romPageSize: number;
  declare static romReadPageSize: number;
  declare static ramPageSize: number;
  declare static romReadThrottleMs: number;
  declare static ramReadThrottleMs: number;
  declare static romReadRetryCount: number;
  declare static ramReadRetryCount: number;
  declare static romReadRetryDelayMs: number;
  declare static ramReadRetryDelayMs: number;
  declare static romEraseRetryCount: number;
  declare static romEraseRetryDelayMs: number;
  declare static romWriteRetryCount: number;
  declare static romWriteRetryDelayMs: number;
  declare static defaultTimeout: number;
  declare static packageSendTimeout: number;
  declare static packageReceiveTimeout: number;
  declare static operationTimeout: number;

  /** The persisted variant selection (`null` until the user picks one). */
  static getVariantId(): string | null {
    return advancedSettingsStorage.selectedVariantId;
  }

  static setVariantId(variantId: string | null): void {
    advancedSettingsStorage.setSelectedVariant(variantId);
  }

  static getIndependentSizes(): boolean {
    return advancedSettingsStorage.independentSizes;
  }

  static setIndependentSizes(independent: boolean): void {
    advancedSettingsStorage.setIndependentSizes(independent);
  }

  /** Page sizes of one firmware namespace, defaulted per host when unset. */
  static getNamespaceSizes(namespace: string = activeNamespace()): SizeSettings {
    const defaults = defaultSizesForNamespace(namespace);
    const bag = advancedSettingsStorage.namespaceBag(namespace);
    const sizes = { ...defaults };
    for (const key of SIZE_KEYS) {
      const stored = bag[key];
      if (typeof stored === 'number') {
        sizes[key] = stored;
      }
    }
    return sizes;
  }

  static setNamespaceSize(namespace: string, key: SizeKey, value: number): number {
    const normalized = normalizeValue(value, validatorForSize(key));
    advancedSettingsStorage.writeParameter(namespace, key, normalized);

    // Compatibility rule of the legacy accessor: while sizes are linked, a Beggar page
    // size applies to STM and STC alike. GBFlash always keeps its own value.
    if (!advancedSettingsStorage.independentSizes) {
      const siblings = namespace === GBFLASH_NAMESPACE
        ? []
        : PARAMETER_NAMESPACES.filter(item => item !== GBFLASH_NAMESPACE && item !== namespace);
      for (const sibling of siblings) {
        advancedSettingsStorage.writeParameter(sibling, key, normalized);
      }
    }
    return normalized;
  }

  /** Stored namespace parameters (defaults are not included). */
  static getNamespaceParameters(namespace: string): ParameterBag {
    return advancedSettingsStorage.namespaceBag(namespace);
  }

  static setNamespaceParameter(namespace: string, key: string, value: StoredValue): void {
    advancedSettingsStorage.writeParameter(namespace, key, value);
  }

  static getBaudRate(): FlashgbxBaudRate {
    const stored = advancedSettingsStorage.readParameter('flashgbx.cfw', 'baudRate');
    return normalizeBaudRate(stored);
  }

  static setBaudRate(value: unknown): void {
    advancedSettingsStorage.writeParameter('flashgbx.cfw', 'baudRate', normalizeBaudRate(value));
  }

  /** Global (namespace independent) operation parameters with defaults applied. */
  static getGlobalParameters(): ParameterBag {
    const values = defaultGlobalParameters();
    for (const key of GLOBAL_PARAMETER_KEYS) {
      const stored = advancedSettingsStorage.readGlobal(key);
      if (typeof stored === 'number') {
        values[key] = stored;
      }
    }
    return values;
  }

  static setGlobalParameter(key: string, value: number): void {
    const spec = GLOBAL_PARAMETER_SPECS.find(item => item.key === key);
    const normalized = spec ? normalizeValue(value, spec.validator) : value;
    advancedSettingsStorage.writeGlobal(key, normalized);
  }

  static loadSettings(): SettingsLoadOutcome {
    const outcome = advancedSettingsStorage.load();
    if (outcome.kind === 'malformed' || outcome.kind === 'unsupported') {
      console.warn(`Advanced settings were not readable (${outcome.kind}); running on in-memory defaults`);
    }
    return outcome;
  }

  /** Re-reads the persisted record (used when storage changed outside this process). */
  static reloadFromStorage(): SettingsLoadOutcome {
    advancedSettingsStorage.resetLoadedState();
    return this.loadSettings();
  }

  static saveSettings(): void {
    advancedSettingsStorage.persist();
  }

  static resetToDefaults(): void {
    advancedSettingsStorage.reset();
    advancedSettingsStorage.persist();
  }

  static init(): void {
    this.loadSettings();
    console.log('Advanced settings initialized:', {
      variantId: this.getVariantId(),
      independentSizes: this.getIndependentSizes(),
      ...this.getGlobalParameters(),
    });
  }

  static getLimits() {
    return {
      pageSize: { ...SETTING_LIMITS.pageSize },
      readPageSize: { ...SETTING_LIMITS.readPageSize },
      throttle: { ...SETTING_LIMITS.throttle },
      retryCount: { ...SETTING_LIMITS.retryCount },
      retryDelay: { ...SETTING_LIMITS.retryDelay },
      timeout: { ...SETTING_LIMITS.timeout },
    };
  }
}

/** Namespace used for parameters that every device shares (global schema writes). */
export const CORE_PARAMETER_NAMESPACE = 'beggar.stm';

/** Namespaces known to the persisted layout; used by the UI and the adapter. */
export const CONFIGURABLE_NAMESPACES = PARAMETER_NAMESPACES;

export const CONFIGURABLE_BAUD_RATES = FLASHGBX_BAUD_RATES;

// --- numeric compatibility accessors ---

for (const key of SIZE_KEYS) {
  Object.defineProperty(AdvancedSettings, key, {
    get(): number {
      return AdvancedSettings.getNamespaceSizes()[key];
    },
    set(value: number) {
      AdvancedSettings.setNamespaceSize(activeNamespace(), key, value);
    },
    enumerable: true,
    configurable: true,
  });
}

for (const spec of GLOBAL_PARAMETER_SPECS) {
  Object.defineProperty(AdvancedSettings, spec.key, {
    get(): number {
      const stored = advancedSettingsStorage.readGlobal(spec.key);
      return typeof stored === 'number' ? stored : spec.defaultValue;
    },
    set(value: number) {
      AdvancedSettings.setGlobalParameter(spec.key, value);
    },
    enumerable: true,
    configurable: true,
  });
}
