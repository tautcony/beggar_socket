import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDeviceCatalog } from '@/device/definitions';
import { detectHostPlatform } from '@/platform/serial/platform-packet-policy';
import {
  AdvancedSettings,
  LEGACY_SETTINGS_BACKUP_KEY,
  validateSettings,
} from '@/settings/advanced-settings';
import { ADVANCED_SETTINGS_STORAGE_KEY, defaultSizesForNamespace } from '@/settings/advanced-settings-v2';

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

/**
 * Ceilings of the STM namespace as the runtime resolves them.
 *
 * The compatibility accessors clamp to the descriptor now, so an assertion reads the same bound
 * the code reads instead of a number that only holds for one host.
 */
function stmCeilings(): { romPageMax: number; romReadMax: number } {
  const schema = createDeviceCatalog({ platform: detectHostPlatform() })
    .resolveNamespaceSchema('beggar.stm')?.schema ?? [];
  const bound = (key: string) => schema.find(item => item.key === key)?.constraints?.max ?? 0;
  return { romPageMax: bound('romPageSize'), romReadMax: bound('romReadPageSize') };
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
      const { romPageMax, romReadMax } = stmCeilings();
      AdvancedSettings.setVariantId('beggar-stm');

      AdvancedSettings.romPageSize = 0x10;
      expect(AdvancedSettings.romPageSize).toBe(0x40);

      AdvancedSettings.romPageSize = 0x10000;
      expect(AdvancedSettings.romPageSize).toBe(romPageMax);

      AdvancedSettings.romPageSize = 300;
      expect(AdvancedSettings.romPageSize).toBe(256);

      AdvancedSettings.romReadPageSize = romReadMax * 2;
      expect(AdvancedSettings.romReadPageSize).toBe(romReadMax);
    });

    it('normalizes the GBFlash namespace independently from the active selection', () => {
      AdvancedSettings.setVariantId('gbflash');
      AdvancedSettings.setNamespaceSize('flashgbx.cfw', 'romPageSize', 0x8000);
      expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').romPageSize).toBe(0x2000);
      // Beggar namespaces keep their own values.
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romPageSize).toBe(0x1000);
    });

    it('accepts the descriptor boundaries and keeps the 0x0c00 step', () => {
      AdvancedSettings.setVariantId('beggar-stm');

      AdvancedSettings.romPageSize = 0x40;
      expect(AdvancedSettings.romPageSize).toBe(0x40);
      // macOS/Linux converge on 3072B, which is not a power of two and must stay legal.
      AdvancedSettings.romPageSize = 0x0c00;
      expect(AdvancedSettings.romPageSize).toBe(0x0c00);

      AdvancedSettings.romReadThrottleMs = 1000;
      AdvancedSettings.romReadRetryCount = 10;
      AdvancedSettings.defaultTimeout = 300000;
      AdvancedSettings.operationTimeout = 1000;
      expect(AdvancedSettings.romReadThrottleMs).toBe(1000);
      expect(AdvancedSettings.romReadRetryCount).toBe(10);
      expect(AdvancedSettings.defaultTimeout).toBe(300000);
      expect(AdvancedSettings.operationTimeout).toBe(1000);
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
      const { romReadMax } = stmCeilings();
      AdvancedSettings.setIndependentSizes(true);
      AdvancedSettings.setVariantId('beggar-stm');
      AdvancedSettings.setNamespaceSize('beggar.stc', 'romReadPageSize', 0x400);
      AdvancedSettings.romReadPageSize = romReadMax;

      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(romReadMax);
      expect(AdvancedSettings.getNamespaceSizes('beggar.stc').romReadPageSize).toBe(0x400);
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

    it('ignores the whole legacy size bag once profileSizes exists', () => {
      // v1 only read `size` when `profileSizes` was absent, so a partial per-profile record
      // must not be patched key by key from the stale flat bag.
      writeLegacy({
        firmware: { profile: 'stc' },
        profileSizes: { stc: { romPageSize: 0x800 } },
        size: { romPageSize: 0x400, romReadPageSize: 0x400, ramPageSize: 0x400 },
      });

      AdvancedSettings.reloadFromStorage();

      const defaults = defaultSizesForNamespace('beggar.stc');
      const sizes = AdvancedSettings.getNamespaceSizes('beggar.stc');
      expect(sizes.romPageSize).toBe(0x800);
      expect(sizes.romReadPageSize).toBe(defaults.romReadPageSize);
      expect(sizes.ramPageSize).toBe(defaults.ramPageSize);
      expect(AdvancedSettings.getIndependentSizes()).toBe(true);
    });

    it('does not leak a FlashGBX size bag into the Beggar namespaces', () => {
      // Linked sizes only link the namespaces that declare the link group. A GBFlash `size`
      // says nothing about the Beggar packet sizes, so it stays in its own namespace.
      writeLegacy({
        firmware: { profile: 'flashgbx' },
        size: { romPageSize: 0x100, romReadPageSize: 0x100, ramPageSize: 0x100 },
      });

      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').romPageSize).toBe(0x100);
      for (const namespace of ['beggar.stm', 'beggar.stc']) {
        const sizes = AdvancedSettings.getNamespaceSizes(namespace);
        const defaults = defaultSizesForNamespace(namespace);
        expect(sizes).toEqual(defaults);
      }
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

    it('never serves a persisted value the schema cannot accept', () => {
      // A v2 record can hold anything a previous build wrote. The read path validates it with
      // the same descriptors the store and the form use, so an impossible baud rate or an
      // out-of-range timeout cannot reach a connection plan.
      storage[ADVANCED_SETTINGS_STORAGE_KEY] = JSON.stringify({
        version: 2,
        selectedVariantId: 'gbflash',
        parametersByNamespace: {
          'flashgbx.cfw': { baudRate: 123456, romPageSize: 0x4000, ramPageSize: 'bogus' },
          'beggar.stm': { romReadPageSize: 0x4000 },
        },
        global: { defaultTimeout: 999999, romReadRetryCount: 'many' },
        independentSizes: false,
      });

      AdvancedSettings.reloadFromStorage();

      expect(AdvancedSettings.getBaudRate()).toBe('auto');
      // Clamped to the GBFlash packet ceiling, and the unusable string falls back to default.
      expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').romPageSize).toBe(0x2000);
      expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').ramPageSize)
        .toBe(defaultSizesForNamespace('flashgbx.cfw').ramPageSize);
      expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize)
        .toBe(stmCeilings().romReadMax);
      expect(AdvancedSettings.defaultTimeout).toBe(300000);
      expect(AdvancedSettings.romReadRetryCount).toBe(1);
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

    it('validates persisted page sizes with the same descriptor the form uses', () => {
      // No second limits table: the ceiling of a namespace is its descriptor, and the form,
      // the store and this validator all read it.
      const schema = registry.resolveNamespaceSchema('beggar.stm')?.schema ?? [];
      const romPage = schema.find(descriptor => descriptor.key === 'romPageSize');

      expect(romPage?.constraints?.min).toBe(0x40);
      expect(romPage?.alignment).toBe(0x40);
      expect(validateSettings(schema, { romPageSize: 0x1000 }).valid).toBe(true);
      expect(validateSettings(schema, { romPageSize: 0x60 }).errors[0]).toContain('aligned');
    });
  });
});
