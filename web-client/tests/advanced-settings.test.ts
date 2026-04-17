/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdvancedSettings } from '../src/settings/advanced-settings';

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

  it('exposes ROM write and erase retry settings with defaults', () => {
    expect(AdvancedSettings.romWriteRetryCount).toBe(1);
    expect(AdvancedSettings.romWriteRetryDelayMs).toBe(0);
    expect(AdvancedSettings.romEraseRetryCount).toBe(1);
    expect(AdvancedSettings.romEraseRetryDelayMs).toBe(0);
  });

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
});
