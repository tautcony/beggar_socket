/**
 * Legacy settings adapter: the only place the core device layer touches v1 storage.
 *
 * P3 replaces this with the v2 namespace storage; the `LegacySettingsAdapter` contract
 * stays so lifecycle dependencies do not change.
 */
import type { LegacySettingsAdapter, LegacySettingsView, ParameterValue, SizeSettings } from '@/device/parameters';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { ConfigurableFirmwareProfileId } from '@/types/firmware-profile';

const NAMESPACE_TO_LEGACY_PROFILE: Readonly<Record<string, ConfigurableFirmwareProfileId>> = {
  'beggar.stm': 'stm',
  'beggar.stc': 'stc',
  'flashgbx.cfw': 'flashgbx',
};

const SIZE_KEYS = ['romPageSize', 'romReadPageSize', 'ramPageSize'] as const;

function isSizeKey(key: string): key is (typeof SIZE_KEYS)[number] {
  return (SIZE_KEYS as readonly string[]).includes(key);
}

function legacyBag(): Record<string, unknown> {
  return AdvancedSettings as unknown as Record<string, unknown>;
}

function readGlobal(key: string): number | undefined {
  const value = legacyBag()[key];
  return typeof value === 'number' ? value : undefined;
}

export function createLegacySettingsAdapter(): LegacySettingsAdapter {
  return {
    readLegacyProfileId(): string {
      return AdvancedSettings.firmwareProfile;
    },

    readParameter(namespace: string, key: string): unknown {
      if (namespace === 'global') {
        return readGlobal(key);
      }
      const profile = NAMESPACE_TO_LEGACY_PROFILE[namespace];
      if (!profile) {
        return undefined;
      }
      if (isSizeKey(key)) {
        return AdvancedSettings.getProfileSizes(profile)[key];
      }
      if (key === 'baudRate') {
        return AdvancedSettings.flashgbxBaudRate;
      }
      return undefined;
    },

    writeParameter(namespace: string, key: string, value: ParameterValue): void {
      if (namespace === 'global') {
        legacyBag()[key] = value;
        AdvancedSettings.saveSettings();
        return;
      }
      const profile = NAMESPACE_TO_LEGACY_PROFILE[namespace];
      if (!profile) {
        throw new Error(`LegacySettingsAdapter: namespace ${namespace} has no legacy mapping`);
      }
      if (isSizeKey(key) && typeof value === 'number') {
        AdvancedSettings.setProfileSize(profile, key, value);
        return;
      }
      if (key === 'baudRate') {
        AdvancedSettings.flashgbxBaudRate = value as typeof AdvancedSettings.flashgbxBaudRate;
        return;
      }
      throw new Error(`LegacySettingsAdapter: parameter ${namespace}.${key} has no legacy field`);
    },

    readView(): LegacySettingsView {
      const profileSizes: Record<string, SizeSettings> = {};
      for (const [namespace, profile] of Object.entries(NAMESPACE_TO_LEGACY_PROFILE)) {
        profileSizes[namespace] = AdvancedSettings.getProfileSizes(profile);
      }
      return {
        firmwareProfile: AdvancedSettings.firmwareProfile,
        stmBoost: AdvancedSettings.stmBoost,
        flashgbxBaudRate: AdvancedSettings.flashgbxBaudRate,
        profileSizes,
      };
    },
  };
}
