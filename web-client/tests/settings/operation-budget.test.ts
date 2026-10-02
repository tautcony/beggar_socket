import { beforeEach, describe, expect, it } from 'vitest';

import { AdvancedSettings } from '@/settings/advanced-settings';

describe('operation budget settings', () => {
  beforeEach(() => { localStorage.clear(); AdvancedSettings.resetToDefaults(); });
  it('defaults off and persists explicit booleans', () => {
    expect(AdvancedSettings.operationBudgetEnabled).toBe(false);
    AdvancedSettings.operationBudgetEnabled = true;
    AdvancedSettings.loadSettings();
    expect(AdvancedSettings.operationBudgetEnabled).toBe(true);
    AdvancedSettings.operationBudgetEnabled = false;
    const saved: unknown = JSON.parse(localStorage.getItem('advanced_settings') ?? '{}');
    expect(saved).toMatchObject({ timeout: { operationBudgetEnabled: false } });
  });
  it.each([0, 1, 'true', null, {}, []])('rejects nonboolean %j atomically', value => {
    const before = AdvancedSettings.getSettings();
    const candidate = { size: { romPageSize: 512 }, timeout: { operationBudgetEnabled: value } };
    expect(AdvancedSettings.validateSettings(candidate).valid).toBe(false);
    expect(() => { AdvancedSettings.setSettings(candidate as never); }).toThrow('boolean');
    expect(AdvancedSettings.getSettings()).toEqual(before);
  });
  it.each([undefined, 1])('loads old snapshot version %s without enabling budgets', version => {
    AdvancedSettings.operationBudgetEnabled = true;
    localStorage.setItem('advanced_settings', JSON.stringify({ ...(version ? { version } : {}), size: { romPageSize: 512 }, timeout: { operation: 9000 } }));
    AdvancedSettings.loadSettings();
    expect(AdvancedSettings.operationBudgetEnabled).toBe(false);
    expect(AdvancedSettings.operationTimeout).toBe(9000);
    expect(AdvancedSettings.romPageSize).toBe(512);
  });
});
