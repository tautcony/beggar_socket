import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import BaseButton from '@/components/common/BaseButton.vue';

describe('BaseButton', () => {
  it('marks icon-only buttons so they can use a square size', () => {
    const wrapper = mount(BaseButton, {
      props: {
        icon: 'refresh',
        iconOnly: true,
        size: 'sm',
      },
    });

    expect(wrapper.get('button').classes()).toContain('button-icon-only');
  });

  it('keeps icon buttons flexible unless square sizing is requested', () => {
    const wrapper = mount(BaseButton, {
      props: {
        icon: 'refresh',
      },
    });

    expect(wrapper.get('button').classes()).not.toContain('button-icon-only');
  });
});
