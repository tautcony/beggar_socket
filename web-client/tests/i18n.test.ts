import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('i18n', () => {
  let localStorageMock: Record<string, string>;
  let navigatorLanguageMock: string;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
      },
      writable: true,
    });

    // Mock navigator.language
    navigatorLanguageMock = 'zh-CN';
    Object.defineProperty(navigator, 'language', {
      get: () => navigatorLanguageMock,
      configurable: true,
    });
  });

  describe('getLanguage function', () => {
    it('应该优先使用localStorage中保存的语言', async () => {
      localStorageMock.locale = 'en-US';
      navigatorLanguageMock = 'ja-JP';

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('en-US');
    });

    it('应该在localStorage无值时使用浏览器语言', async () => {
      navigatorLanguageMock = 'ja-JP';

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('ja-JP');
    });

    it('应该在不支持的语言时使用默认语言', async () => {
      navigatorLanguageMock = 'fr-FR'; // 不支持的语言

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('zh-Hans'); // 默认中文
    });

    it('应该支持部分语言匹配', async () => {
      navigatorLanguageMock = 'en'; // 部分匹配en-US

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('en-US');
    });

    it('应该处理localStorage中的无效语言', async () => {
      localStorageMock.locale = 'invalid-locale';
      navigatorLanguageMock = 'en-US';

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('en-US');
    });
  });

  describe('i18n configuration', () => {
    it('应该包含所有支持的语言', async () => {
      const { messages } = await import('../src/i18n/index');

      expect(messages).toHaveProperty('zh-Hans');
      expect(messages).toHaveProperty('zh-Hant');
      expect(messages).toHaveProperty('en-US');
      expect(messages).toHaveProperty('ja-JP');
      expect(messages).toHaveProperty('ru-RU');
    });

    it('应该包含必要的翻译键', async () => {
      const { messages } = await import('../src/i18n/index');

      const zhHans = messages['zh-Hans'];
      const zhHant = messages['zh-Hant'];
      const enUS = messages['en-US'];
      const jaJP = messages['ja-JP'];
      const ruRU = messages['ru-RU'];

      expect(zhHans).toBeDefined();
      expect(zhHant).toBeDefined();
      expect(enUS).toBeDefined();
      expect(jaJP).toBeDefined();
      expect(ruRU).toBeDefined();

      // 检查所有语言都有相同的键
      expect(zhHans.ui.device.connect).toBeDefined();
      expect(zhHant.ui.device.connect).toBeDefined();
      expect(enUS.ui.device.connect).toBeDefined();
      expect(jaJP.ui.device.connect).toBeDefined();
      expect(ruRU.ui.device.connect).toBeDefined();
    });

    it('应该有正确的翻译内容', async () => {
      const { messages } = await import('../src/i18n/index');

      expect(messages['zh-Hans'].ui.device.connect).toBe('连接设备');
      expect(messages['en-US'].ui.device.connect).toBe('Connect Device');
      expect(messages['ja-JP'].ui.device.connect).toBe('デバイスを接続');
    });

    it('应该创建有效的i18n实例', async () => {
      const { default: i18n } = await import('../src/i18n/index');

      expect(i18n).toBeDefined();
      expect(i18n.global).toBeDefined();
      expect(typeof i18n.global.t).toBe('function');
    });

    it('应该使用正确的fallback语言', async () => {
      const { default: i18n } = await import('../src/i18n/index');

      expect(i18n.global.fallbackLocale.value).toBe('zh-Hans');
    });
  });

  describe('Language detection edge cases', () => {
    it('应该处理空的navigator.language', async () => {
      Object.defineProperty(navigator, 'language', {
        get: () => '',
        configurable: true,
      });

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('zh-Hans');
    });

    it('应该处理undefined的navigator.language', async () => {
      Object.defineProperty(navigator, 'language', {
        get: () => undefined,
        configurable: true,
      });

      const { getLanguage } = await import('../src/i18n/index');
      expect(getLanguage()).toBe('zh-Hans');
    });

    it('应该处理复杂的语言代码', async () => {
      navigatorLanguageMock = 'zh-CN-Hans';

      const { getLanguage } = await import('@/i18n/index');
      expect(getLanguage()).toBe('zh-Hans');
    });
  });
});
