export interface AdvancedSettingsConfig {
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
  pageSize: { min: 0x40, max: 0x4000 },
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
  { key: 'romPageSize', group: 'size', field: 'romPageSize', default: 0x200, validator: 'pageSize', errorLabel: 'ROM page size' },
  { key: 'ramPageSize', group: 'size', field: 'ramPageSize', default: 0x100, validator: 'pageSize', errorLabel: 'RAM page size' },
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

function validateValue(value: number, type: ValidatorType): number {
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

// --- AdvancedSettings class ---

export class AdvancedSettings {
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

  static getSettings() {
    return {
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
      },
    };
  }

  static setSettings(settings: AdvancedSettingsConfig): void {
    for (const desc of SETTING_DESCRIPTORS) {
      const group = settings[desc.group as keyof AdvancedSettingsConfig];
      if (group) {
        const value = (group as Record<string, number | undefined>)[desc.field];
        if (value !== undefined) {
          _storage[desc.key] = validateValue(value, desc.validator);
        }
      }
    }
    this.saveSettings();
  }

  static resetToDefaults(): void {
    for (const desc of SETTING_DESCRIPTORS) {
      _storage[desc.key] = desc.default;
    }
    this.saveSettings();
  }

  static loadSettings(): void {
    try {
      const saved = localStorage.getItem('advanced_settings');
      if (saved) {
        const settings = JSON.parse(saved) as AdvancedSettingsConfig;
        this.setSettings(settings);
      }
    } catch (error) {
      console.warn('Failed to load advanced settings, using defaults', error);
      this.resetToDefaults();
    }
  }

  public static saveSettings(): void {
    try {
      const settings = this.getSettings();
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
    settings: Partial<ReturnType<typeof AdvancedSettings.getSettings>>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const desc of SETTING_DESCRIPTORS) {
      const group = settings[desc.group as keyof typeof settings];
      if (group) {
        const value = (group as Record<string, number | undefined>)[desc.field];
        if (value !== undefined && typeof value === 'number') {
          const { min, max } = LIMITS[desc.validator];
          if (value < min || value > max) {
            errors.push(`${desc.errorLabel} must be between ${formatErrorRange(min, max, desc.validator)}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

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
