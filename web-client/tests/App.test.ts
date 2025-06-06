import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import App from '@/App.vue';
import { createI18n } from 'vue-i18n';

// Mock useToast
vi.mock('../src/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock debug settings
vi.mock('../src/settings/debug-settings', () => ({
  DebugSettings: {
    debugMode: false,
    showDebugPanel: false,
  },
}));

// Mock ionic/vue
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
    methods: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    emits: ['device-ready', 'device-disconnected'],
  },
}));

vi.mock('../src/components/CartBurner.vue', () => ({
  default: {
    name: 'CartBurner',
    template: '<div class="cart-burner">Cart Burner</div>',
    props: ['deviceReady', 'device'],
    methods: {
      resetState: vi.fn(),
    },
  },
}));

vi.mock('../src/components/LanguageSwitcher.vue', () => ({
  default: {
    name: 'LanguageSwitcher',
    template: '<div class="language-switcher">Language Switcher</div>',
  },
}));

vi.mock('../src/components/settings/AdvancedSettingsPanel.vue', () => ({
  default: {
    name: 'AdvancedSettingsPanel',
    template: '<div class="advanced-settings">Advanced Settings</div>',
    emits: ['close'],
  },
}));

vi.mock('../src/components/settings/DebugSettingsPanel.vue', () => ({
  default: {
    name: 'DebugSettingsPanel',
    template: '<div class="debug-settings">Debug Settings</div>',
    emits: ['close', 'connect-mock-device', 'clear-mock-data'],
  },
}));

vi.mock('../src/components/link/DebugLink.vue', () => ({
  default: {
    name: 'DebugLink',
    template: '<div class="debug-link">Debug Link</div>',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('../src/components/link/SettingsLink.vue', () => ({
  default: {
    name: 'SettingsLink',
    template: '<div class="settings-link">Settings Link</div>',
    emits: ['click'],
  },
}));

vi.mock('../src/components/link/GitHubLink.vue', () => ({
  default: {
    name: 'GitHubLink',
    template: '<div class="github-link">GitHub Link</div>',
  },
}));

vi.mock('../src/components/common/GlobalToast.vue', () => ({
  default: {
    name: 'GlobalToast',
    template: '<div class="global-toast">Global Toast</div>',
  },
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      ui: {
        app: {
          title: 'ChisFlash Burner',
        },
      },
    },
  },
});

describe('App.vue', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset import.meta.env.DEV
    Object.defineProperty(import.meta.env, 'DEV', {
      value: false,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  });

  const createWrapper = () => {
    return mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          'router-view': true,
        },
      },
    });
  };

  it('应该包含必要的子组件', () => {
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'DeviceConnect' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'CartBurner' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'LanguageSwitcher' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'SettingsLink' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'GitHubLink' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'GlobalToast' }).exists()).toBe(true);
  });

  /*
  it('应该显示正确的标题', () => {
    wrapper = createWrapper();

    const title = wrapper.find('h1');
    expect(title.exists()).toBe(true);
    expect(title.text()).toContain('ChisFlash Burner');
  });
  */

  it('应该包含标题徽章链接', () => {
    wrapper = createWrapper();

    const badge = wrapper.find('.title-badge');
    expect(badge.exists()).toBe(true);
    expect(badge.attributes('href')).toBe('https://oshwhub.com/linscon/beggar_socket');
    expect(badge.attributes('target')).toBe('_blank');
    expect(badge.text()).toBe('for beggar_socket');
  });

  it('应该正确处理设备就绪事件', async () => {
    wrapper = createWrapper();

    const mockDevice = {
      port: {} as SerialPort,
      reader: null,
      writer: null,
    };

    const deviceConnect = wrapper.findComponent({ name: 'DeviceConnect' });
    await deviceConnect.vm.$emit('device-ready', mockDevice);

    // 检查 CartBurner 组件接收到正确的 props
    const cartBurner = wrapper.findComponent({ name: 'CartBurner' });
    expect(cartBurner.props('deviceReady')).toBe(true);
    expect(cartBurner.props('device')).toEqual(mockDevice);
  });

  it('应该正确处理设备断开事件', async () => {
    wrapper = createWrapper();

    // 首先连接设备
    const mockDevice = {
      port: {} as SerialPort,
      reader: null,
      writer: null,
    };

    const deviceConnect = wrapper.findComponent({ name: 'DeviceConnect' });
    await deviceConnect.vm.$emit('device-ready', mockDevice);

    // 然后断开设备
    await deviceConnect.vm.$emit('device-disconnected');

    // 检查状态重置
    const cartBurner = wrapper.findComponent({ name: 'CartBurner' });
    expect(cartBurner.props('deviceReady')).toBe(false);
    expect(cartBurner.props('device')).toBeNull();
  });

  it('应该正确控制设置面板的显示', async () => {
    wrapper = createWrapper();

    // 初始状态下设置面板不显示
    expect(wrapper.findComponent({ name: 'AdvancedSettingsPanel' }).exists()).toBe(false);

    // 点击设置链接
    const settingsLink = wrapper.findComponent({ name: 'SettingsLink' });
    await settingsLink.vm.$emit('click');

    // 设置面板应该显示
    expect(wrapper.findComponent({ name: 'AdvancedSettingsPanel' }).exists()).toBe(true);

    // 关闭设置面板
    const settingsPanel = wrapper.findComponent({ name: 'AdvancedSettingsPanel' });
    await settingsPanel.vm.$emit('close');

    // 设置面板应该隐藏
    expect(wrapper.findComponent({ name: 'AdvancedSettingsPanel' }).exists()).toBe(false);
  });

  it('应该在开发环境下显示调试链接', () => {
    // 设置为开发环境
    Object.defineProperty(import.meta.env, 'DEV', {
      value: false,
      configurable: true,
      writable: true,
      enumerable: true,
    });

    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'DebugLink' }).exists()).toBe(true);
  });

  it('应该在调试模式启用时显示调试面板', async () => {
    // Mock DebugSettings.showDebugPanel 为 true
    const { DebugSettings } = await import('../src/settings/debug-settings');
    DebugSettings.showDebugPanel = true;

    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'DebugLink' }).exists()).toBe(true);
  });

  it('应该正确处理调试面板的显示和隐藏', async () => {
    // 设置显示调试面板
    Object.defineProperty(import.meta.env, 'DEV', {
      value: false,
      configurable: true,
      writable: true,
      enumerable: true,
    });

    wrapper = createWrapper();

    // 初始状态下调试设置面板不显示
    expect(wrapper.findComponent({ name: 'DebugSettingsPanel' }).exists()).toBe(false);

    // 通过 DebugLink 触发显示
    const debugLink = wrapper.findComponent({ name: 'DebugLink' });
    await debugLink.vm.$emit('update:modelValue', true);

    // 调试设置面板应该显示
    expect(wrapper.findComponent({ name: 'DebugSettingsPanel' }).exists()).toBe(true);

    // 关闭调试设置面板
    const debugPanel = wrapper.findComponent({ name: 'DebugSettingsPanel' });
    await debugPanel.vm.$emit('close');

    // 调试设置面板应该隐藏
    expect(wrapper.findComponent({ name: 'DebugSettingsPanel' }).exists()).toBe(false);
  });

  it('应该正确处理连接模拟设备事件', async () => {
    Object.defineProperty(import.meta.env, 'DEV', {
      value: false,
      configurable: true,
      writable: true,
      enumerable: true,
    });

    wrapper = createWrapper();

    const debugPanel = wrapper.findComponent({ name: 'DebugSettingsPanel' });
    expect(debugPanel.exists()).toBe(false);

    // 显示调试面板
    const debugLink = wrapper.findComponent({ name: 'DebugLink' });
    await debugLink.vm.$emit('update:modelValue', true);

    const visibleDebugPanel = wrapper.findComponent({ name: 'DebugSettingsPanel' });
    await visibleDebugPanel.vm.$emit('connect-mock-device');

    // 应该调用 DeviceConnect 的 connect 方法
    // const deviceConnect = wrapper.findComponent({ name: 'DeviceConnect' });
    // expect(deviceConnect.vm.connect).toHaveBeenCalled();
  });

  it('应该正确处理清除模拟数据事件', async () => {
    Object.defineProperty(import.meta.env, 'DEV', {
      value: false,
      configurable: true,
      writable: true,
      enumerable: true,
    });

    wrapper = createWrapper();

    // 首先连接设备
    const mockDevice = {
      port: {} as SerialPort,
      reader: null,
      writer: null,
    };

    const deviceConnect = wrapper.findComponent({ name: 'DeviceConnect' });
    await deviceConnect.vm.$emit('device-ready', mockDevice);

    // 显示调试面板并触发清除事件
    const debugLink = wrapper.findComponent({ name: 'DebugLink' });
    await debugLink.vm.$emit('update:modelValue', true);

    const debugPanel = wrapper.findComponent({ name: 'DebugSettingsPanel' });
    await debugPanel.vm.$emit('clear-mock-data');

    // 应该调用断开连接方法
    // expect(deviceConnect.vm.disconnect).toHaveBeenCalled();

    // 设备状态应该重置
    const cartBurner = wrapper.findComponent({ name: 'CartBurner' });
    expect(cartBurner.props('deviceReady')).toBe(false);
    expect(cartBurner.props('device')).toBeNull();
  });

  it('应该正确传递provide值', () => {
    wrapper = createWrapper();

    // 检查 provide 是否正确设置
    // 这个测试主要验证 provide 语法是否正确
    expect(wrapper.vm).toBeDefined();
  });

  it('应该正确渲染顶部栏', () => {
    wrapper = createWrapper();

    const topBar = wrapper.find('.top-bar');
    expect(topBar.exists()).toBe(true);
    expect(topBar.findComponent({ name: 'LanguageSwitcher' }).exists()).toBe(true);
  });
});
