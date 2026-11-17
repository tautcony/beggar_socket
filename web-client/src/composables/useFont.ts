import { readonly, ref } from 'vue';

export type FontFamilyId = 'system' | 'ark-pixel';

export interface FontOption {
  id: FontFamilyId;
  labelKey: string;
}

export const FONT_STORAGE_KEY = 'font_family';
export const DEFAULT_FONT_FAMILY: FontFamilyId = 'ark-pixel';

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'ark-pixel', labelKey: 'ui.settings.appearance.fonts.arkPixel' },
  { id: 'system', labelKey: 'ui.settings.appearance.fonts.system' },
];

const VALID_FONT_IDS = new Set<string>(FONT_OPTIONS.map((item) => item.id));

export function isValidFontFamily(value: unknown): value is FontFamilyId {
  return typeof value === 'string' && VALID_FONT_IDS.has(value);
}

export function normalizeFontFamily(value: unknown): FontFamilyId {
  return isValidFontFamily(value) ? value : DEFAULT_FONT_FAMILY;
}

function applyFontFamilyToDocument(font: FontFamilyId): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-font-family', font);
}

function readStoredFontFamily(): FontFamilyId {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_FONT_FAMILY;
    }
    return normalizeFontFamily(localStorage.getItem(FONT_STORAGE_KEY));
  } catch {
    return DEFAULT_FONT_FAMILY;
  }
}

function writeStoredFontFamily(font: FontFamilyId): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(FONT_STORAGE_KEY, font);
  } catch {
    // ignore storage failures in restricted environments
  }
}

const currentFont = ref<FontFamilyId>(DEFAULT_FONT_FAMILY);

export function initFont(): FontFamilyId {
  const initialFont = readStoredFontFamily();
  currentFont.value = initialFont;
  applyFontFamilyToDocument(initialFont);
  return initialFont;
}

export function setFont(font: FontFamilyId): FontFamilyId {
  const normalized = normalizeFontFamily(font);
  currentFont.value = normalized;
  applyFontFamilyToDocument(normalized);
  writeStoredFontFamily(normalized);
  return normalized;
}

export function useFont() {
  return {
    currentFont: readonly(currentFont),
    fonts: FONT_OPTIONS,
    setFont,
  };
}
