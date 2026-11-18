/* eslint-disable vue/one-component-per-file */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import RetroModal from '@/components/retro/RetroModal.vue';

function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('RetroModal Escape stacking', () => {
  it('closes nested modals one layer at a time on Escape', async () => {
    const outerOpen = ref(true);
    const innerOpen = ref(true);

    const Host = defineComponent({
      setup() {
        return () => h('div', [
          h(RetroModal, {
            modelValue: outerOpen.value,
            title: 'Outer',
            'onUpdate:modelValue': (val: boolean) => { outerOpen.value = val; },
          }, {
            default: () => h(RetroModal, {
              modelValue: innerOpen.value,
              title: 'Inner',
              'onUpdate:modelValue': (val: boolean) => { innerOpen.value = val; },
            }),
          }),
        ]);
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });

    dispatchEscape();
    await wrapper.vm.$nextTick();
    expect(innerOpen.value).toBe(false);
    expect(outerOpen.value).toBe(true);

    dispatchEscape();
    await wrapper.vm.$nextTick();
    expect(innerOpen.value).toBe(false);
    expect(outerOpen.value).toBe(false);

    wrapper.unmount();
  });

  it('does not close the underlying modal when the topmost modal has escClosable disabled', async () => {
    const outerOpen = ref(true);
    const innerOpen = ref(true);

    const Host = defineComponent({
      setup() {
        return () => h('div', [
          h(RetroModal, {
            modelValue: outerOpen.value,
            title: 'Outer',
            'onUpdate:modelValue': (val: boolean) => { outerOpen.value = val; },
          }, {
            default: () => h(RetroModal, {
              modelValue: innerOpen.value,
              title: 'Inner',
              escClosable: false,
              'onUpdate:modelValue': (val: boolean) => { innerOpen.value = val; },
            }),
          }),
        ]);
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });

    dispatchEscape();
    await wrapper.vm.$nextTick();
    expect(innerOpen.value).toBe(true);
    expect(outerOpen.value).toBe(true);

    wrapper.unmount();
  });
});
