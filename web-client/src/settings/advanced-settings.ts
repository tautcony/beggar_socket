import { getOptimalPacketLimits } from '@/platform/serial/platform-packet-policy';
import type { ConfigurableFirmwareProfileId } from '@/types/firmware-profile';
import { floorPowerOfTwo } from '@/utils/transfer-plan';

export type FlashgbxBaudRate = 'auto' | 1000000 | 1500000 | 2000000;

export interface SizeSettings {
  romPageSize: number;
  romReadPageSize: number;
  ramPageSize: number;
}

export interface AdvancedSettingsConfig {
  firmware?: {
    profile?: ConfigurableFirmwareProfileId;
    stmBoost?: boolean;
    flashgbxBaudRate?: FlashgbxBaudRate;
  };
  size?: Partial<SizeSettings>;
  profileSizes?: Partial<Record<ConfigurableFirmwareProfileId, Partial<SizeSettings>>>;
  throttle?: {
    romRead?: number;
    ramRead?: number;
  };
  retry?: {
    romReadCount?: number;
    ramReadCount?: number;
    romReadDelay?: number;
    ramReadDelay?: number;
    romEraseRetryCount?: number;
    romEraseRetryDelay?: number;
    romWriteRetryCount?: number;
    romWriteRetryDelay?: number;
  };
  timeout?: {
    default?: number;
    packageSend?: number;
    packageReceive?: number;
    operation?: number;
  };
}

// --- Setting descriptor infrastructure ---

type ValidatorType = 'pageSize' | 'readPageSize' | 'throttle' | 'retryCount' | 'retryDelay' | 'timeout';

interface SettingDescriptor {
  key: string;
  group: string;
  field: string;
  default: number;
  validator: ValidatorType;
  errorLabel: string;
}

const LIMITS = {
  pageSize: { min: 0x40, max: 0x2000 },
  readPageSize: { min: 0x40, max: 0x8000 },
  throttle: { min: 0, max: 1000 },
  retryCount: { min: 0, max: 10 },
  retryDelay: { min: 0, max: 5000 },
  timeout: { min: 1000, max: 300000 },
} as const;

const VALIDATOR_META: Record<ValidatorType, { label: string; unit: string }> = {
  pageSize: { label: 'Page size', unit: '' },
  readPageSize: { label: 'Read page size', unit: '' },
  throttle: { label: 'Read throttle', unit: 'ms' },
  retryCount: { label: 'Retry count', unit: '' },
  retryDelay: { label: 'Retry delay', unit: 'ms' },
  timeout: { label: 'Timeout', unit: 'ms' },
};

const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  { key: 'romPageSize', group: 'size', field: 'romPageSize', default: 0x1000, validator: 'pageSize', errorLabel: 'ROM page size' },
  { key: 'romReadPageSize', group: 'size', field: 'romReadPageSize', default: 0x1000, validator: 'readPageSize', errorLabel: 'ROM read page size' },
  { key: 'ramPageSize', group: 'size', field: 'ramPageSize', default: 0x1000, validator: 'pageSize', errorLabel: 'RAM page size' },
  { key: 'romReadThrottleMs', group: 'throttle', field: 'romRead', default: 0, validator: 'throttle', errorLabel: 'ROM read throttle' },
  { key: 'ramReadThrottleMs', group: 'throttle', field: 'ramRead', default: 0, validator: 'throttle', errorLabel: 'RAM read throttle' },
  { key: 'romReadRetryCount', group: 'retry', field: 'romReadCount', default: 1, validator: 'retryCount', errorLabel: 'ROM read retry count' },
  { key: 'ramReadRetryCount', group: 'retry', field: 'ramReadCount', default: 1, validator: 'retryCount', errorLabel: 'RAM read retry count' },
  { key: 'romReadRetryDelayMs', group: 'retry', field: 'romReadDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM read retry delay' },
  { key: 'ramReadRetryDelayMs', group: 'retry', field: 'ramReadDelay', default: 0, validator: 'retryDelay', errorLabel: 'RAM read retry delay' },
  { key: 'romEraseRetryCount', group: 'retry', field: 'romEraseRetryCount', default: 1, validator: 'retryCount', errorLabel: 'ROM erase retry count' },
  { key: 'romEraseRetryDelayMs', group: 'retry', field: 'romEraseRetryDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM erase retry delay' },
  { key: 'romWriteRetryCount', group: 'retry', field: 'romWriteRetryCount', default: 1, validator: 'retryCount', errorLabel: 'ROM write retry count' },
  { key: 'romWriteRetryDelayMs', group: 'retry', field: 'romWriteRetryDelay', default: 0, validator: 'retryDelay', errorLabel: 'ROM write retry delay' },
  { key: 'defaultTimeout', group: 'timeout', field: 'default', default: 3000, validator: 'timeout', errorLabel: 'default timeout' },
  { key: 'packageSendTimeout', group: 'timeout', field: 'packageSend', default: 3000, validator: 'timeout', errorLabel: 'packageSend timeout' },
  { key: 'packageReceiveTimeout', group: 'timeout', field: 'packageReceive', default: 3000, validator: 'timeout', errorLabel: 'packageReceive timeout' },
  { key: 'operationTimeout', group: 'timeout', field: 'operation', default: 30000, validator: 'timeout', errorLabel: 'operation timeout' },
];

const _storage: Record<string, number> = Object.fromEntries(
  SETTING_DESCRIPTORS.map((d) => [d.key, d.default]),
);
let _firmwareProfile: ConfigurableFirmwareProfileId = 'stm';
let _stmBoost = true;
let _flashgbxBaudRate: FlashgbxBaudRate = 'auto';
const CONFIGURABLE_PROFILES: readonly ConfigurableFirmwareProfileId[] = ['stm', 'stc', 'flashgbx'];

function createDefaultProfileSizes(profile: ConfigurableFirmwareProfileId): SizeSettings {
  const limits = getOptimalPacketLimits(profile);
  return {
    romPageSize: limits.romWrite,
    romReadPageSize: limits.romRead,
    ramPageSize: limits.ramPage,
  };
}

const _profileSizes: Record<ConfigurableFirmwareProfileId, SizeSettings> = {
  stm: createDefaultProfileSizes('stm'),
  stc: createDefaultProfileSizes('stc'),
  flashgbx: createDefaultProfileSizes('flashgbx'),
};
let _independentProfileSizes = false;

function syncActiveProfileSizesToStorage(): void {
  const active = _profileSizes[_firmwareProfile];
  _storage.romPageSize = active.romPageSize;
  _storage.romReadPageSize = active.romReadPageSize;
  _storage.ramPageSize = active.ramPageSize;
}

syncActiveProfileSizesToStorage();

const LEGACY_DEFAULTS = {
  romPageSize: 0x200,
  ramPageSize: 0x100,
} as const;

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

  if ((type === 'pageSize' || type === 'readPageSize') && v !== 0x0c00 && (v & (v - 1)) !== 0) {
    const normalized = floorPowerOfTwo(v, min);
    console.warn(`${label} ${v} is not a power of two, normalizing down to ${normalized}`);
    return normalized;
  }

  return type === 'retryCount' ? Math.trunc(v) : v;
}

function formatErrorRange(min: number, max: number, type: ValidatorType): string {
  switch (type) {
    case 'pageSize':
    case 'readPageSize':
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
  if (value === 'stm' || value === 'stc' || value === 'flashgbx') {
    return value;
  }

  console.warn(`Firmware profile ${String(value)} is not supported, falling back to stm`);
  return 'stm';
}

function validateFlashgbxBaudRate(value: unknown): FlashgbxBaudRate {
  if (value === 'auto' || value === 1000000 || value === 1500000 || value === 2000000) {
    return value;
  }

  console.warn(`FlashGBX baud rate ${String(value)} is not supported, falling back to auto`);
  return 'auto';
}

// --- AdvancedSettings class ---

export class AdvancedSettings {
  declare static firmwareProfile: ConfigurableFirmwareProfileId;
  declare static stmBoost: boolean;
  declare static flashgbxBaudRate: FlashgbxBaudRate;
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

  static getProfileSizes(profile: ConfigurableFirmwareProfileId = _firmwareProfile): SizeSettings {
    return { ..._profileSizes[profile] };
  }

  static getSettings() {
    syncActiveProfileSizesToStorage();
    return {
      firmware: {
        profile: _firmwareProfile,
        stmBoost: _stmBoost,
        flashgbxBaudRate: _flashgbxBaudRate,
      },
      size: {
        romPageSize: _profileSizes[_firmwareProfile].romPageSize,
        romReadPageSize: _profileSizes[_firmwareProfile].romReadPageSize,
        ramPageSize: _profileSizes[_firmwareProfile].ramPageSize,
      },
      profileSizes: {
        stm: { ..._profileSizes.stm },
        stc: { ..._profileSizes.stc },
        flashgbx: { ..._profileSizes.flashgbx },
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
        romEraseRetryCount: _storage.romEraseRetryCount,
        romEraseRetryDelay: _storage.romEraseRetryDelayMs,
        romWriteRetryCount: _storage.romWriteRetryCount,
        romWriteRetryDelay: _storage.romWriteRetryDelayMs,
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
    if (settings.firmware?.profile !== undefined) {
      _firmwareProfile = validateFirmwareProfile(settings.firmware.profile);
    }
    if (settings.firmware?.stmBoost !== undefined) {
      _stmBoost = settings.firmware.stmBoost;
    }
    if (settings.firmware?.flashgbxBaudRate !== undefined) {
      _flashgbxBaudRate = validateFlashgbxBaudRate(settings.firmware.flashgbxBaudRate);
    }

    if (settings.profileSizes) {
      _independentProfileSizes = true;
      for (const profileId of CONFIGURABLE_PROFILES) {
        const profileSize = settings.profileSizes[profileId];
        if (!profileSize) continue;
        if (profileSize.romPageSize !== undefined) {
          _profileSizes[profileId].romPageSize = validateValue(profileSize.romPageSize, 'pageSize');
        }
        if (profileSize.romReadPageSize !== undefined) {
          _profileSizes[profileId].romReadPageSize = validateValue(profileSize.romReadPageSize, 'readPageSize');
        }
        if (profileSize.ramPageSize !== undefined) {
          _profileSizes[profileId].ramPageSize = validateValue(profileSize.ramPageSize, 'pageSize');
        }
      }
    }

    const hasProfileSizes = Boolean(settings.profileSizes);
    for (const desc of SETTING_DESCRIPTORS) {
      const group = settings[desc.group as keyof AdvancedSettingsConfig];
      if (group) {
        const value = (group as Record<string, number | undefined>)[desc.field];
        if (value !== undefined) {
          const validated = validateValue(value, desc.validator);
          _storage[desc.key] = validated;
          if (desc.group === 'size' && !hasProfileSizes) {
            _profileSizes[_firmwareProfile][desc.field as keyof SizeSettings] = validated;
          }
        }
      }
    }
    syncActiveProfileSizesToStorage();
    this.saveSettings();
  }

  static resetToDefaults(): void {
    _firmwareProfile = 'stm';
    _stmBoost = true;
    _flashgbxBaudRate = 'auto';
    _independentProfileSizes = false;
    for (const profileId of CONFIGURABLE_PROFILES) {
      _profileSizes[profileId] = createDefaultProfileSizes(profileId);
    }
    for (const desc of SETTING_DESCRIPTORS) {
      _storage[desc.key] = desc.default;
    }
    syncActiveProfileSizesToStorage();
    this.saveSettings();
  }

  static loadSettings(): void {
    try {
      const saved = localStorage.getItem('advanced_settings');
      if (saved) {
        const settings = JSON.parse(saved) as AdvancedSettingsConfig;
        if (settings.firmware?.flashgbxBaudRate === undefined) {
          _flashgbxBaudRate = 'auto';
        }
        if (settings.size?.romPageSize === LEGACY_DEFAULTS.romPageSize) {
          settings.size.romPageSize = _storage.romPageSize;
        }
        if (settings.size?.ramPageSize === LEGACY_DEFAULTS.ramPageSize) {
          settings.size.ramPageSize = _storage.ramPageSize;
        }
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
      readPageSize: { min: LIMITS.readPageSize.min, max: LIMITS.readPageSize.max },
      throttle: { min: LIMITS.throttle.min, max: LIMITS.throttle.max },
      retryCount: { min: LIMITS.retryCount.min, max: LIMITS.retryCount.max },
      retryDelay: { min: LIMITS.retryDelay.min, max: LIMITS.retryDelay.max },
      timeout: { min: LIMITS.timeout.min, max: LIMITS.timeout.max },
    };
  }

  static validateSettings(
    settings: AdvancedSettingsConfig,
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

Object.defineProperty(AdvancedSettings, 'firmwareProfile', {
  get(): ConfigurableFirmwareProfileId {
    return _firmwareProfile;
  },
  set(value: ConfigurableFirmwareProfileId) {
    _firmwareProfile = validateFirmwareProfile(value);
    syncActiveProfileSizesToStorage();
    AdvancedSettings.saveSettings();
  },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(AdvancedSettings, 'stmBoost', {
  get(): boolean {
    return _stmBoost;
  },
  set(value: boolean) {
    _stmBoost = value;
    AdvancedSettings.saveSettings();
  },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(AdvancedSettings, 'flashgbxBaudRate', {
  get(): FlashgbxBaudRate {
    return _flashgbxBaudRate;
  },
  set(value: FlashgbxBaudRate) {
    _flashgbxBaudRate = validateFlashgbxBaudRate(value);
    AdvancedSettings.saveSettings();
  },
  enumerable: true,
  configurable: true,
});

// Register getter/setter properties from descriptors
for (const desc of SETTING_DESCRIPTORS) {
  Object.defineProperty(AdvancedSettings, desc.key, {
    get(): number {
      if (desc.group === 'size') {
        return _profileSizes[_firmwareProfile][desc.field as keyof SizeSettings];
      }
      return _storage[desc.key];
    },
    set(value: number) {
      const validated = validateValue(value, desc.validator);
      _storage[desc.key] = validated;
      if (desc.group === 'size') {
        const field = desc.field as keyof SizeSettings;
        _profileSizes[_firmwareProfile][field] = validated;
        if (!_independentProfileSizes && _firmwareProfile !== 'flashgbx') {
          for (const otherProfile of CONFIGURABLE_PROFILES) {
            if (otherProfile !== _firmwareProfile && otherProfile !== 'flashgbx') {
              _profileSizes[otherProfile][field] = validated;
            }
          }
        }
      }
      AdvancedSettings.saveSettings();
    },
    enumerable: true,
    configurable: true,
  });
}
