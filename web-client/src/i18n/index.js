import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import jaJP from './locales/ja-JP.json'

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP
}

const datetimeFormats = {
  'zh-CN': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }
  },
  'en-US': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }
  },
  'ja-JP': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }
  }
}

const numberFormats = {
  'zh-CN': {
    bytes: {
      style: 'decimal',
      notation: 'compact',
      maximumFractionDigits: 2
    }
  },
  'en-US': {
    bytes: {
      style: 'decimal',
      notation: 'compact',
      maximumFractionDigits: 2
    }
  },
  'ja-JP': {
    bytes: {
      style: 'decimal',
      notation: 'compact',
      maximumFractionDigits: 2
    }
  }
}

// 获取浏览器语言，如果不支持则默认为中文
function getLanguage() {
  // 首先检查本地存储
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale && Object.keys(messages).includes(savedLocale)) {
    return savedLocale
  }
  
  // 然后检查浏览器语言
  const language = navigator.language || navigator.userLanguage
  const locales = Object.keys(messages)
  
  // 完全匹配
  if (locales.includes(language)) {
    return language
  }
  
  // 部分匹配 (比如 ja 匹配 ja-JP)
  for (const locale of locales) {
    if (language.indexOf(locale.split('-')[0]) > -1) {
      return locale
    }
  }
  
  return 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  locale: getLanguage(),
  fallbackLocale: 'zh-CN',
  messages,
  datetimeFormats,
  numberFormats
})

export default i18n
