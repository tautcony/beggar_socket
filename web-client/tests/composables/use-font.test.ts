import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import {
  DEFAULT_FONT_FAMILY,
  FONT_OPTIONS,
  FONT_STORAGE_KEY,
  initFont,
  setFont,
  useFont,
} from '@/composables/useFont';
import { initTheme } from '@/composables/useTheme';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('useFont', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => storage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
      },
      writable: true,
      configurable: true,
    });
    document.documentElement.removeAttribute('data-font-family');
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('provides ark-pixel and system font options', () => {
    const { fonts } = useFont();
    expect(fonts).toEqual(FONT_OPTIONS);
    expect(fonts.map((item) => item.id)).toEqual(['ark-pixel', 'system']);
  });

  it('defaults to ark-pixel when storage is empty or invalid', () => {
    expect(initFont()).toBe(DEFAULT_FONT_FAMILY);
    expect(DEFAULT_FONT_FAMILY).toBe('ark-pixel');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('ark-pixel');

    storage[FONT_STORAGE_KEY] = 'unknown-font';
    expect(initFont()).toBe('ark-pixel');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('ark-pixel');
  });

  it('restores saved font from localStorage on initFont', () => {
    storage[FONT_STORAGE_KEY] = 'system';

    const initialized = initFont();
    const { currentFont } = useFont();

    expect(initialized).toBe('system');
    expect(currentFont.value).toBe('system');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('system');
  });

  it('updates DOM attribute and persists selection on setFont', () => {
    initFont();
    setFont('system');

    const { currentFont } = useFont();
    expect(currentFont.value).toBe('system');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('system');
    expect(storage[FONT_STORAGE_KEY]).toBe('system');
  });

  it('allows switching color theme and font inside AdvancedSettingsModal', async () => {
    initTheme();
    initFont();

    const wrapper = mount(AdvancedSettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          Teleport: true,
        },
      },
    });

    const navButtons = wrapper.findAll('.settings-nav-button');
    const appearanceNav = navButtons.find((btn) => btn.text().includes('ui.settings.appearance.title'));
    expect(appearanceNav).toBeDefined();
    await appearanceNav?.trigger('click');

    const themeCards = wrapper.findAll('.theme-option-card');
    expect(themeCards).toHaveLength(3);
    await themeCards[2].trigger('click');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('rose');

    const fontSelect = wrapper.find('#appearance-font-family');
    await fontSelect.setValue('system');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('system');
    await fontSelect.setValue('ark-pixel');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('ark-pixel');
  });
});
