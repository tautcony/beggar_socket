import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import {
  DEFAULT_COLOR_THEME,
  initTheme,
  setTheme,
  THEME_PALETTES,
  THEME_STORAGE_KEY,
  useTheme,
} from '@/composables/useTheme';

describe('useTheme', () => {
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
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('provides lavender, sage, and rose themes with expected swatches', () => {
    const { themes } = useTheme();
    expect(themes).toEqual(THEME_PALETTES);
    expect(themes.map((item) => [item.id, item.swatch])).toEqual([
      ['lavender', '#BFA9E2'],
      ['sage', '#B4C3A1'],
      ['rose', '#DF9AB0'],
    ]);
  });

  it('defaults to lavender when storage is empty or invalid', () => {
    expect(initTheme()).toBe(DEFAULT_COLOR_THEME);
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('lavender');

    storage[THEME_STORAGE_KEY] = 'unknown-theme';
    expect(initTheme()).toBe('lavender');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('lavender');
  });

  it('restores saved theme from localStorage on initTheme', () => {
    storage[THEME_STORAGE_KEY] = 'rose';

    const initialized = initTheme();
    const { currentTheme } = useTheme();

    expect(initialized).toBe('rose');
    expect(currentTheme.value).toBe('rose');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('rose');
  });

  it('updates DOM attribute and persists selection on setTheme', () => {
    initTheme();
    setTheme('sage');

    const { currentTheme } = useTheme();
    expect(currentTheme.value).toBe('sage');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('sage');
    expect(storage[THEME_STORAGE_KEY]).toBe('sage');
  });

  it('falls back gracefully when localStorage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => {
          throw new Error('denied');
        }),
        setItem: vi.fn(() => {
          throw new Error('denied');
        }),
      },
      writable: true,
      configurable: true,
    });

    expect(initTheme()).toBe('lavender');
    expect(() => setTheme('rose')).not.toThrow();
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('rose');
  });

  it('renders ThemeSwitcher swatches and switches theme on click', async () => {
    initTheme();
    const wrapper = mount(ThemeSwitcher, {
      props: { inline: true },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    const buttons = wrapper.findAll('.theme-swatch-btn');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].attributes('aria-pressed')).toBe('true');

    await buttons[1].trigger('click');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('sage');
    expect(buttons[1].attributes('aria-pressed')).toBe('true');

    await buttons[2].trigger('click');
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('rose');
    expect(buttons[2].attributes('aria-pressed')).toBe('true');
  });
});
