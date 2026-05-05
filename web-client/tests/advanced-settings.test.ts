/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdvancedSettings, type AdvancedSettingsConfig } from '../src/settings/advanced-settings';

describe('AdvancedSettings', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          const { [key]: _removed, ...rest } = localStorageMock;
          localStorageMock = rest;
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });

    AdvancedSettings.resetToDefaults();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('defaults', () => {
    it('returns correct defaults for all properties', () => {
      expect(AdvancedSettings.firmwareProfile).toBe('stm');
      expect(AdvancedSettings.romPageSize).toBe(0x200);
      expect(AdvancedSettings.ramPageSize).toBe(0x100);
      expect(AdvancedSettings.romReadThrottleMs).toBe(0);
      expect(AdvancedSettings.ramReadThrottleMs).toBe(0);
      expect(AdvancedSettings.romReadRetryCount).toBe(1);
      expect(AdvancedSettings.ramReadRetryCount).toBe(1);
      expect(AdvancedSettings.romReadRetryDelayMs).toBe(0);
      expect(AdvancedSettings.ramReadRetryDelayMs).toBe(0);
      expect(AdvancedSettings.romWriteRetryCount).toBe(1);
      expect(AdvancedSettings.romWriteRetryDelayMs).toBe(0);
      expect(AdvancedSettings.romEraseRetryCount).toBe(1);
      expect(AdvancedSettings.romEraseRetryDelayMs).toBe(0);
      expect(AdvancedSettings.defaultTimeout).toBe(3000);
      expect(AdvancedSettings.packageSendTimeout).toBe(3000);
      expect(AdvancedSettings.packageReceiveTimeout).toBe(3000);
      expect(AdvancedSettings.operationTimeout).toBe(30000);
    });

    it('getSettings returns all defaults in correct structure', () => {
      const s = AdvancedSettings.getSettings();
      expect(s).toEqual({
        firmware: { profile: 'stm' },
        size: { romPageSize: 0x200, ramPageSize: 0x100 },
        throttle: { romRead: 0, ramRead: 0 },
        retry: {
          romReadCount: 1, ramReadCount: 1,
          romReadDelay: 0, ramReadDelay: 0,
          romWriteRetryCount: 1, romWriteRetryDelay: 0,
          romEraseRetryCount: 1, romEraseRetryDelay: 0,
        },
        timeout: { default: 3000, packageSend: 3000, packageReceive: 3000, operation: 30000 },
      });
    });
  });

  describe('setter validation and clamping', () => {
    it('clamps page sizes to min/max', () => {
      AdvancedSettings.romPageSize = 0x10;
      expect(AdvancedSettings.romPageSize).toBe(0x40);

      AdvancedSettings.romPageSize = 0x10000;
      expect(AdvancedSettings.romPageSize).toBe(0x4000);

      AdvancedSettings.ramPageSize = 0x20;
      expect(AdvancedSettings.ramPageSize).toBe(0x40);
    });

    it('accepts valid page sizes including non-power-of-two', () => {
      AdvancedSettings.romPageSize = 300;
      expect(AdvancedSettings.romPageSize).toBe(300);
    });

    it('clamps throttle values', () => {
      AdvancedSettings.romReadThrottleMs = -10;
      expect(AdvancedSettings.romReadThrottleMs).toBe(0);

      AdvancedSettings.ramReadThrottleMs = 2000;
      expect(AdvancedSettings.ramReadThrottleMs).toBe(1000);
    });

    it('truncates throttle values', () => {
      AdvancedSettings.romReadThrottleMs = 500.7;
      expect(AdvancedSettings.romReadThrottleMs).toBe(500);
    });

    it('clamps retry counts', () => {
      AdvancedSettings.romReadRetryCount = -1;
      expect(AdvancedSettings.romReadRetryCount).toBe(0);

      AdvancedSettings.ramReadRetryCount = 20;
      expect(AdvancedSettings.ramReadRetryCount).toBe(10);
    });

    it('truncates retry counts after clamping', () => {
      AdvancedSettings.romReadRetryCount = 5.9;
      expect(AdvancedSettings.romReadRetryCount).toBe(5);
    });

    it('clamps retry delays', () => {
      AdvancedSettings.romReadRetryDelayMs = -100;
      expect(AdvancedSettings.romReadRetryDelayMs).toBe(0);

      AdvancedSettings.ramReadRetryDelayMs = 9000;
      expect(AdvancedSettings.ramReadRetryDelayMs).toBe(5000);
    });

    it('clamps timeout values', () => {
      AdvancedSettings.defaultTimeout = 100;
      expect(AdvancedSettings.defaultTimeout).toBe(1000);

      AdvancedSettings.operationTimeout = 500000;
      expect(AdvancedSettings.operationTimeout).toBe(300000);
    });

    it('truncates timeout values', () => {
      AdvancedSettings.packageSendTimeout = 5000.5;
      expect(AdvancedSettings.packageSendTimeout).toBe(5000);
    });

    it('setter triggers saveSettings', () => {
      AdvancedSettings.romPageSize = 1024;
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('persists firmware profile from the static setter', () => {
      AdvancedSettings.firmwareProfile = 'stc';
      const savedSettings = JSON.parse(localStorageMock.advanced_settings) as AdvancedSettingsConfig;

      expect(AdvancedSettings.firmwareProfile).toBe('stc');
      expect(savedSettings.firmware).toEqual({ profile: 'stc' });
    });
  });

  describe('setSettings and getSettings roundtrip', () => {
    it('persists ROM write and erase retry settings through getSettings', () => {
      AdvancedSettings.setSettings({
        retry: {
          romWriteRetryCount: 3,
          romWriteRetryDelay: 250,
          romEraseRetryCount: 2,
          romEraseRetryDelay: 400,
        },
      });

      expect(AdvancedSettings.getSettings().retry).toEqual(expect.objectContaining({
        romWriteRetryCount: 3,
        romWriteRetryDelay: 250,
        romEraseRetryCount: 2,
        romEraseRetryDelay: 400,
      }));
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('setSettings applies validation', () => {
      AdvancedSettings.setSettings({ size: { romPageSize: 10 } });
      expect(AdvancedSettings.romPageSize).toBe(0x40);
    });

    it('setSettings only modifies specified fields', () => {
      AdvancedSettings.setSettings({ timeout: { default: 5000 } });
      expect(AdvancedSettings.defaultTimeout).toBe(5000);
      expect(AdvancedSettings.packageSendTimeout).toBe(3000);
    });

    it('persists configured firmware profile through getSettings', () => {
      AdvancedSettings.setSettings({ firmware: { profile: 'stc' } });

      expect(AdvancedSettings.firmwareProfile).toBe('stc');
      expect(AdvancedSettings.getSettings().firmware).toEqual({ profile: 'stc' });
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('loadSettings', () => {
    it('loads ROM write and erase retry settings from storage', () => {
      localStorageMock.advanced_settings = JSON.stringify({
        retry: {
          romWriteRetryCount: 4,
          romWriteRetryDelay: 125,
          romEraseRetryCount: 5,
          romEraseRetryDelay: 300,
        },
      });

      AdvancedSettings.loadSettings();

      expect(AdvancedSettings.romWriteRetryCount).toBe(4);
      expect(AdvancedSettings.romWriteRetryDelayMs).toBe(125);
      expect(AdvancedSettings.romEraseRetryCount).toBe(5);
      expect(AdvancedSettings.romEraseRetryDelayMs).toBe(300);
    });

    it('loads firmware profile from storage', () => {
      localStorageMock.advanced_settings = JSON.stringify({
        firmware: { profile: 'stc' },
      });

      AdvancedSettings.loadSettings();

      expect(AdvancedSettings.firmwareProfile).toBe('stc');
    });

    it('resets to defaults on invalid JSON', () => {
      localStorageMock.advanced_settings = 'not-json';
      AdvancedSettings.loadSettings();
      expect(AdvancedSettings.romPageSize).toBe(0x200);
    });
  });

  describe('resetToDefaults', () => {
    it('restores all properties to defaults after modification', () => {
      AdvancedSettings.romPageSize = 4096;
      AdvancedSettings.firmwareProfile = 'stc';
      AdvancedSettings.operationTimeout = 60000;
      AdvancedSettings.resetToDefaults();
      expect(AdvancedSettings.romPageSize).toBe(0x200);
      expect(AdvancedSettings.firmwareProfile).toBe('stm');
      expect(AdvancedSettings.operationTimeout).toBe(30000);
    });
  });

  describe('validateSettings', () => {
    it('validates ROM write and erase retry ranges', () => {
      const result = AdvancedSettings.validateSettings({
        retry: {
          romReadCount: 1,
          ramReadCount: 1,
          romReadDelay: 0,
          ramReadDelay: 0,
          romWriteRetryCount: 99,
          romWriteRetryDelay: -1,
          romEraseRetryCount: -2,
          romEraseRetryDelay: 9000,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ROM write retry count must be between 0 and 10');
      expect(result.errors).toContain('ROM write retry delay must be between 0ms and 5000ms');
      expect(result.errors).toContain('ROM erase retry count must be between 0 and 10');
      expect(result.errors).toContain('ROM erase retry delay must be between 0ms and 5000ms');
    });

    it('returns valid for in-range values', () => {
      const result = AdvancedSettings.validateSettings({
        size: { romPageSize: 512, ramPageSize: 256 },
        throttle: { romRead: 100, ramRead: 50 },
        timeout: { default: 3000, packageSend: 3000, packageReceive: 3000, operation: 30000 },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches out-of-range page sizes', () => {
      const result = AdvancedSettings.validateSettings({
        size: { romPageSize: 10, ramPageSize: 100000 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ROM page size must be between 64 and 16384 bytes');
      expect(result.errors).toContain('RAM page size must be between 64 and 16384 bytes');
    });

    it('catches out-of-range timeouts', () => {
      const result = AdvancedSettings.validateSettings({
        timeout: { default: 500, packageSend: 999999, packageReceive: 3000, operation: 30000 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('default timeout must be between 1000ms and 300000ms');
      expect(result.errors).toContain('packageSend timeout must be between 1000ms and 300000ms');
    });
  });

  describe('getLimits', () => {
    it('returns correct limit ranges', () => {
      const limits = AdvancedSettings.getLimits();
      expect(limits.pageSize).toEqual({ min: 0x40, max: 0x4000 });
      expect(limits.throttle).toEqual({ min: 0, max: 1000 });
      expect(limits.retryCount).toEqual({ min: 0, max: 10 });
      expect(limits.retryDelay).toEqual({ min: 0, max: 5000 });
      expect(limits.timeout).toEqual({ min: 1000, max: 300000 });
    });
  });
});
