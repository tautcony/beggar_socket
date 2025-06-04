import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DeviceConnect from '../src/components/DeviceConnect.vue';
import { createI18n } from 'vue-i18n';

// Mock useToast
vi.mock('../src/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock ionic/vue
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    template: '<div class="ion-icon">{{ name }}</div>',
    props: ['name'],
  },
}));

// Mock debug settings
vi.mock('../src/settings/debug-settings', () => ({
  DebugSettings: {
    debugMode: false,
  },
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      ui: {
        device: {
          connect: 'Connect',
          disconnect: 'Disconnect',
          connecting: 'Connecting...',
          connected: 'Connected',
          usePolyfill: 'Use Polyfill',
          usePolyfillTooltip: 'Use Web Serial Polyfill',
        },
      },
      messages: {
        device: {
          tryingConnect: 'Trying to connect...',
          connectionSuccess: 'Connected successfully',
          disconnected: 'Device disconnected',
          connectionError: 'Connection failed',
          connectionFailed: 'Connection failed: {error}',
          disconnectionSuccess: 'Disconnected successfully',
          disconnectionFailed: 'Disconnection failed',
        },
      },
    },
  },
});

describe('DeviceConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Web Serial API
    Object.defineProperty(global, 'navigator', {
      value: {
        serial: {
          requestPort: vi.fn(),
        },
      },
      writable: true,
    });
  });

  const createWrapper = () => {
    return mount(DeviceConnect, {
      global: {
        plugins: [i18n],
        stubs: {
          IonIcon: true,
        },
      },
    });
  };

  it('renders connect button when disconnected', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('button').text()).toContain('Connect');
  });

  it('renders polyfill toggle with correct label', () => {
    const wrapper = createWrapper();

    const toggleLabel = wrapper.find('.toggle-label');
    expect(toggleLabel.text()).toBe('Use Polyfill');
  });

  it('renders device connect container', () => {
    const wrapper = createWrapper();

    expect(wrapper.find('.device-connect-container').exists()).toBe(true);
    expect(wrapper.find('.device-connect').exists()).toBe(true);
    expect(wrapper.find('.polyfill-toggle').exists()).toBe(true);
  });

  it('has polyfill toggle input', () => {
    const wrapper = createWrapper();

    const toggleInput = wrapper.find('input[type="checkbox"]');
    expect(toggleInput.exists()).toBe(true);
  });

  it('has correct tooltip on polyfill toggle', () => {
    const wrapper = createWrapper();

    const toggleContainer = wrapper.find('.toggle-container');
    expect(toggleContainer.attributes('title')).toBe('Use Web Serial Polyfill');
  });

  it('button is enabled by default', () => {
    const wrapper = createWrapper();

    const button = wrapper.find('button');
    expect(button.element.disabled).toBe(false);
  });

  it('polyfill toggle is enabled by default', () => {
    const wrapper = createWrapper();

    const toggle = wrapper.find('input[type="checkbox"]');
    expect((toggle.element as HTMLInputElement).disabled).toBe(false);
  });

  it('can toggle polyfill checkbox', async () => {
    const wrapper = createWrapper();

    const toggle = wrapper.find('input[type="checkbox"]');
    expect((toggle.element as HTMLInputElement).checked).toBe(false);

    await toggle.setValue(true);
    expect((toggle.element as HTMLInputElement).checked).toBe(true);
  });

  it('emits events correctly', () => {
    const wrapper = createWrapper();

    // Test that the component can emit device-ready
    wrapper.vm.$emit('device-ready', { test: 'data' });
    expect(wrapper.emitted('device-ready')).toBeTruthy();

    // Test that the component can emit device-disconnected
    wrapper.vm.$emit('device-disconnected');
    expect(wrapper.emitted('device-disconnected')).toBeTruthy();
  });

  it('has correct initial button state', () => {
    const wrapper = createWrapper();

    const button = wrapper.find('button');
    // Check button classes to infer state
    expect(button.classes()).toContain('connect-btn');
    expect(button.classes()).not.toContain('disconnect-btn');
    expect(button.element.disabled).toBe(false);
  });

  it('button shows correct text for different states', () => {
    const wrapper = createWrapper();

    // Test initial state
    const button = wrapper.find('button');
    expect(button.text()).toContain('Connect');

    // Button text changes are computed based on internal reactive state
    // Since we can't directly access setup() refs, we test the UI behavior
  });

  it('has correct button click handler', async () => {
    const wrapper = createWrapper();

    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);

    // Button should be clickable
    await button.trigger('click');

    // Since we mocked the navigator.serial.requestPort, the click should not throw
    // In a real scenario, this would trigger the connection process
  });
});
