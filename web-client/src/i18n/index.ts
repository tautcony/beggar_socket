import { createI18n } from 'vue-i18n';

import enUS from '@/i18n/locales/en-US.json';
import jaJP from '@/i18n/locales/ja-JP.json';
import ruRU from '@/i18n/locales/ru-RU.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';

export const messages = {
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

export function getLanguage() {
  // 首先检查本地存储
  const savedLocale = localStorage.getItem('locale');
  if (savedLocale && Object.keys(messages).includes(savedLocale)) {
    return savedLocale;
  }

  // 然后检查浏览器语言
  const language = navigator.language;
  const locales = Object.keys(messages);

  // 完全匹配
  if (locales.includes(language)) {
    return language;
  }

  // 部分匹配 (比如 ja 匹配 ja-JP)
  for (const locale of locales) {
    if (language?.startsWith(locale.split('-')[0])) {
      return locale;
    }
  }

  return 'zh-CN';
}

const i18n = createI18n({
  legacy: false,
  locale: getLanguage(),
  fallbackLocale: 'zh-CN',
  messages,
});

export default i18n;
