import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LanguageSwitcher from '../src/components/LanguageSwitcher.vue';

// Mock vue-i18n
const mockLocale = { value: 'zh-CN' };
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: mockLocale,
  }),
}));

// Mock @ionic/vue
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    props: ['name'],
    template: '<div class="ion-icon" :data-name="name"></div>',
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale.value = 'zh-CN';
  });

  it('应该正确渲染组件', () => {
    const wrapper = mount(LanguageSwitcher);

    expect(wrapper.find('.language-switcher').exists()).toBe(true);
    expect(wrapper.find('.language-select').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IonIcon' }).exists()).toBe(true);
  });

  it('应该显示正确的图标', () => {
    const wrapper = mount(LanguageSwitcher);
    const icon = wrapper.findComponent({ name: 'IonIcon' });

    expect(icon.props('name')).toBe('globe-outline');
  });

  it('应该显示所有语言选项', () => {
    const wrapper = mount(LanguageSwitcher);
    const options = wrapper.findAll('option');

    expect(options).toHaveLength(3);
    expect(options[0].attributes('value')).toBe('zh-CN');
    expect(options[0].text()).toBe('中文');
    expect(options[1].attributes('value')).toBe('en-US');
    expect(options[1].text()).toBe('English');
    expect(options[2].attributes('value')).toBe('ja-JP');
    expect(options[2].text()).toBe('日本語');
  });

  it('应该使用当前locale作为默认值', () => {
    mockLocale.value = 'en-US';
    const wrapper = mount(LanguageSwitcher);
    const select = wrapper.find('.language-select');

    expect((select.element as HTMLInputElement).value).toBe('en-US');
  });

  it('应该在语言改变时更新locale', async () => {
    const wrapper = mount(LanguageSwitcher);
    const select = wrapper.find('.language-select');

    await select.setValue('en-US');
    await select.trigger('change');

    expect(mockLocale.value).toBe('en-US');
  });

  it('应该在语言改变时保存到localStorage', async () => {
    const wrapper = mount(LanguageSwitcher);
    const select = wrapper.find('.language-select');

    await select.setValue('ja-JP');
    await select.trigger('change');

    expect(localStorageMock.setItem).toHaveBeenCalledWith('locale', 'ja-JP');
  });

  it('应该在mounted时同步当前locale', () => {
    mockLocale.value = 'ja-JP';
    const wrapper = mount(LanguageSwitcher);
    const select = wrapper.find('.language-select');

    expect((select.element as HTMLInputElement).value).toBe('ja-JP');
  });

  it('应该有正确的CSS类', () => {
    const wrapper = mount(LanguageSwitcher);

    expect(wrapper.find('.language-switcher').exists()).toBe(true);
    expect(wrapper.find('.lang-icon').exists()).toBe(true);
    expect(wrapper.find('.language-select').exists()).toBe(true);
  });
});
