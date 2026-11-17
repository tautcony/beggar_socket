import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DeviceInfo } from '@/types/device-info';
import { STC_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

const globalConfig = {
  mocks: {
    $t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
  },
  stubs: {
    RetroModal: {
      props: ['modelValue', 'title'],
      template: '<div v-if="modelValue"><slot /><div class="footer"><slot name="footer" /></div></div>',
    },
    RetroButton: {
      props: ['disabled', 'variant', 'size'],
      emits: ['click'],
      template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    },
    RetroSelect: {
      props: ['modelValue', 'id', 'size', 'fullWidth'],
      emits: ['update:modelValue', 'change'],
      template: '<select :id="id" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event)"><slot /></select>',
    },
  },
};

describe('AdvancedSettingsModal', () => {
  beforeEach(() => {
    AdvancedSettings.resetToDefaults();
  });

  it('loads, validates, and persists romReadPageSize', async () => {
    AdvancedSettings.romReadPageSize = 8192;
    const wrapper = mount(AdvancedSettingsModal, {
      props: { modelValue: true },
      global: globalConfig,
    });
    await nextTick();

    const input = wrapper.get('#rom-read-page-size');
    expect((input.element as HTMLInputElement).value).toBe('8192');

    // Out-of-range value disables apply and shows validation error
    await input.setValue('32');
    await input.trigger('input');
    expect(wrapper.text()).toContain('ui.settings.size.validation.range');
    const buttons = wrapper.findAll('.footer button');
    const applyButton = buttons[buttons.length - 1];
    expect((applyButton.element as HTMLButtonElement).disabled).toBe(true);

    // Valid value enables apply and persists on click
    await input.setValue('16384');
    await input.trigger('input');
    expect((applyButton.element as HTMLButtonElement).disabled).toBe(false);

    await applyButton.trigger('click');
    expect(AdvancedSettings.romReadPageSize).toBe(16384);
  });

  it('displays active connection firmware profile and reconnect notice without mutating active connection on save', async () => {
    AdvancedSettings.firmwareProfile = 'stm';
    const activeDevice: DeviceInfo = {
      port: null,
      connection: null,
      transport: null,
      firmwareProfile: STM_FIRMWARE_PROFILE,
    };

    const wrapper = mount(AdvancedSettingsModal, {
      props: {
        modelValue: true,
        device: activeDevice,
      },
      global: globalConfig,
    });

    const activeProfileText = wrapper.get('[data-testid="active-firmware-profile"]').text();
    expect(activeProfileText).toContain('ui.settings.firmware.activeProfile');
    expect(activeProfileText).toContain(`${STM_FIRMWARE_PROFILE.label} (${STM_FIRMWARE_PROFILE.id})`);

    const noticeText = wrapper.get('[data-testid="firmware-reconnect-notice"]').text();
    expect(noticeText).toContain('ui.settings.firmware.reconnectNotice');

    // Change firmware profile to STC and save
    const select = wrapper.get('#firmware-profile');
    await select.setValue('stc');

    const buttons = wrapper.findAll('.footer button');
    const applyButton = buttons[buttons.length - 1];
    await applyButton.trigger('click');

    expect(AdvancedSettings.firmwareProfile).toBe('stc');
    expect(activeDevice.firmwareProfile).toEqual(STM_FIRMWARE_PROFILE);
    expect(STC_FIRMWARE_PROFILE.id).toBe('stc');
  });

  it('allows independent stm and stc page size configuration in size section', async () => {
    const wrapper = mount(AdvancedSettingsModal, {
      props: { modelValue: true },
      global: globalConfig,
    });
    await nextTick();

    const readInput = wrapper.get('#rom-read-page-size');
    await readInput.setValue('3072');
    await readInput.trigger('input');

    await wrapper.get('[data-testid="size-profile-stc"]').trigger('click');
    await nextTick();
    expect((readInput.element as HTMLInputElement).value).toBe('8192');

    await readInput.setValue('16384');
    await readInput.trigger('input');

    const buttons = wrapper.findAll('.footer button');
    const applyButton = buttons[buttons.length - 1];
    await applyButton.trigger('click');

    expect(AdvancedSettings.getProfileSizes('stm').romReadPageSize).toBe(3072);
    expect(AdvancedSettings.getProfileSizes('stc').romReadPageSize).toBe(16384);
  });
});
