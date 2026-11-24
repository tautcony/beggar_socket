import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ChipOperations from '@/components/operaiton/ChipOperations.vue';
import { VARIANT_IDS } from '@/device/definitions';
import type { FlashcartProfileSummary } from '@/types/flashcart-profile';

import { buildTestSession } from '../helpers/session-profile';

/** Capabilities of a committed session, exactly what the container passes down. */
function capabilitiesOf(variantId: string) {
  return buildTestSession(variantId).capabilities;
}

const sampleProfiles: FlashcartProfileSummary[] = [
  {
    id: 'agb:cart-a',
    sourceFile: 'fc_AGB_CartA.txt',
    type: 'AGB',
    names: ['AGB Cart A'],
    voltage: 3.3,
    flash_size: 0x100000,
    command_set: 'AMD',
  },
  {
    id: 'dmg:cart-b',
    sourceFile: 'fc_DMG_CartB.txt',
    type: 'DMG',
    names: ['DMG Cart B'],
    voltage: 5,
    flash_size: 0x80000,
    command_set: 'AMD',
  },
];

function mountChipOperations(props: Record<string, unknown>) {
  return mount(ChipOperations, {
    props: {
      mode: 'GBA',
      deviceReady: true,
      busy: false,
      ...props,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        RetroCard: { template: '<div><slot name="header-left" /><slot name="header-right" /><slot /></div>' },
        RetroButton: { props: ['disabled', 'text'], template: '<button :disabled="disabled">{{ text }}</button>' },
        RetroSelect: {
          props: ['value', 'disabled'],
          emits: ['change'],
          template: '<select :value="value" :disabled="disabled" @change="$emit(\'change\', $event)"><slot /></select>',
        },
        RetroSwitch: true,
      },
    },
  });
}

describe('ChipOperations flashcart profile selector', () => {
  it('hides flashcart profile selector on stm/stc devices', () => {
    const wrapper = mountChipOperations({
      capabilities: capabilitiesOf(VARIANT_IDS.stm),
      flashcartProfiles: sampleProfiles,
    });

    expect(wrapper.find('.flashcart-profile-row').exists()).toBe(false);
  });

  it('shows selector on GBFlash devices, filters by mode, and defaults to Auto (CFI)', () => {
    const wrapper = mountChipOperations({
      mode: 'GBA',
      capabilities: capabilitiesOf(VARIANT_IDS.gbflash),
      flashcartProfiles: sampleProfiles,
      selectedFlashcartProfileId: '',
    });

    const select = wrapper.find('.flashcart-profile-dropdown');
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe('');

    const options = select.findAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].attributes('value')).toBe('');
    expect(options[0].text()).toBe('ui.chip.flashcartProfileAuto');
    expect(options[1].attributes('value')).toBe('agb:cart-a');
    expect(options[1].text()).toContain('AGB Cart A');
  });

  it('emits flashcart-profile-change on selection and ambiguous candidate click, and resets to Auto on mode switch', async () => {
    const wrapper = mountChipOperations({
      mode: 'GBA',
      capabilities: capabilitiesOf(VARIANT_IDS.gbflash),
      flashcartProfiles: sampleProfiles,
      selectedFlashcartProfileId: 'agb:cart-a',
      ambiguousFlashcartProfiles: [sampleProfiles[0]],
    });

    const candidateBtn = wrapper.find('.flashcart-ambiguous-item');
    expect(candidateBtn.exists()).toBe(true);
    await candidateBtn.trigger('click');
    expect(wrapper.emitted('flashcart-profile-change')?.[0]).toEqual(['agb:cart-a']);

    await wrapper.setProps({ mode: 'MBC5' });
    const emitted = wrapper.emitted('flashcart-profile-change') ?? [];
    expect(emitted[emitted.length - 1]).toEqual(['']);

    const options = wrapper.find('.flashcart-profile-dropdown').findAll('option');
    expect(options.map(o => o.attributes('value'))).toEqual(['', 'dmg:cart-b']);
  });
});
