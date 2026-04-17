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

export class AdvancedSettings {
  private static _romPageSize = 0x200;
  private static _ramPageSize = 0x100;
  private static _romReadThrottleMs = 0;
  private static _ramReadThrottleMs = 0;
  private static _romReadRetryCount = 1;
  private static _ramReadRetryCount = 1;
  private static _romReadRetryDelayMs = 0;
  private static _ramReadRetryDelayMs = 0;
  private static _romWriteRetryCount = 1;
  private static _romWriteRetryDelayMs = 0;
  private static _romEraseRetryCount = 1;
  private static _romEraseRetryDelayMs = 0;

  private static _defaultTimeout = 3000;
  private static _packageSendTimeout = 3000;
  private static _packageReceiveTimeout = 3000;
  private static _operationTimeout = 30000;

  private static readonly MIN_PAGE_SIZE = 0x40;
  private static readonly MAX_PAGE_SIZE = 0x4000;
  private static readonly MIN_THROTTLE = 0;
  private static readonly MAX_THROTTLE = 1000;
  private static readonly MIN_RETRY_COUNT = 0;
  private static readonly MAX_RETRY_COUNT = 10;
  private static readonly MIN_RETRY_DELAY = 0;
  private static readonly MAX_RETRY_DELAY = 5000;
  private static readonly MIN_TIMEOUT = 1000;
  private static readonly MAX_TIMEOUT = 300000;

  static get romPageSize(): number {
    return this._romPageSize;
  }

  static set romPageSize(value: number) {
    this._romPageSize = this.validatePageSize(value);
    this.saveSettings();
  }

  static get ramPageSize(): number {
    return this._ramPageSize;
  }

  static set ramPageSize(value: number) {
    this._ramPageSize = this.validatePageSize(value);
    this.saveSettings();
  }

  static get romReadThrottleMs(): number {
    return this._romReadThrottleMs;
  }

  static set romReadThrottleMs(value: number) {
    this._romReadThrottleMs = this.validateThrottle(value);
    this.saveSettings();
  }

  static get ramReadThrottleMs(): number {
    return this._ramReadThrottleMs;
  }

  static set ramReadThrottleMs(value: number) {
    this._ramReadThrottleMs = this.validateThrottle(value);
    this.saveSettings();
  }

  static get romReadRetryCount(): number {
    return this._romReadRetryCount;
  }

  static set romReadRetryCount(value: number) {
    this._romReadRetryCount = this.validateRetryCount(value);
    this.saveSettings();
  }

  static get ramReadRetryCount(): number {
    return this._ramReadRetryCount;
  }

  static set ramReadRetryCount(value: number) {
    this._ramReadRetryCount = this.validateRetryCount(value);
    this.saveSettings();
  }

  static get romReadRetryDelayMs(): number {
    return this._romReadRetryDelayMs;
  }

  static set romReadRetryDelayMs(value: number) {
    this._romReadRetryDelayMs = this.validateRetryDelay(value);
    this.saveSettings();
  }

  static get ramReadRetryDelayMs(): number {
    return this._ramReadRetryDelayMs;
  }

  static set ramReadRetryDelayMs(value: number) {
    this._ramReadRetryDelayMs = this.validateRetryDelay(value);
    this.saveSettings();
  }

  static get romWriteRetryCount(): number {
    return this._romWriteRetryCount;
  }

  static set romWriteRetryCount(value: number) {
    this._romWriteRetryCount = this.validateRetryCount(value);
    this.saveSettings();
  }

  static get romWriteRetryDelayMs(): number {
    return this._romWriteRetryDelayMs;
  }

  static set romWriteRetryDelayMs(value: number) {
    this._romWriteRetryDelayMs = this.validateRetryDelay(value);
    this.saveSettings();
  }

  static get romEraseRetryCount(): number {
    return this._romEraseRetryCount;
  }

  static set romEraseRetryCount(value: number) {
    this._romEraseRetryCount = this.validateRetryCount(value);
    this.saveSettings();
  }

  static get romEraseRetryDelayMs(): number {
    return this._romEraseRetryDelayMs;
  }

  static set romEraseRetryDelayMs(value: number) {
    this._romEraseRetryDelayMs = this.validateRetryDelay(value);
    this.saveSettings();
  }

  static get defaultTimeout(): number {
    return this._defaultTimeout;
  }

  static set defaultTimeout(value: number) {
    this._defaultTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get packageSendTimeout(): number {
    return this._packageSendTimeout;
  }

  static set packageSendTimeout(value: number) {
    this._packageSendTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get packageReceiveTimeout(): number {
    return this._packageReceiveTimeout;
  }

  static set packageReceiveTimeout(value: number) {
    this._packageReceiveTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  static get operationTimeout(): number {
    return this._operationTimeout;
  }

  static set operationTimeout(value: number) {
    this._operationTimeout = this.validateTimeout(value);
    this.saveSettings();
  }

  private static validatePageSize(size: number): number {
    if (size < this.MIN_PAGE_SIZE) {
      console.warn(`Page size ${size} is below minimum ${this.MIN_PAGE_SIZE}, clamping to minimum`);
      return this.MIN_PAGE_SIZE;
    }
    if (size > this.MAX_PAGE_SIZE) {
      console.warn(`Page size ${size} is above maximum ${this.MAX_PAGE_SIZE}, clamping to maximum`);
      return this.MAX_PAGE_SIZE;
    }
    if ((size & (size - 1)) !== 0) {
      console.warn(`Page size ${size} is not a power of two and may reduce performance`);
    }
    return size;
  }

  private static validateThrottle(throttle: number): number {
    const normalized = Math.trunc(throttle);
    if (normalized < this.MIN_THROTTLE) {
      console.warn(`Read throttle ${normalized}ms is below minimum ${this.MIN_THROTTLE}ms, clamping to minimum`);
      return this.MIN_THROTTLE;
    }
    if (normalized > this.MAX_THROTTLE) {
      console.warn(`Read throttle ${normalized}ms is above maximum ${this.MAX_THROTTLE}ms, clamping to maximum`);
      return this.MAX_THROTTLE;
    }
    return normalized;
  }

  private static validateTimeout(timeout: number): number {
    const normalized = Math.trunc(timeout);
    if (normalized < this.MIN_TIMEOUT) {
      console.warn(`Timeout ${normalized}ms is below minimum ${this.MIN_TIMEOUT}ms, clamping to minimum`);
      return this.MIN_TIMEOUT;
    }
    if (normalized > this.MAX_TIMEOUT) {
      console.warn(`Timeout ${normalized}ms is above maximum ${this.MAX_TIMEOUT}ms, clamping to maximum`);
      return this.MAX_TIMEOUT;
    }
    return normalized;
  }

  private static validateRetryCount(count: number): number {
    if (count < this.MIN_RETRY_COUNT) {
      console.warn(`Retry count ${count} is below minimum ${this.MIN_RETRY_COUNT}, clamping to minimum`);
      return this.MIN_RETRY_COUNT;
    }
    if (count > this.MAX_RETRY_COUNT) {
      console.warn(`Retry count ${count} is above maximum ${this.MAX_RETRY_COUNT}, clamping to maximum`);
      return this.MAX_RETRY_COUNT;
    }
    return Math.trunc(count);
  }

  private static validateRetryDelay(delay: number): number {
    const normalized = Math.trunc(delay);
    if (normalized < this.MIN_RETRY_DELAY) {
      console.warn(`Retry delay ${normalized}ms is below minimum ${this.MIN_RETRY_DELAY}ms, clamping to minimum`);
      return this.MIN_RETRY_DELAY;
    }
    if (normalized > this.MAX_RETRY_DELAY) {
      console.warn(`Retry delay ${normalized}ms is above maximum ${this.MAX_RETRY_DELAY}ms, clamping to maximum`);
      return this.MAX_RETRY_DELAY;
    }
    return normalized;
  }

  static getSettings() {
    return {
      size: {
        romPageSize: this._romPageSize,
        ramPageSize: this._ramPageSize,
      },
      throttle: {
        romRead: this._romReadThrottleMs,
        ramRead: this._ramReadThrottleMs,
      },
      retry: {
        romReadCount: this._romReadRetryCount,
        ramReadCount: this._ramReadRetryCount,
        romReadDelay: this._romReadRetryDelayMs,
        ramReadDelay: this._ramReadRetryDelayMs,
        romWriteRetryCount: this._romWriteRetryCount,
        romWriteRetryDelay: this._romWriteRetryDelayMs,
        romEraseRetryCount: this._romEraseRetryCount,
        romEraseRetryDelay: this._romEraseRetryDelayMs,
      },
      timeout: {
        default: this._defaultTimeout,
        packageSend: this._packageSendTimeout,
        packageReceive: this._packageReceiveTimeout,
        operation: this._operationTimeout,
      },
    };
  }

  static setSettings(settings: AdvancedSettingsConfig): void {
    if (settings.size) {
      if (settings.size.romPageSize !== undefined) {
        this._romPageSize = this.validatePageSize(settings.size.romPageSize);
      }
      if (settings.size.ramPageSize !== undefined) {
        this._ramPageSize = this.validatePageSize(settings.size.ramPageSize);
      }
    }

    if (settings.throttle) {
      if (settings.throttle.romRead !== undefined) {
        this._romReadThrottleMs = this.validateThrottle(settings.throttle.romRead);
      }
      if (settings.throttle.ramRead !== undefined) {
        this._ramReadThrottleMs = this.validateThrottle(settings.throttle.ramRead);
      }
    }

    if (settings.retry) {
      if (settings.retry.romReadCount !== undefined) {
        this._romReadRetryCount = this.validateRetryCount(settings.retry.romReadCount);
      }
      if (settings.retry.ramReadCount !== undefined) {
        this._ramReadRetryCount = this.validateRetryCount(settings.retry.ramReadCount);
      }
      if (settings.retry.romReadDelay !== undefined) {
        this._romReadRetryDelayMs = this.validateRetryDelay(settings.retry.romReadDelay);
      }
      if (settings.retry.ramReadDelay !== undefined) {
        this._ramReadRetryDelayMs = this.validateRetryDelay(settings.retry.ramReadDelay);
      }
      if (settings.retry.romWriteRetryCount !== undefined) {
        this._romWriteRetryCount = this.validateRetryCount(settings.retry.romWriteRetryCount);
      }
      if (settings.retry.romWriteRetryDelay !== undefined) {
        this._romWriteRetryDelayMs = this.validateRetryDelay(settings.retry.romWriteRetryDelay);
      }
      if (settings.retry.romEraseRetryCount !== undefined) {
        this._romEraseRetryCount = this.validateRetryCount(settings.retry.romEraseRetryCount);
      }
      if (settings.retry.romEraseRetryDelay !== undefined) {
        this._romEraseRetryDelayMs = this.validateRetryDelay(settings.retry.romEraseRetryDelay);
      }
    }

    if (settings.timeout) {
      if (settings.timeout.default !== undefined) {
        this._defaultTimeout = this.validateTimeout(settings.timeout.default);
      }
      if (settings.timeout.packageSend !== undefined) {
        this._packageSendTimeout = this.validateTimeout(settings.timeout.packageSend);
      }
      if (settings.timeout.packageReceive !== undefined) {
        this._packageReceiveTimeout = this.validateTimeout(settings.timeout.packageReceive);
      }
      if (settings.timeout.operation !== undefined) {
        this._operationTimeout = this.validateTimeout(settings.timeout.operation);
      }
    }

    // Batch save once after all fields are updated
    this.saveSettings();
  }

  static resetToDefaults(): void {
    this._romPageSize = 0x200;
    this._ramPageSize = 0x100;
    this._romReadThrottleMs = 0;
    this._ramReadThrottleMs = 0;
    this._romReadRetryCount = 1;
    this._ramReadRetryCount = 1;
    this._romReadRetryDelayMs = 0;
    this._ramReadRetryDelayMs = 0;
    this._romWriteRetryCount = 1;
    this._romWriteRetryDelayMs = 0;
    this._romEraseRetryCount = 1;
    this._romEraseRetryDelayMs = 0;
    this._defaultTimeout = 3000;
    this._packageSendTimeout = 3000;
    this._packageReceiveTimeout = 3000;
    this._operationTimeout = 30000;
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
      pageSize: {
        min: this.MIN_PAGE_SIZE,
        max: this.MAX_PAGE_SIZE,
      },
      throttle: {
        min: this.MIN_THROTTLE,
        max: this.MAX_THROTTLE,
      },
      retryCount: {
        min: this.MIN_RETRY_COUNT,
        max: this.MAX_RETRY_COUNT,
      },
      retryDelay: {
        min: this.MIN_RETRY_DELAY,
        max: this.MAX_RETRY_DELAY,
      },
      timeout: {
        min: this.MIN_TIMEOUT,
        max: this.MAX_TIMEOUT,
      },
    };
  }

  static validateSettings(settings: Partial<ReturnType<typeof AdvancedSettings.getSettings>>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.size) {
      if (settings.size.romPageSize !== undefined) {
        if (settings.size.romPageSize < this.MIN_PAGE_SIZE || settings.size.romPageSize > this.MAX_PAGE_SIZE) {
          errors.push(`ROM page size must be between ${this.MIN_PAGE_SIZE} and ${this.MAX_PAGE_SIZE} bytes`);
        }
      }
      if (settings.size.ramPageSize !== undefined) {
        if (settings.size.ramPageSize < this.MIN_PAGE_SIZE || settings.size.ramPageSize > this.MAX_PAGE_SIZE) {
          errors.push(`RAM page size must be between ${this.MIN_PAGE_SIZE} and ${this.MAX_PAGE_SIZE} bytes`);
        }
      }
    }

    if (settings.throttle) {
      if (settings.throttle.romRead !== undefined) {
        if (settings.throttle.romRead < this.MIN_THROTTLE || settings.throttle.romRead > this.MAX_THROTTLE) {
          errors.push(`ROM read throttle must be between ${this.MIN_THROTTLE}ms and ${this.MAX_THROTTLE}ms`);
        }
      }
      if (settings.throttle.ramRead !== undefined) {
        if (settings.throttle.ramRead < this.MIN_THROTTLE || settings.throttle.ramRead > this.MAX_THROTTLE) {
          errors.push(`RAM read throttle must be between ${this.MIN_THROTTLE}ms and ${this.MAX_THROTTLE}ms`);
        }
      }
    }

    if (settings.retry) {
      if (settings.retry.romReadCount !== undefined) {
        if (settings.retry.romReadCount < this.MIN_RETRY_COUNT || settings.retry.romReadCount > this.MAX_RETRY_COUNT) {
          errors.push(`ROM read retry count must be between ${this.MIN_RETRY_COUNT} and ${this.MAX_RETRY_COUNT}`);
        }
      }
      if (settings.retry.ramReadCount !== undefined) {
        if (settings.retry.ramReadCount < this.MIN_RETRY_COUNT || settings.retry.ramReadCount > this.MAX_RETRY_COUNT) {
          errors.push(`RAM read retry count must be between ${this.MIN_RETRY_COUNT} and ${this.MAX_RETRY_COUNT}`);
        }
      }
      if (settings.retry.romReadDelay !== undefined) {
        if (settings.retry.romReadDelay < this.MIN_RETRY_DELAY || settings.retry.romReadDelay > this.MAX_RETRY_DELAY) {
          errors.push(`ROM read retry delay must be between ${this.MIN_RETRY_DELAY}ms and ${this.MAX_RETRY_DELAY}ms`);
        }
      }
      if (settings.retry.ramReadDelay !== undefined) {
        if (settings.retry.ramReadDelay < this.MIN_RETRY_DELAY || settings.retry.ramReadDelay > this.MAX_RETRY_DELAY) {
          errors.push(`RAM read retry delay must be between ${this.MIN_RETRY_DELAY}ms and ${this.MAX_RETRY_DELAY}ms`);
        }
      }
      if (settings.retry.romWriteRetryCount !== undefined) {
        if (settings.retry.romWriteRetryCount < this.MIN_RETRY_COUNT || settings.retry.romWriteRetryCount > this.MAX_RETRY_COUNT) {
          errors.push(`ROM write retry count must be between ${this.MIN_RETRY_COUNT} and ${this.MAX_RETRY_COUNT}`);
        }
      }
      if (settings.retry.romWriteRetryDelay !== undefined) {
        if (settings.retry.romWriteRetryDelay < this.MIN_RETRY_DELAY || settings.retry.romWriteRetryDelay > this.MAX_RETRY_DELAY) {
          errors.push(`ROM write retry delay must be between ${this.MIN_RETRY_DELAY}ms and ${this.MAX_RETRY_DELAY}ms`);
        }
      }
      if (settings.retry.romEraseRetryCount !== undefined) {
        if (settings.retry.romEraseRetryCount < this.MIN_RETRY_COUNT || settings.retry.romEraseRetryCount > this.MAX_RETRY_COUNT) {
          errors.push(`ROM erase retry count must be between ${this.MIN_RETRY_COUNT} and ${this.MAX_RETRY_COUNT}`);
        }
      }
      if (settings.retry.romEraseRetryDelay !== undefined) {
        if (settings.retry.romEraseRetryDelay < this.MIN_RETRY_DELAY || settings.retry.romEraseRetryDelay > this.MAX_RETRY_DELAY) {
          errors.push(`ROM erase retry delay must be between ${this.MIN_RETRY_DELAY}ms and ${this.MAX_RETRY_DELAY}ms`);
        }
      }
    }

    if (settings.timeout) {
      Object.entries(settings.timeout).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (value < this.MIN_TIMEOUT || value > this.MAX_TIMEOUT) {
            errors.push(`${key} timeout must be between ${this.MIN_TIMEOUT}ms and ${this.MAX_TIMEOUT}ms`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
