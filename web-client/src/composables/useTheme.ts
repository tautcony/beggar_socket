import { readonly, ref } from 'vue';

export type ColorThemeId = 'lavender' | 'sage' | 'rose';

export interface ThemePaletteOption {
  id: ColorThemeId;
  swatch: string;
  labelKey: string;
}

export const THEME_STORAGE_KEY = 'color_theme';
export const DEFAULT_COLOR_THEME: ColorThemeId = 'lavender';

export const THEME_PALETTES: readonly ThemePaletteOption[] = [
  { id: 'lavender', swatch: '#BFA9E2', labelKey: 'ui.theme.lavender' },
  { id: 'sage', swatch: '#B4C3A1', labelKey: 'ui.theme.sage' },
  { id: 'rose', swatch: '#DF9AB0', labelKey: 'ui.theme.rose' },
];

const VALID_THEME_IDS = new Set<string>(THEME_PALETTES.map((item) => item.id));

export function isValidColorTheme(value: unknown): value is ColorThemeId {
  return typeof value === 'string' && VALID_THEME_IDS.has(value);
}

export function normalizeColorTheme(value: unknown): ColorThemeId {
  return isValidColorTheme(value) ? value : DEFAULT_COLOR_THEME;
}

function applyColorThemeToDocument(theme: ColorThemeId): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-color-theme', theme);
}

function readStoredColorTheme(): ColorThemeId {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_COLOR_THEME;
    }
    return normalizeColorTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_COLOR_THEME;
  }
}

function writeStoredColorTheme(theme: ColorThemeId): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage failures in restricted environments
  }
}

const currentTheme = ref<ColorThemeId>(DEFAULT_COLOR_THEME);

export function initTheme(): ColorThemeId {
  const initialTheme = readStoredColorTheme();
  currentTheme.value = initialTheme;
  applyColorThemeToDocument(initialTheme);
  return initialTheme;
}

export function setTheme(theme: ColorThemeId): ColorThemeId {
  const normalized = normalizeColorTheme(theme);
  currentTheme.value = normalized;
  applyColorThemeToDocument(normalized);
  writeStoredColorTheme(normalized);
  return normalized;
}

export function useTheme() {
  return {
    currentTheme: readonly(currentTheme),
    themes: THEME_PALETTES,
    setTheme,
  };
}
