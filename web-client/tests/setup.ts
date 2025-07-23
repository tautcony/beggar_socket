import { config } from '@vue/test-utils';
import { vi } from 'vitest';

// Mock Web Serial API
Object.defineProperty(window, 'navigator', {
  value: {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    ...window.navigator,
    serial: {
      requestPort: vi.fn(),
      getPorts: vi.fn(() => Promise.resolve([])),
    },
  },
  writable: true,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  root: Element | null = null;
  rootMargin = '';
  thresholds: readonly number[] = [];
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {}
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock performance.now for consistent timing in tests
vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now()),
});

// Global Vue test config
config.global.mocks = {
  $t: (key: string) => key,
  $i18n: {
    locale: 'zh-CN',
  },
};

// Mock Ionic components globally
config.global.components = {
  IonIcon: {
    name: 'IonIcon',
    props: ['name'],
    template: '<div class="ion-icon" :data-name="name"></div>',
  },
  BaseModal: {
    name: 'BaseModal',
    props: ['visible', 'title', 'closeDisabled', 'width'],
    emits: ['close'],
    template: `
      <div class="base-modal" v-if="visible">
        <header><slot name="header"></slot></header>
        <main><slot></slot></main>
        <footer><slot name="footer"></slot></footer>
      </div>
    `,
  },
  Teleport: {
    name: 'Teleport',
    props: ['to'],
    template: '<div><slot /></div>',
  },
};
