import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeviceCatalog } from '@/device/definitions';
import {
  AdvancedSettings,
  LEGACY_SETTINGS_BACKUP_KEY,
  validateSettings,
} from '@/settings/advanced-settings';
import { ADVANCED_SETTINGS_STORAGE_KEY } from '@/settings/advanced-settings-v2';

type StorageMock = Record<string, string>;

let storage: StorageMock = {};

function installStorage() {
  storage = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        storage = Object.fromEntries(Object.entries(storage).filter(([name]) => name !== key));
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
    },
    writable: true,
  });
}

function readStored(): Record<string, unknown> | null {
  const raw = storage[ADVANCED_SETTINGS_STORAGE_KEY];
  return raw ? JSON.parse(raw) as Record<string, unknown> : null;
}

function writeLegacy(value: unknown): void {
  storage[ADVANCED_SETTINGS_STORAGE_KEY] = typeof value === 'string' ? value : JSON.stringify(value);
}

describe('advanced settings v2 storage', () => {
  beforeEach(() => {
    installStorage();
    AdvancedSettings.resetToDefaults();
    storage = {};
    AdvancedSettings.reloadFromStorage();
  });

  describe('defaults', () => {
    it('starts without a device selection and with the default operation parameters', () => {
      expect(AdvancedSettings.getVariantId()).toBeNull();
      expect(AdvancedSettings.getIndependentSizes()).toBe(false);
      expect(AdvancedSettings.romPageSize).toBe(0x1000);
      expect(AdvancedSettings.romReadPageSize).toBe(0x1000);
      expect(AdvancedSettings.ramPageSize).toBe(0x1000);
      expect(AdvancedSettings.romReadThrottleMs).toBe(0);
      expect(AdvancedSettings.ramReadRetryCount).toBe(1);
      expect(AdvancedSettings.defaultTimeout).toBe(3000);
      expect(AdvancedSettings.operationTimeout).toBe(30000);
      expect(AdvancedSettings.getBaudRate()).toBe('auto');
    });

    it('persists a versioned record with the documented sections', () => {
      AdvancedSettings.setVariantId('beggar-stm');
      const stored = readStored();
      expect(stored).toMatchObject({
        version: 2,
        selectedVariantId: 'beggar-stm',
        independentSizes: false,
      });
      expect(stored).toHaveProperty('parametersByNamespace');
      expect(stored).toHaveProperty('global');
      expect(JSON.stringify(stored)).not.toContain('stmBoost');
    });
  });

  describe('normalization', () => {
    it('clamps and normalizes page sizes per namespace', () => {
      AdvancedSettings.setVariantId('beggar-stm');

      AdvancedSettings.romPageSize = 0x10;
      expect(AdvancedSettings.romPageSize).toBe(0x40);

      AdvancedSettings.romPageSize = 0x10000;
      expect(AdvancedSettings.romPageSize).toBe(0x2000);

      AdvancedSettings.romPageSize = 300;
      expect(AdvancedSettings.romPageSize).toBe(256);

      AdvancedSettings.romReadPageSize = 24576;
      expect(AdvancedSettings.romReadPageSize).toBe(16384);
    });

    it('normalizes the GBFlash namespace independently from the active selection', () => {
      AdvancedSettings.setVariantId('gbflash');
      AdvancedSettings.setNamespaceSize('flashgbx.cfw', 'romPageSize', 0x8000);
      expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').romPageSize).toBe(0x2000);
      // Beggar namespaces keep their own values.
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romPageSize).toBe(0x1000);
    });

    it('clamps throttle, retry and timeout values', () => {
      AdvancedSettings.romReadThrottleMs = -10;
      expect(AdvancedSettings.romReadThrottleMs).toBe(0);
      AdvancedSettings.ramReadThrottleMs = 2000;
      expect(AdvancedSettings.ramReadThrottleMs).toBe(1000);
      AdvancedSettings.romReadThrottleMs = 500.7;
      expect(AdvancedSettings.romReadThrottleMs).toBe(500);

      AdvancedSettings.romReadRetryCount = -1;
      expect(AdvancedSettings.romReadRetryCount).toBe(0);
      AdvancedSettings.romWriteRetryCount = 11;
      expect(AdvancedSettings.romWriteRetryCount).toBe(10);

      AdvancedSettings.operationTimeout = 10;
      expect(AdvancedSettings.operationTimeout).toBe(1000);
    });

    it('accepts only the supported GBFlash baud rates', () => {
      AdvancedSettings.setBaudRate(1500000);
      expect(AdvancedSettings.getBaudRate()).toBe(1500000);
      AdvancedSettings.setBaudRate(9600);
      expect(AdvancedSettings.getBaudRate()).toBe('auto');
    });
  });

  describe('shared and independent packet settings', () => {
    it('keeps STM and Boost on the same namespace value', () => {
      AdvancedSettings.setVariantId('beggar-stm');
      AdvancedSettings.romReadPageSize = 0x800;
      AdvancedSettings.setVariantId('beggar-stm-boost');
      expect(AdvancedSettings.romReadPageSize).toBe(0x800);
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(0x800);
    });

    it('saves STM and STC separately once independent sizes are enabled', () => {
      AdvancedSettings.setIndependentSizes(true);
      AdvancedSettings.setVariantId('beggar-stm');
      AdvancedSettings.setNamespaceSize('beggar.stc', 'romReadPageSize', 0x1000);
      AdvancedSettings.romReadPageSize = 0x4000;

      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(0x4000);
      expect(AdvancedSettings.getNamespaceSizes('beggar.stc').romReadPageSize).toBe(0x1000);
      expect(readStored()).toMatchObject({ independentSizes: true });
    });
  });

  describe('legacy migration', () => {
    it.each([
      ['true', true],
      ['false', false],
      ['missing', undefined],
    ])('migrates a legacy STM selection with stmBoost %s to standard STM', (_label, stmBoost) => {
      writeLegacy({
        firmware: { profile: 'stm', ...(stmBoost === undefined ? {} : { stmBoost }) },
        size: { romPageSize: 0x800, romReadPageSize: 0x800, ramPageSize: 0x800 },
      });

      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.getVariantId()).toBe('beggar-stm');
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm')).toEqual({
        romPageSize: 0x800,
        romReadPageSize: 0x800,
        ramPageSize: 0x800,
      });
      // No one-time Boost prompt marker is written anywhere.
      expect(JSON.stringify(readStored())).not.toContain('stmBoost');
      expect(Object.keys(storage)).not.toContain('stm_boost_prompted');
    });

    it('migrates GBFlash and STC selections with their own parameters', () => {
      writeLegacy({
        firmware: { profile: 'flashgbx', flashgbxBaudRate: 1500000 },
        profileSizes: {
          stm: { romPageSize: 0x800, romReadPageSize: 0x0c00, ramPageSize: 0x800 },
          flashgbx: { romPageSize: 0x100, romReadPageSize: 0x100, ramPageSize: 0x100 },
        },
      });

      AdvancedSettings.reloadFromStorage();
      expect(AdvancedSettings.getVariantId()).toBe('gbflash');
      expect(AdvancedSettings.getBaudRate()).toBe(1500000);
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(0x0c00);

      storage = {};
      writeLegacy({ firmware: { profile: 'stc' } });
      AdvancedSettings.reloadFromStorage();
      expect(AdvancedSettings.getVariantId()).toBe('beggar-stc');
      // Missing baud rate falls back to auto.
      expect(AdvancedSettings.getBaudRate()).toBe('auto');
    });

    it('prefers profileSizes over size and keeps the global parameters', () => {
      writeLegacy({
        firmware: { profile: 'stc' },
        size: { romPageSize: 0x4000, romReadPageSize: 0x4000, ramPageSize: 0x4000 },
        profileSizes: { stc: { romPageSize: 0x800, romReadPageSize: 0x1000, ramPageSize: 0x800 } },
        throttle: { romRead: 12, ramRead: 34 },
        retry: { romReadCount: 3, romWriteRetryCount: 2, romEraseRetryDelay: 250 },
        timeout: { default: 5000, packageSend: 4000, packageReceive: 6000, operation: 60000 },
      });

      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.getNamespaceSizes('beggar.stc')).toEqual({
        romPageSize: 0x800,
        romReadPageSize: 0x1000,
        ramPageSize: 0x800,
      });
      expect(AdvancedSettings.romReadThrottleMs).toBe(12);
      expect(AdvancedSettings.ramReadThrottleMs).toBe(34);
      expect(AdvancedSettings.romReadRetryCount).toBe(3);
      expect(AdvancedSettings.romWriteRetryCount).toBe(2);
      expect(AdvancedSettings.romEraseRetryDelayMs).toBe(250);
      expect(AdvancedSettings.defaultTimeout).toBe(5000);
      expect(AdvancedSettings.packageReceiveTimeout).toBe(6000);
      expect(AdvancedSettings.operationTimeout).toBe(60000);
    });

    it('replaces the historical placeholder page sizes with the host defaults', () => {
      writeLegacy({
        firmware: { profile: 'stm' },
        size: { romPageSize: 0x200, romReadPageSize: 3072, ramPageSize: 0x100 },
      });

      AdvancedSettings.reloadFromStorage();

      const sizes = AdvancedSettings.getNamespaceSizes('beggar.stm');
      expect(sizes.romPageSize).toBe(0x1000);
      expect(sizes.ramPageSize).toBe(0x1000);
      expect(sizes.romReadPageSize).toBe(3072);
    });

    it('backs up the raw v1 record once and writes v2', () => {
      const legacy = { firmware: { profile: 'stc' }, size: { romPageSize: 0x800 } };
      writeLegacy(legacy);

      AdvancedSettings.reloadFromStorage();

      expect(storage[LEGACY_SETTINGS_BACKUP_KEY]).toBe(JSON.stringify(legacy));
      expect(readStored()).toMatchObject({ version: 2, selectedVariantId: 'beggar-stc' });
    });

    it('does not overwrite values saved later when loaded again', () => {
      writeLegacy({ firmware: { profile: 'stc' }, size: { romPageSize: 0x800 } });
      AdvancedSettings.reloadFromStorage();

      AdvancedSettings.romPageSize = 0x400;
      AdvancedSettings.reloadFromStorage();
      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.romPageSize).toBe(0x400);
      expect(AdvancedSettings.getVariantId()).toBe('beggar-stc');
    });

    it('loads defaults in memory without writing back an unknown version', () => {
      const unsupported = JSON.stringify({ version: 99, selectedVariantId: 'beggar-stm' });
      storage[ADVANCED_SETTINGS_STORAGE_KEY] = unsupported;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const outcome = AdvancedSettings.reloadFromStorage();

      expect(outcome).toEqual({ kind: 'unsupported', version: 99 });
      expect(AdvancedSettings.getVariantId()).toBeNull();
      expect(AdvancedSettings.romPageSize).toBe(0x1000);
      expect(storage[ADVANCED_SETTINGS_STORAGE_KEY]).toBe(unsupported);
      warn.mockRestore();
    });

    it('loads defaults in memory and leaves malformed JSON untouched', () => {
      storage[ADVANCED_SETTINGS_STORAGE_KEY] = '{not json';
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const outcome = AdvancedSettings.reloadFromStorage();

      expect(outcome.kind).toBe('malformed');
      expect(AdvancedSettings.getVariantId()).toBeNull();
      expect(storage[ADVANCED_SETTINGS_STORAGE_KEY]).toBe('{not json');
      warn.mockRestore();
    });

    it('keeps an unregistered stored variant verbatim so the selection reports invalid', () => {
      storage[ADVANCED_SETTINGS_STORAGE_KEY] = JSON.stringify({
        version: 2,
        selectedVariantId: 'retired-variant',
        parametersByNamespace: {},
        global: {},
        independentSizes: false,
      });

      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.getVariantId()).toBe('retired-variant');
    });
  });

  describe('schema driven validation', () => {
    const registry = createDeviceCatalog({ platform: 'windows' });

    it('validates values against the namespace descriptor ranges', () => {
      const schema = registry.resolveNamespaceSchema('flashgbx.cfw')?.schema ?? [];

      expect(validateSettings(schema, { romPageSize: 0x2000 }).valid).toBe(true);
      const tooLarge = validateSettings(schema, { romPageSize: 0x4000 });
      expect(tooLarge.valid).toBe(false);
      expect(tooLarge.errors[0]).toContain('ROM page size');

      const baud = validateSettings(schema, { baudRate: 9600 });
      expect(baud.valid).toBe(false);
    });

    it('keeps the existing limits table available for the UI', () => {
      const limits = AdvancedSettings.getLimits();
      expect(limits.pageSize).toEqual({ min: 0x40, max: 0x2000 });
      expect(limits.readPageSize).toEqual({ min: 0x40, max: 0x8000 });
      expect(limits.timeout).toEqual({ min: 1000, max: 300000 });
    });
  });
});
