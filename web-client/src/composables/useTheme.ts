import { readonly, ref } from 'vue';

export type ColorThemeId = 'lavender' | 'sage' | 'rose';
export type ColorModeId = 'system' | 'light' | 'dark';

export interface ThemePaletteOption {
  id: ColorThemeId;
  swatch: string;
  labelKey: string;
}

export interface ColorModeOption {
  id: ColorModeId;
  labelKey: string;
}

export const THEME_STORAGE_KEY = 'color_theme';
export const DEFAULT_COLOR_THEME: ColorThemeId = 'lavender';

export const COLOR_MODE_STORAGE_KEY = 'color_mode';
export const DEFAULT_COLOR_MODE: ColorModeId = 'system';

export const THEME_PALETTES: readonly ThemePaletteOption[] = [
  { id: 'lavender', swatch: '#BFA9E2', labelKey: 'ui.theme.lavender' },
  { id: 'sage', swatch: '#B4C3A1', labelKey: 'ui.theme.sage' },
  { id: 'rose', swatch: '#DF9AB0', labelKey: 'ui.theme.rose' },
];

export const COLOR_MODES: readonly ColorModeOption[] = [
  { id: 'system', labelKey: 'ui.settings.appearance.colorModeSystem' },
  { id: 'light', labelKey: 'ui.settings.appearance.colorModeLight' },
  { id: 'dark', labelKey: 'ui.settings.appearance.colorModeDark' },
];

const VALID_THEME_IDS = new Set<string>(THEME_PALETTES.map((item) => item.id));
const VALID_COLOR_MODE_IDS = new Set<string>(COLOR_MODES.map((item) => item.id));

export function isValidColorTheme(value: unknown): value is ColorThemeId {
  return typeof value === 'string' && VALID_THEME_IDS.has(value);
}

export function normalizeColorTheme(value: unknown): ColorThemeId {
  return isValidColorTheme(value) ? value : DEFAULT_COLOR_THEME;
}

export function isValidColorMode(value: unknown): value is ColorModeId {
  return typeof value === 'string' && VALID_COLOR_MODE_IDS.has(value);
}

export function normalizeColorMode(value: unknown): ColorModeId {
  return isValidColorMode(value) ? value : DEFAULT_COLOR_MODE;
}

function applyColorThemeToDocument(theme: ColorThemeId): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-color-theme', theme);
}

function applyColorModeToDocument(mode: ColorModeId): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = 'light dark';
  } else {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
  }
}

function readStoredValue<T extends string>(key: string, normalize: (v: unknown) => T): T {
  try {
    if (typeof localStorage === 'undefined') {
      return normalize(undefined);
    }
    return normalize(localStorage.getItem(key));
  } catch {
    return normalize(undefined);
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in restricted environments
  }
}

const currentTheme = ref<ColorThemeId>(DEFAULT_COLOR_THEME);
const currentColorMode = ref<ColorModeId>(DEFAULT_COLOR_MODE);

export function initTheme(): ColorThemeId {
  const initialTheme = readStoredValue(THEME_STORAGE_KEY, normalizeColorTheme);
  const initialMode = readStoredValue(COLOR_MODE_STORAGE_KEY, normalizeColorMode);
  currentTheme.value = initialTheme;
  currentColorMode.value = initialMode;
  applyColorThemeToDocument(initialTheme);
  applyColorModeToDocument(initialMode);
  return initialTheme;
}

export function setTheme(theme: ColorThemeId): ColorThemeId {
  const normalized = normalizeColorTheme(theme);
  currentTheme.value = normalized;
  applyColorThemeToDocument(normalized);
  writeStoredValue(THEME_STORAGE_KEY, normalized);
  return normalized;
}

export function setColorMode(mode: ColorModeId): ColorModeId {
  const normalized = normalizeColorMode(mode);
  currentColorMode.value = normalized;
  applyColorModeToDocument(normalized);
  writeStoredValue(COLOR_MODE_STORAGE_KEY, normalized);
  return normalized;
}

export function useTheme() {
  return {
    currentTheme: readonly(currentTheme),
    themes: THEME_PALETTES,
    setTheme,
    currentColorMode: readonly(currentColorMode),
    colorModes: COLOR_MODES,
    setColorMode,
  };
}
