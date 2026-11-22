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
    expect(wrapper.find('[data-testid="stm-boost-option"]').exists()).toBe(true);
    await select.setValue('stc');
    expect(wrapper.find('[data-testid="stm-boost-option"]').exists()).toBe(false);

    const buttons = wrapper.findAll('.footer button');
    const applyButton = buttons[buttons.length - 1];
    await applyButton.trigger('click');

    expect(AdvancedSettings.firmwareProfile).toBe('stc');
    expect(activeDevice.firmwareProfile).toEqual(STM_FIRMWARE_PROFILE);
    expect(STC_FIRMWARE_PROFILE.id).toBe('stc');
  });

  it('allows toggling stm boost enhancement option when stm is selected', async () => {
    AdvancedSettings.firmwareProfile = 'stm';
    AdvancedSettings.stmBoost = true;

    const wrapper = mount(AdvancedSettingsModal, {
      props: { modelValue: true },
      global: globalConfig,
    });
    await nextTick();

    const boostCheckbox = wrapper.get('[data-testid="stm-boost-option"] input[type="checkbox"]');
    await boostCheckbox.setValue(false);

    const buttons = wrapper.findAll('.footer button');
    await buttons[buttons.length - 1].trigger('click');

    expect(AdvancedSettings.firmwareProfile).toBe('stm');
    expect(AdvancedSettings.stmBoost).toBe(false);
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

  it('switches light/dark/system color modes and consolidates timeout, throttle, and retry under control section', async () => {
    const wrapper = mount(AdvancedSettingsModal, {
      props: { modelValue: true },
      global: globalConfig,
    });
    await nextTick();

    // 4 navigation tabs: firmware, appearance, size, control
    expect(wrapper.findAll('.settings-nav-button')).toHaveLength(4);

    await wrapper.get('[data-testid="color-mode-dark"]').trigger('click');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await wrapper.get('[data-testid="color-mode-light"]').trigger('click');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await wrapper.get('[data-testid="color-mode-system"]').trigger('click');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    // Control section contains timeout, throttle, and retry inputs together
    const controlSection = wrapper.get('.control-sections');
    expect(controlSection.find('#default-timeout').exists()).toBe(true);
    expect(controlSection.find('#rom-read-throttle').exists()).toBe(true);
    expect(controlSection.find('#rom-read-retry-count').exists()).toBe(true);
  });

  it('supports flashgbx profile, baud rate selection, and independent flashgbx packet size tab', async () => {
    const wrapper = mount(AdvancedSettingsModal, {
      props: { modelValue: true },
      global: globalConfig,
    });
    await nextTick();

    const profileSelect = wrapper.get('#firmware-profile');
    await profileSelect.setValue('flashgbx');
    await profileSelect.trigger('change');
    await nextTick();

    expect(wrapper.find('[data-testid="flashgbx-baud-option"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="flashgbx-ack-option"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stm-boost-option"]').exists()).toBe(false);

    const baudSelect = wrapper.get('#flashgbx-baud-rate');
    await baudSelect.setValue('1500000');
    await nextTick();

    await wrapper.get('[data-testid="size-profile-flashgbx"]').trigger('click');
    await nextTick();
    const romPageInput = wrapper.get('#rom-page-size');
    await romPageInput.setValue('8192');
    await romPageInput.trigger('input');
    const readInput = wrapper.get('#rom-read-page-size');
    expect((readInput.element as HTMLInputElement).value).toBe('256');
    await readInput.setValue('512');
    await readInput.trigger('input');

    const buttons = wrapper.findAll('.footer button');
    await buttons[buttons.length - 1].trigger('click');

    expect(AdvancedSettings.firmwareProfile).toBe('flashgbx');
    expect(AdvancedSettings.flashgbxBaudRate).toBe(1500000);
    expect(AdvancedSettings.getProfileSizes('flashgbx').romPageSize).toBe(8192);
    expect(AdvancedSettings.getProfileSizes('flashgbx').romReadPageSize).toBe(512);
    expect(AdvancedSettings.getProfileSizes('stm').romReadPageSize).toBe(4096);
  });
});
