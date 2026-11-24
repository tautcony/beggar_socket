/**
 * Advanced settings compatibility facade.
 *
 * The persisted record lives in `advanced-settings-v2.ts` (single `selectedVariantId`,
 * firmware namespaces, global parameters and the STM/STC linking flag). This module keeps
 * the numeric accessors the transfer, protocol and adapter layers already use, and resolves
 * page sizes through the namespace of the selected variant instead of a firmware profile id.
 *
 * There is deliberately no `firmwareProfile` / `stmBoost` / `gbflashBaudRate` alias any
 * more: the selection is `selectedVariantId` and the baud rate is `gbflash.cfw.baudRate`.
 */
import { displayTextToString } from '@/device/display';
import {
  createParameterContext,
  findParameterDescriptor,
  GLOBAL_PARAMETER_SCHEMA,
  normalizeNumber,
  normalizeStoredValue,
  type ParameterDescriptor,
  type ParameterSchema,
  validateParameter,
} from '@/device/parameters';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';

import {
  advancedSettingsStorage,
  defaultGlobalParameters,
  defaultSizesForNamespace,
  GBFLASH_BAUD_RATES,
  type GbflashBaudRate,
  GLOBAL_PARAMETER_KEYS,
  GLOBAL_PARAMETER_SPECS,
  namespaceForVariant,
  normalizeBaudRate,
  normalizeGlobalParameter,
  normalizeStoredParameter,
  PARAMETER_NAMESPACES,
  type ParameterBag,
  schemaForNamespace,
  type SettingsLoadOutcome,
  type SizeSettings,
  type StoredValue,
} from './advanced-settings-v2';

export {
  ADVANCED_SETTINGS_STORAGE_KEY,
  ADVANCED_SETTINGS_VERSION,
  type AdvancedSettingsV2,
  type GbflashBaudRate,
  type GlobalParameterKey,
  LEGACY_SETTINGS_BACKUP_KEY,
  NAMESPACE_BY_VARIANT,
  normalizeBaudRate,
  PARAMETER_NAMESPACES,
  type ParameterBag,
  type SettingsLoadOutcome,
  type SizeSettings,
  type StoredValue,
} from './advanced-settings-v2';

const SIZE_KEYS = ['romPageSize', 'romReadPageSize', 'ramPageSize'] as const;
type SizeKey = (typeof SIZE_KEYS)[number];

function descriptorFor(namespace: string, key: string): ParameterDescriptor | undefined {
  return findParameterDescriptor(schemaForNamespace(namespace), key);
}

function activeNamespace(): string {
  return namespaceForVariant(advancedSettingsStorage.selectedVariantId);
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Schema-driven validation: the UI form, the store and the compatibility accessors all read
 * the same descriptor, so a new parameter needs no extra validation code and a bound cannot
 * be enforced in one path and ignored in another.
 */
export function validateSettings(
  schema: ParameterSchema,
  values: Readonly<Record<string, unknown>>,
): SettingsValidationResult {
  const errors: string[] = [];
  const context = createParameterContext('settings', detectHostPlatform());
  for (const descriptor of schema) {
    const value = values[descriptor.key];
    if (value === undefined) {
      continue;
    }
    const reason = validateParameter(descriptor, value as never, context);
    if (reason) {
      errors.push(`${displayTextToString(descriptor.label)}: ${reason}`);
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
    const sizes = defaultSizesForNamespace(namespace);
    for (const key of SIZE_KEYS) {
      const stored = normalizeStoredParameter(namespace, key, advancedSettingsStorage.readParameter(namespace, key));
      if (typeof stored === 'number') {
        sizes[key] = stored;
      }
    }
    return sizes;
  }

  static setNamespaceSize(namespace: string, key: SizeKey, value: number): number {
    const descriptor = descriptorFor(namespace, key);
    const normalized = descriptor ? normalizeNumber(descriptor, value) : Math.trunc(value);
    advancedSettingsStorage.writeParameter(namespace, key, normalized);
    if (!descriptor) {
      return normalized;
    }

    // Linked sizes: every namespace that declares the same `linkGroup` follows (STM and STC
    // share one group). A namespace without the group keeps its own value, so the rule is the
    // schema's, not a hard-coded "everything except GBFlash".
    if (!advancedSettingsStorage.independentSizes && descriptor.linkGroup) {
      for (const sibling of PARAMETER_NAMESPACES) {
        if (sibling === namespace) {
          continue;
        }
        const siblingDescriptor = descriptorFor(sibling, key);
        if (siblingDescriptor?.linkGroup !== descriptor.linkGroup) {
          continue;
        }
        advancedSettingsStorage.writeParameter(sibling, key, normalizeNumber(siblingDescriptor, normalized));
      }
    }
    return normalized;
  }

  /** Stored namespace parameters (defaults are not included). */
  static getNamespaceParameters(namespace: string): ParameterBag {
    return advancedSettingsStorage.namespaceBag(namespace);
  }

  static setNamespaceParameter(namespace: string, key: string, value: StoredValue): void {
    const descriptor = descriptorFor(namespace, key);
    const normalized = descriptor ? normalizeStoredValue(descriptor, value) : undefined;
    advancedSettingsStorage.writeParameter(namespace, key, normalized ?? value);
  }

  static getBaudRate(): GbflashBaudRate {
    const stored = advancedSettingsStorage.readParameter('gbflash.cfw', 'baudRate');
    return normalizeBaudRate(stored);
  }

  static setBaudRate(value: unknown): void {
    advancedSettingsStorage.writeParameter('gbflash.cfw', 'baudRate', normalizeBaudRate(value));
  }

  /** Global (namespace independent) operation parameters with defaults applied. */
  static getGlobalParameters(): ParameterBag {
    const values = defaultGlobalParameters();
    for (const key of GLOBAL_PARAMETER_KEYS) {
      const normalized = normalizeGlobalParameter(key, advancedSettingsStorage.readGlobal(key));
      if (normalized !== undefined) {
        values[key] = normalized;
      }
    }
    return values;
  }

  static setGlobalParameter(key: string, value: number): void {
    const descriptor = findParameterDescriptor(GLOBAL_PARAMETER_SCHEMA, key);
    advancedSettingsStorage.writeGlobal(
      key,
      descriptor ? normalizeNumber(descriptor, value) : Math.trunc(value),
    );
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
}

/** Namespace used for parameters that every device shares (global schema writes). */
export const CORE_PARAMETER_NAMESPACE = 'beggar.stm';

/** Namespaces known to the persisted layout; used by the UI and the adapter. */
export const CONFIGURABLE_NAMESPACES = PARAMETER_NAMESPACES;

export const CONFIGURABLE_BAUD_RATES = GBFLASH_BAUD_RATES;

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
      const descriptor = findParameterDescriptor(GLOBAL_PARAMETER_SCHEMA, spec.key);
      const normalized = normalizeGlobalParameter(spec.key, advancedSettingsStorage.readGlobal(spec.key));
      if (normalized !== undefined) {
        return normalized;
      }
      return typeof descriptor?.default === 'number' ? descriptor.default : 0;
    },
    set(value: number) {
      AdvancedSettings.setGlobalParameter(spec.key, value);
    },
    enumerable: true,
    configurable: true,
  });
}
