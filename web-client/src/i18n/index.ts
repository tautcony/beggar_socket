import { createI18n } from 'vue-i18n';

import enUS from '@/i18n/locales/en-US.json';
import jaJP from '@/i18n/locales/ja-JP.json';
import zhCN from '@/i18n/locales/zh-CN.json';

export const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
};

// 获取浏览器语言，如果不支持则默认为中文
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
    if (navigator.language && language.includes(locale.split('-')[0])) {
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
