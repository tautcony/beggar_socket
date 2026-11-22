import type {
  LegacySettingsAdapter,
  LegacySettingsView,
  ParameterValue,
  SizeSettings,
} from '@/device/parameters';

export interface FakeLegacySettings {
  adapter: LegacySettingsAdapter;
  /** Namespaced / global values read by the adapter. */
  values: Map<string, ParameterValue>;
  profileSizes: Record<string, SizeSettings>;
  legacyProfileId: string;
  stmBoost: boolean;
  flashgbxBaudRate: 'auto' | number;
  selectedVariantId: string | null;
  writes: { namespace: string; key: string; value: ParameterValue }[];
}

function key(namespace: string, name: string): string {
  return `${namespace}.${name}`;
}

const NAMESPACE_PROFILE: Readonly<Record<string, string>> = {
  'beggar.stm': 'stm',
  'beggar.stc': 'stc',
  'flashgbx.cfw': 'flashgbx',
};

const SIZE_KEYS: readonly (keyof SizeSettings)[] = ['romPageSize', 'romReadPageSize', 'ramPageSize'];

export function createFakeLegacySettings(
  options: { legacyProfileId?: string; stmBoost?: boolean } = {},
): FakeLegacySettings {
  const fake: FakeLegacySettings = {
    values: new Map<string, ParameterValue>(),
    profileSizes: {
      stm: { romPageSize: 0x1000, romReadPageSize: 0x1000, ramPageSize: 0x1000 },
      stc: { romPageSize: 0x1000, romReadPageSize: 0x2000, ramPageSize: 0x1000 },
      flashgbx: { romPageSize: 0x100, romReadPageSize: 0x100, ramPageSize: 0x100 },
    },
    legacyProfileId: options.legacyProfileId ?? 'stm',
    stmBoost: options.stmBoost ?? false,
    flashgbxBaudRate: 'auto',
    selectedVariantId: null,
    writes: [],
    adapter: undefined as unknown as LegacySettingsAdapter,
  };

  function readView(): LegacySettingsView {
    return {
      firmwareProfile: fake.legacyProfileId,
      stmBoost: fake.stmBoost,
      flashgbxBaudRate: fake.flashgbxBaudRate,
      profileSizes: fake.profileSizes,
    };
  }

  fake.adapter = {
    readLegacyProfileId: () => fake.legacyProfileId,
    readSelectionV2: () => fake.selectedVariantId,
    readParameter(namespace: string, name: string): unknown {
      if (namespace === 'global') {
        return fake.values.get(key('global', name));
      }
      const profile = NAMESPACE_PROFILE[namespace];
      if (profile && (SIZE_KEYS as readonly string[]).includes(name)) {
        return fake.profileSizes[profile][name as keyof SizeSettings];
      }
      if (name === 'baudRate') {
        return fake.flashgbxBaudRate;
      }
      return fake.values.get(key(namespace, name));
    },
    writeParameter(namespace: string, name: string, value: ParameterValue): void {
      fake.writes.push({ namespace, key: name, value });
      const profile = NAMESPACE_PROFILE[namespace];
      if (profile && (SIZE_KEYS as readonly string[]).includes(name) && typeof value === 'number') {
        fake.profileSizes[profile][name as keyof SizeSettings] = value;
        return;
      }
      if (name === 'baudRate' && (value === 'auto' || typeof value === 'number')) {
        fake.flashgbxBaudRate = value;
        return;
      }
      fake.values.set(key(namespace, name), value);
    },
    readView,
  };

  return fake;
}
