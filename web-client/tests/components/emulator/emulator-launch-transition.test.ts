import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import {
  BinjgbRunner,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '@/components/emulator/binjgb/binjgb-runner';
import EmulatorLaunchTransition from '@/components/emulator/EmulatorLaunchTransition.vue';
import EmulatorScreenViewport from '@/components/emulator/EmulatorScreenViewport.vue';
import GBAEmulator from '@/components/emulator/GBAEmulator.vue';
import GBCEmulator from '@/components/emulator/GBCEmulator.vue';
import { GB_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

const toastHarness = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastHarness,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { error?: string }) =>
      params?.error ? `${key}: ${params.error}` : key,
  }),
}));

vi.mock('@ionic/vue', () => ({
  IonIcon: {
    template: '<span class="mock-ion-icon" />',
  },
}));

vi.mock('gbats', () => ({
  Wrapper: class MockWrapper {
    emulator: any;
    screenImageFormat = 'webp';
    constructor(options: { rom: ArrayBuffer }) {
      const save = { buffer: new ArrayBuffer(32768), writePending: false };
      const core = {
        LOG_ERROR: 1,
        LOG_WARN: 2,
        LOG_STUB: 4,
        LOG_INFO: 8,
        LOG_DEBUG: 16,
        cpu: { PRIV_MASK: 0xcf },
        keypad: { currentDown: 0x03ff },
        rom: { saveType: 'SRAM_V' },
        mmu: { cart: { saveType: 'SRAM_V' }, save },
        audio: { pause: vi.fn() },
        seenSave: false,
        paused: false,
        storeSavedata: vi.fn(),
        setSavedata: vi.fn(),
        pause: vi.fn(() => { core.paused = true; }),
        runStable: vi.fn(() => { core.paused = false; }),
        setLogger: vi.fn((handler: any) => { core.logger = handler; }),
        logger: undefined,
      };
      this.emulator = core;
    }
  },
}));

function makeGbRom(): Uint8Array {
  const rom = new Uint8Array(0x8000);
  rom.set(GB_NINTENDO_LOGO, 0x104);
  rom.set(new TextEncoder().encode('TEST COLOR'), 0x134);
  rom[0x143] = 0x80;
  rom[0x147] = 0x19;
  rom[0x148] = 0x00;
  rom[0x149] = 0x00;
  let checksum = 0;
  for (let index = 0x134; index <= 0x14c; index += 1) {
    checksum = (checksum - rom[index] - 1) & 0xff;
  }
  rom[0x14d] = checksum;
  return rom;
}

function makeGbaRom(): Uint8Array {
  const rom = new Uint8Array(1024);
  const sig = 'SRAM_V123';
  for (let i = 0; i < sig.length; i += 1) {
    rom[0xe4 + i] = sig.charCodeAt(i);
  }
  return rom;
}

describe('EmulatorLaunchTransition.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders boustrophedon double-snake SVG wipe with correct geometric attributes at 0ms', () => {
    const wrapper = mount(EmulatorLaunchTransition, {
      props: {
        isVisible: true,
        themeColor: '#b3c2a0',
      },
      slots: {
        default: () => h('div', { class: 'inner-content' }, 'Game Content'),
      },
    });

    const overlay = wrapper.find('.emulator-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.classes()).not.toContain('is-covered');

    const svg = wrapper.find('svg.transition-wipe-svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('viewBox')).toBe('0 0 100 100');
    expect(svg.attributes('preserveAspectRatio')).toBe('none');
    expect(svg.attributes('aria-hidden')).toBe('true');

    const paths = wrapper.findAll('path.wipe-path');
    expect(paths).toHaveLength(2);

    const topPath = wrapper.find('.wipe-path-top');
    expect(topPath.exists()).toBe(true);
    expect(topPath.attributes('d')).toBe('M100 -5 V5 H0 V15 H100 V25 H0 V35 H100 V45 H0 V50 H50');
    expect(topPath.attributes('stroke-width')).toBe('10.2');
    expect(topPath.attributes('stroke-linecap')).toBe('square');
    expect(topPath.attributes('stroke-linejoin')).toBe('miter');
    expect(topPath.attributes('pathLength')).toBe('1');
    expect(topPath.attributes('stroke-dasharray')).toBe('1');
    expect(topPath.attributes('stroke')).toBe('#b3c2a0');

    const bottomPath = wrapper.find('.wipe-path-bottom');
    expect(bottomPath.exists()).toBe(true);
    expect(bottomPath.attributes('d')).toBe('M100 -5 V5 H0 V15 H100 V25 H0 V35 H100 V45 H0 V50 H50');
    expect(bottomPath.attributes('transform')).toBe('rotate(180 50 50)');
    expect(bottomPath.attributes('stroke')).toBe('#b3c2a0');

    // Slot content is mounted in DOM immediately
    expect(wrapper.find('.inner-content').exists()).toBe(true);
    // Container does not have is-revealed before covered
    const container = wrapper.find('.emulator-container');
    expect(container.exists()).toBe(true);
    expect(container.classes()).not.toContain('is-revealed');
  });

  it('triggers covered on path @animationend (including scoped keyframe names) and transitions container', async () => {
    const wrapper = mount(EmulatorLaunchTransition, {
      props: {
        isVisible: true,
        themeColor: '#b3c2a0',
      },
    });

    expect(wrapper.find('.emulator-overlay').attributes('style')).toContain('--wipe-theme-color: #b3c2a0');

    const topPath = wrapper.find('.wipe-path-top');
    await topPath.trigger('animationend', { animationName: 'chromatic-snake-wipe-scoped123' });

    const coveredEmits = wrapper.emitted('covered');
    expect(coveredEmits).toBeDefined();
    expect(coveredEmits?.[0]).toEqual([true]);

    await wrapper.vm.$nextTick();

    expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
    expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
    // SVG wipe is unmounted after covered
    expect(wrapper.find('svg.transition-wipe-svg').exists()).toBe(false);
  });

  it('triggers covered on 500ms timer fallback', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(EmulatorLaunchTransition, {
        props: {
          isVisible: true,
        },
      });

      expect(wrapper.find('.emulator-overlay').classes()).not.toContain('is-covered');
      expect(wrapper.find('svg.transition-wipe-svg').exists()).toBe(true);

      vi.advanceTimersByTime(499);
      expect(wrapper.find('.emulator-overlay').classes()).not.toContain('is-covered');

      vi.advanceTimersByTime(1);
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
      expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
      expect(wrapper.find('svg.transition-wipe-svg').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bypasses snake wipe immediately when prefers-reduced-motion is active', () => {
    const originalMatchMedia = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string): MediaQueryList => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const wrapper = mount(EmulatorLaunchTransition, {
        props: {
          isVisible: true,
        },
      });

      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
      expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
      expect(wrapper.find('svg.transition-wipe-svg').exists()).toBe(false);
    } finally {
      if (originalMatchMedia) {
        window.matchMedia = originalMatchMedia;
      } else {
        delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
      }
    }
  });

  it('resets transition state when isVisible changes to false and then true', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(EmulatorLaunchTransition, {
        props: {
          isVisible: true,
        },
      });

      // Complete transition
      vi.advanceTimersByTime(500);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');

      // Hide emulator
      await wrapper.setProps({ isVisible: false });
      expect(wrapper.find('.emulator-overlay').exists()).toBe(false);

      // Re-open emulator
      await wrapper.setProps({ isVisible: true });
      expect(wrapper.find('.emulator-overlay').exists()).toBe(true);
      expect(wrapper.find('.emulator-overlay').classes()).not.toContain('is-covered');
      expect(wrapper.find('svg.transition-wipe-svg').exists()).toBe(true);

      // Complete transition again
      vi.advanceTimersByTime(500);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not emit close when clicking emulator-overlay background directly', async () => {
    const wrapper = mount(EmulatorLaunchTransition, {
      props: {
        isVisible: true,
      },
    });

    const overlay = wrapper.find('.emulator-overlay');
    await overlay.trigger('click');

    expect(wrapper.emitted('close')).toBeUndefined();
  });
});

describe('EmulatorScreenViewport.vue', () => {
  it('renders loading shimmer surface when isReady is false and slot content is present', () => {
    const wrapper = mount(EmulatorScreenViewport, {
      props: {
        isReady: false,
        aspectRatio: '240 / 160',
      },
      slots: {
        default: () => h('canvas', { class: 'test-canvas' }),
      },
    });

    expect(wrapper.find('.screen-viewport').exists()).toBe(true);
    const shimmer = wrapper.find('.screen-loading-surface');
    expect(shimmer.exists()).toBe(true);
    expect(shimmer.classes()).toContain('_3l0r5q_loadingSurface');
    expect(shimmer.attributes('aria-hidden')).toBe('true');
    expect(wrapper.find('canvas.test-canvas').exists()).toBe(true);
  });

  it('unmounts loading shimmer surface when isReady becomes true', async () => {
    const wrapper = mount(EmulatorScreenViewport, {
      props: {
        isReady: false,
      },
      slots: {
        default: () => h('canvas', { class: 'test-canvas' }),
      },
    });

    expect(wrapper.find('.screen-loading-surface').exists()).toBe(true);

    await wrapper.setProps({ isReady: true });
    expect(wrapper.find('.screen-loading-surface').exists()).toBe(false);
    expect(wrapper.find('canvas.test-canvas').exists()).toBe(true);
  });
});

describe('GBAEmulator Transition Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts canvas immediately at 0ms and reveals canvas after transition covered', async () => {
    vi.useFakeTimers();
    try {
      const rom = makeGbaRom();
      const wrapper = mount(GBAEmulator, {
        props: {
          isVisible: true,
          romData: rom,
          romName: 'test.gba',
        },
      });

      // At 0ms: Canvas is already mounted and available to gbats Wrapper
      expect(wrapper.find('canvas').exists()).toBe(true);
      const canvas = wrapper.find('.game-canvas');
      expect(canvas.classes()).not.toContain('is-ready');

      // SVG wipe and screen shimmer are visible
      expect(wrapper.find('.transition-wipe-svg').exists()).toBe(true);
      expect(wrapper.find('.screen-loading-surface').exists()).toBe(true);
      expect(wrapper.find('.wipe-path-top').attributes('stroke')).toBe('#b3c2a0');

      // Advance 500ms
      vi.advanceTimersByTime(500);
      await wrapper.vm.$nextTick();

      // Covered and revealed
      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
      expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
      expect(canvas.classes()).toContain('is-ready');
      expect(wrapper.find('.transition-wipe-svg').exists()).toBe(false);

      wrapper.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets transition when toggled hidden and re-opened', async () => {
    vi.useFakeTimers();
    try {
      const rom = makeGbaRom();
      const wrapper = mount(GBAEmulator, {
        props: {
          isVisible: true,
          romData: rom,
          romName: 'test.gba',
        },
      });

      vi.advanceTimersByTime(500);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');

      await wrapper.setProps({ isVisible: false });
      expect(wrapper.find('.emulator-overlay').exists()).toBe(false);

      await wrapper.setProps({ isVisible: true });
      await flushPromises();
      expect(wrapper.find('.emulator-overlay').exists()).toBe(true);
      expect(wrapper.find('.emulator-overlay').classes()).not.toContain('is-covered');
      expect(wrapper.find('.transition-wipe-svg').exists()).toBe(true);

      wrapper.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GBCEmulator Transition Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts canvas immediately at 0ms and reveals canvas after animation ends', async () => {
    const rom = makeGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test.gbc',
      },
    });

    // Canvas mounted at 0ms
    expect(wrapper.find('canvas').exists()).toBe(true);
    const canvas = wrapper.find('.game-canvas');
    expect(canvas.classes()).not.toContain('is-ready');

    // GBC theme color stroke #b9a4dc
    expect(wrapper.find('.wipe-path-top').attributes('stroke')).toBe('#b9a4dc');
    expect(wrapper.find('.screen-loading-surface').exists()).toBe(true);

    // Wait for BinjgbRunner async init
    await vi.waitFor(() => {
      expect(toastHarness.showToast).toHaveBeenCalledWith('ui.emulator.initSuccess', 'success');
    });

    // Trigger animationend to complete transition
    await wrapper.find('.wipe-path-top').trigger('animationend', { animationName: 'chromatic-snake-wipe' });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');
    expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
    expect(wrapper.find('.game-canvas').classes()).toContain('is-ready');
    expect(wrapper.find('.screen-loading-surface').exists()).toBe(false);
    expect(wrapper.find('.emulator-container').classes()).toContain('is-revealed');
    expect(canvas.classes()).toContain('is-ready');
    expect(wrapper.find('.screen-loading-surface').exists()).toBe(false);

    wrapper.unmount();
  });

  it('resets transition and replay when closed and reopened', async () => {
    const rom = makeGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test.gbc',
      },
    });

    await flushPromises();
    await wrapper.find('.wipe-path-top').trigger('animationend', { animationName: 'chromatic-snake-wipe' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.emulator-overlay').classes()).toContain('is-covered');

    // Close emulator
    await wrapper.setProps({ isVisible: false });
    await flushPromises();
    expect(wrapper.find('.emulator-overlay').exists()).toBe(false);

    // Reopen emulator
    await wrapper.setProps({ isVisible: true });
    await flushPromises();
    expect(wrapper.find('.emulator-overlay').exists()).toBe(true);
    expect(wrapper.find('.emulator-overlay').classes()).not.toContain('is-covered');
    expect(wrapper.find('.transition-wipe-svg').exists()).toBe(true);

    wrapper.unmount();
  });
});
