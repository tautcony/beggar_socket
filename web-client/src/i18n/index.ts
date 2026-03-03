import { createI18n } from 'vue-i18n';

import enUS from '@/i18n/locales/en-US.json';
import jaJP from '@/i18n/locales/ja-JP.json';
import ruRU from '@/i18n/locales/ru-RU.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';

export const messages = {
  zh: zhHans,
  'zh-Hans': zhHans,
  'zh-CN': zhHans,
  'zh-Hant': zhHant,
  'zh-TW': zhHant,
  'zh-HK': zhHant,
  'zh-MO': zhHant,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ru-RU': ruRU,
};

const UI_LOCALES = ['zh-Hans', 'zh-Hant', 'en-US', 'ja-JP', 'ru-RU'] as const;
const UI_LOCALE_SET = new Set<string>(UI_LOCALES);

const localeAliasMap: Record<string, (typeof UI_LOCALES)[number]> = {
  zh: 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-hans': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  'zh-hant': 'zh-Hant',
  en: 'en-US',
  'en-us': 'en-US',
  ja: 'ja-JP',
  'ja-jp': 'ja-JP',
  ru: 'ru-RU',
  'ru-ru': 'ru-RU',
};

export function normalizeLocale(locale: string | null | undefined): (typeof UI_LOCALES)[number] | null {
  if (!locale) {
    return null;
  }

  const trimmed = locale.trim();
  if (!trimmed) {
    return null;
  }

  if (UI_LOCALE_SET.has(trimmed)) {
    return trimmed as (typeof UI_LOCALES)[number];
  }

  const exactAlias = localeAliasMap[trimmed.toLowerCase()];
  if (exactAlias) {
    return exactAlias;
  }

  const base = trimmed.split('-')[0]?.toLowerCase();
  if (!base) {
    return null;
  }

  return localeAliasMap[base] ?? null;
}

function readSavedLocale(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem('locale');
  } catch {
    return null;
  }
}

export function getLanguage(): (typeof UI_LOCALES)[number] {
  const savedLocale = normalizeLocale(readSavedLocale());
  if (savedLocale) {
    return savedLocale;
  }

  const browserLocale = typeof navigator === 'undefined' ? '' : navigator.language;
  const normalizedBrowserLocale = normalizeLocale(browserLocale);
  if (normalizedBrowserLocale) {
    return normalizedBrowserLocale;
  }

  return 'zh-Hans';
}

const i18n = createI18n({
  legacy: false,
  locale: getLanguage(),
  fallbackLocale: 'zh-Hans',
  messages,
});

export default i18n;
