import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '@/App.vue';

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'zh-CN' },
  }),
  createI18n: vi.fn(() => ({
    global: {
      t: (key: string) => key,
    },
  })),
}));

vi.mock('@ionic/vue', () => ({
  IonApp: {
    name: 'IonApp',
    template: '<div class="ion-app"><slot /></div>',
  },
  IonContent: {
    name: 'IonContent',
    template: '<div class="ion-content"><slot /></div>',
  },
  IonIcon: {
    name: 'IonIcon',
    props: ['name'],
    template: '<div class="ion-icon" :data-name="name"></div>',
  },
}));

// Mock components
vi.mock('../src/components/DeviceConnect.vue', () => ({
  default: {
    name: 'DeviceConnect',
    template: '<div class="device-connect">Device Connect</div>',
  },
}));

vi.mock('../src/components/CartBurner.vue', () => ({
  default: {
    name: 'CartBurner',
    template: '<div class="cart-burner">Cart Burner</div>',
  },
}));

vi.mock('../src/components/LanguageSwitcher.vue', () => ({
  default: {
    name: 'LanguageSwitcher',
    template: '<div class="language-switcher">Language Switcher</div>',
  },
}));

vi.mock('../src/components/LogViewer.vue', () => ({
  default: {
    name: 'LogViewer',
    template: '<div class="log-viewer">Log Viewer</div>',
  },
}));

describe('App.vue', () => {
  it('应该包含必要的子组件', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-view': true,
        },
      },
    });

    expect(wrapper.findComponent({ name: 'DeviceConnect' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'CartBurner' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'LanguageSwitcher' }).exists()).toBe(true);
  });
});
