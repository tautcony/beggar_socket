import type { ConfigurableFirmwareProfileId } from '@/types/firmware-profile';

export interface AdvancedSettingsConfig {
  firmware?: {
    profile?: ConfigurableFirmwareProfileId;
  };
  size?: {
    romPageSize?: number;
    ramPageSize?: number;
  };
  throttle?: {
    romRead?: number;
    ramRead?: number;
  };
  retry?: {
    romReadCount?: number;
    ramReadCount?: number;
    romReadDelay?: number;
    ramReadDelay?: number;
    romWriteRetryCount?: number;
    romWriteRetryDelay?: number;
    romEraseRetryCount?: number;
    romEraseRetryDelay?: number;
  };
  timeout?: {
    default?: number;
    packageSend?: number;
    packageReceive?: number;
    operation?: number;
    operationBudgetEnabled?: boolean;
  };
}

// --- Setting descriptor infrastructure ---

type ValidatorType = 'pageSize' | 'throttle' | 'retryCount' | 'retryDelay' | 'timeout';

interface SettingDescriptor {
  key: string;
  group: string;
  field: string;
  default: number;
  validator: ValidatorType;
  errorLabel: string;
}

const LIMITS = {
  pageSize: { min: 0x40, max: 0x1000 },
  throttle: { min: 0, max: 1000 },
  retryCount: { min: 0, max: 10 },
  retryDelay: { min: 0, max: 5000 },
  timeout: { min: 1000, max: 300000 },
} as const;

const VALIDATOR_META: Record<ValidatorType, { label: string; unit: string }> = {
  pageSize: { label: 'Page size', unit: '' },
  throttle: { label: 'Read throttle', unit: 'ms' },
  retryCount: { label: 'Retry count', unit: '' },
  retryDelay: { label: 'Retry delay', unit: 'ms' },
  timeout: { label: 'Timeout', unit: 'ms' },
};

const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  { key: 'romPageSize', group: 'size', field: 'romPageSize', default: 0x1000, validator: 'pageSize', errorLabel: 'ROM page size' },
  { key: 'ramPageSize', group: 'size', field: 'ramPageSize', default: 0x1000, validator: 'pageSize', errorLabel: 'RAM page size' },
  { key: 'romReadThrottleMs', group: 'throttle', field: 'romRead', default: 0, validator: 'throttle', errorLabel: 'ROM read throttle' },
  { key: 'ramReadThrottleMs', group: 'throttle', field: 'ramRead', default: 0, validator: 'throttle', errorLabel: 'RAM read throttle' },
  { key: 'romReadRetryCount', group: 'retry', field: 'romReadCount', default: 1, validator: 'retryCount', errorLabel: 'ROM read retry count' },
  { key: 'ramReadRetryCount', group: 'retry', field: 'ramReadCount', default: 1, validator: 'retryCount', errorLabel: 'RAM read retry count' },
  { key: 'romReadRetryDelayMs', group: 'retry', field: 'romReadDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM read retry delay' },
  { key: 'ramReadRetryDelayMs', group: 'retry', field: 'ramReadDelay', default: 0, validator: 'retryDelay', errorLabel: 'RAM read retry delay' },
  { key: 'romWriteRetryCount', group: 'retry', field: 'romWriteRetryCount', default: 1, validator: 'retryCount', errorLabel: 'ROM write retry count' },
  { key: 'romWriteRetryDelayMs', group: 'retry', field: 'romWriteRetryDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM write retry delay' },
  { key: 'romEraseRetryCount', group: 'retry', field: 'romEraseRetryCount', default: 1, validator: 'retryCount', errorLabel: 'ROM erase retry count' },
  { key: 'romEraseRetryDelayMs', group: 'retry', field: 'romEraseRetryDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM erase retry delay' },
  { key: 'defaultTimeout', group: 'timeout', field: 'default', default: 3000, validator: 'timeout', errorLabel: 'default timeout' },
  { key: 'packageSendTimeout', group: 'timeout', field: 'packageSend', default: 3000, validator: 'timeout', errorLabel: 'packageSend timeout' },
  { key: 'packageReceiveTimeout', group: 'timeout', field: 'packageReceive', default: 3000, validator: 'timeout', errorLabel: 'packageReceive timeout' },
  { key: 'operationTimeout', group: 'timeout', field: 'operation', default: 30000, validator: 'timeout', errorLabel: 'operation timeout' },
];

const _storage: Record<string, number> = Object.fromEntries(
  SETTING_DESCRIPTORS.map((d) => [d.key, d.default]),
);
let _operationBudgetEnabled = false;
let _firmwareProfile: ConfigurableFirmwareProfileId = 'stm';

const STORAGE_VERSION = 1;

function restoreDefaults(): void {
  _operationBudgetEnabled = false;
  _firmwareProfile = 'stm';
  for (const desc of SETTING_DESCRIPTORS) {
    _storage[desc.key] = desc.default;
  }
}

function validateValue(value: number, type: ValidatorType): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${VALIDATOR_META[type].label} must be a finite number`);
  }
  if (type === 'pageSize' && !Number.isInteger(value)) {
    throw new TypeError('Page size must be an integer');
  }
  const { min, max } = LIMITS[type];
  const { label, unit } = VALIDATOR_META[type];

  const needsTruncFirst = type === 'throttle' || type === 'retryDelay' || type === 'timeout';
  const v = needsTruncFirst ? Math.trunc(value) : value;

  if (v < min) {
    console.warn(`${label} ${v}${unit} is below minimum ${min}${unit}, clamping to minimum`);
    return min;
  }
  if (v > max) {
    console.warn(`${label} ${v}${unit} is above maximum ${max}${unit}, clamping to maximum`);
    return max;
  }

  if (type === 'pageSize' && (v & (v - 1)) !== 0) {
    console.warn(`Page size ${v} is not a power of two and may reduce performance`);
  }

  return type === 'retryCount' ? Math.trunc(v) : v;
}

function formatErrorRange(min: number, max: number, type: ValidatorType): string {
  switch (type) {
    case 'pageSize':
      return `${min} and ${max} bytes`;
    case 'throttle':
    case 'retryDelay':
    case 'timeout':
      return `${min}ms and ${max}ms`;
    case 'retryCount':
      return `${min} and ${max}`;
  }
}

function validateFirmwareProfile(value: unknown): ConfigurableFirmwareProfileId {
  if (typeof value !== 'string') throw new TypeError('Firmware profile must be a string');
  if (value === 'stm' || value === 'stc') {
    return value;
  }

  console.warn(`Firmware profile ${value} is not supported, falling back to stm`);
  return 'stm';
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function inspectSettings(settings: unknown, normalize = false) {
  const errors: string[] = [];
  const values: Record<string, number> = {};
  let profile: ConfigurableFirmwareProfileId | undefined;
  let budgetEnabled: boolean | undefined;
  if (!isSettingsObject(settings)) {
    return { errors: ['Settings must be an object'], values, profile, budgetEnabled };
  }

  const groups = new Set(['firmware', ...SETTING_DESCRIPTORS.map((desc) => desc.group)]);
  for (const [groupName, group] of Object.entries(settings)) {
    if (!groups.has(groupName)) {
      errors.push(`Unknown settings group: ${groupName}`);
      continue;
    }
    if (group === undefined) continue;
    if (!isSettingsObject(group)) {
      errors.push(`${groupName} settings must be an object`);
      continue;
    }
    const descriptors = SETTING_DESCRIPTORS.filter((desc) => desc.group === groupName);
    for (const [field, value] of Object.entries(group)) {
      if (groupName === 'firmware' && field === 'profile') {
        if (value === undefined) continue;
        if (value === 'stm' || value === 'stc') profile = value;
        else if (normalize && typeof value === 'string') profile = validateFirmwareProfile(value);
        else errors.push('Firmware profile must be stm or stc');
        continue;
      }
      if (groupName === 'timeout' && field === 'operationBudgetEnabled') {
        if (value === undefined) continue;
        if (typeof value === 'boolean') budgetEnabled = value;
        else errors.push('Operation budget enabled must be a boolean');
        continue;
      }
      const desc = descriptors.find((candidate) => candidate.field === field);
      if (!desc) {
        errors.push(`Unknown settings field: ${groupName}.${field}`);
        continue;
      }
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${desc.errorLabel} must be a finite number`);
        continue;
      }
      if ((!normalize || desc.validator === 'pageSize') && !Number.isInteger(value)) {
        errors.push(`${desc.errorLabel} must be an integer`);
        continue;
      }
      const { min, max } = LIMITS[desc.validator];
      if (!normalize && (value < min || value > max)) {
        errors.push(`${desc.errorLabel} must be between ${formatErrorRange(min, max, desc.validator)}`);
        continue;
      }
      values[desc.key] = normalize ? validateValue(value, desc.validator) : value;
    }
  }
  return { errors, values, profile, budgetEnabled };
}

// --- AdvancedSettings class ---

export class AdvancedSettings {
  declare static firmwareProfile: ConfigurableFirmwareProfileId;
  declare static romPageSize: number;
  declare static ramPageSize: number;
  declare static romReadThrottleMs: number;
  declare static ramReadThrottleMs: number;
  declare static romReadRetryCount: number;
  declare static ramReadRetryCount: number;
  declare static romReadRetryDelayMs: number;
  declare static ramReadRetryDelayMs: number;
  declare static romWriteRetryCount: number;
  declare static romWriteRetryDelayMs: number;
  declare static romEraseRetryCount: number;
  declare static romEraseRetryDelayMs: number;
  declare static defaultTimeout: number;
  declare static packageSendTimeout: number;
  declare static packageReceiveTimeout: number;
  declare static operationTimeout: number;
  declare static operationBudgetEnabled: boolean;

  static getSettings() {
    return {
      firmware: {
        profile: _firmwareProfile,
      },
      size: {
        romPageSize: _storage.romPageSize,
        ramPageSize: _storage.ramPageSize,
      },
      throttle: {
        romRead: _storage.romReadThrottleMs,
        ramRead: _storage.ramReadThrottleMs,
      },
      retry: {
        romReadCount: _storage.romReadRetryCount,
        ramReadCount: _storage.ramReadRetryCount,
        romReadDelay: _storage.romReadRetryDelayMs,
        ramReadDelay: _storage.ramReadRetryDelayMs,
        romWriteRetryCount: _storage.romWriteRetryCount,
        romWriteRetryDelay: _storage.romWriteRetryDelayMs,
        romEraseRetryCount: _storage.romEraseRetryCount,
        romEraseRetryDelay: _storage.romEraseRetryDelayMs,
      },
      timeout: {
        default: _storage.defaultTimeout,
        packageSend: _storage.packageSendTimeout,
        packageReceive: _storage.packageReceiveTimeout,
        operation: _storage.operationTimeout,
        operationBudgetEnabled: _operationBudgetEnabled,
      },
    };
  }

  static setSettings(settings: AdvancedSettingsConfig): void {
    const { errors, values, profile, budgetEnabled } = inspectSettings(settings, true);
    if (errors.length) throw new TypeError(errors.join('; '));
    if (profile !== undefined) _firmwareProfile = profile;
    if (budgetEnabled !== undefined) _operationBudgetEnabled = budgetEnabled;
    Object.assign(_storage, values);
    this.saveSettings();
  }

  static resetToDefaults(): void {
    restoreDefaults();
    this.saveSettings();
  }

  static loadSettings(): void {
    try {
      const saved = localStorage.getItem('advanced_settings');
      if (saved) {
        const snapshot: unknown = JSON.parse(saved);
        if (!isSettingsObject(snapshot)) throw new TypeError('Saved settings must be an object');
        const { version, ...settings } = snapshot;
        if (Object.prototype.hasOwnProperty.call(snapshot, 'version') && version !== STORAGE_VERSION) {
          throw new TypeError('Unsupported advanced settings version');
        }
        const { errors, values, profile, budgetEnabled } = inspectSettings(settings);
        if (errors.length) throw new TypeError(errors.join('; '));
        restoreDefaults();
        Object.assign(_storage, values);
        if (profile !== undefined) _firmwareProfile = profile;
        if (budgetEnabled !== undefined) _operationBudgetEnabled = budgetEnabled;
      }
    } catch (error) {
      console.warn('Failed to load advanced settings, using defaults', error);
      restoreDefaults();
    }
  }

  public static saveSettings(): void {
    try {
      const settings = { version: STORAGE_VERSION, ...this.getSettings() };
      localStorage.setItem('advanced_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save advanced settings:', error);
    }
  }

  static init(): void {
    this.loadSettings();
    console.log('Advanced settings initialized:', this.getSettings());
  }

  static getLimits() {
    return {
      pageSize: { min: LIMITS.pageSize.min, max: LIMITS.pageSize.max },
      throttle: { min: LIMITS.throttle.min, max: LIMITS.throttle.max },
      retryCount: { min: LIMITS.retryCount.min, max: LIMITS.retryCount.max },
      retryDelay: { min: LIMITS.retryDelay.min, max: LIMITS.retryDelay.max },
      timeout: { min: LIMITS.timeout.min, max: LIMITS.timeout.max },
    };
  }

  static validateSettings(
    settings: unknown,
  ): { valid: boolean; errors: string[] } {
    const { errors } = inspectSettings(settings);
    return { valid: errors.length === 0, errors };
  }
}

Object.defineProperty(AdvancedSettings, 'firmwareProfile', {
  get(): ConfigurableFirmwareProfileId {
    return _firmwareProfile;
  },
  set(value: ConfigurableFirmwareProfileId) {
    _firmwareProfile = validateFirmwareProfile(value);
    AdvancedSettings.saveSettings();
  },
  enumerable: true,
  configurable: true,
});

// Register getter/setter properties from descriptors
for (const desc of SETTING_DESCRIPTORS) {
  Object.defineProperty(AdvancedSettings, desc.key, {
    get(): number {
      return _storage[desc.key];
    },
    set(value: number) {
      _storage[desc.key] = validateValue(value, desc.validator);
      AdvancedSettings.saveSettings();
    },
    enumerable: true,
    configurable: true,
  });
}

Object.defineProperty(AdvancedSettings, 'operationBudgetEnabled', {
  get(): boolean { return _operationBudgetEnabled; },
  set(value: boolean) {
    if (typeof value !== 'boolean') throw new TypeError('Operation budget enabled must be a boolean');
    _operationBudgetEnabled = value;
    AdvancedSettings.saveSettings();
  },
  enumerable: true,
  configurable: true,
});
