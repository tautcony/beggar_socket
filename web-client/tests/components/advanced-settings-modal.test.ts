import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import { VARIANT_IDS } from '@/device/definitions';
import { resetDeviceRuntime } from '@/device-runtime/runtime-instance';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DeviceInfo } from '@/types/device-info';

import { buildStmSession } from '../helpers/session-profile';

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
    RetroSwitch: {
      props: ['modelValue', 'id', 'label'],
      emits: ['update:modelValue'],
      template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><span>{{ label }}</span></label>',
    },
  },
};

function mountModal(device: DeviceInfo | null = null) {
  return mount(AdvancedSettingsModal, {
    props: { modelValue: true, device },
    global: globalConfig,
  });
}

function applyButton(wrapper: ReturnType<typeof mountModal>) {
  const buttons = wrapper.findAll('.footer button');
  return buttons[buttons.length - 1];
}

describe('AdvancedSettingsModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.setVariantId(VARIANT_IDS.stm);
    resetDeviceRuntime();
  });

  it('lists the four registered variants from the device catalog', async () => {
    const wrapper = mountModal();
    await nextTick();

    for (const variantId of [VARIANT_IDS.stm, VARIANT_IDS.stmBoost, VARIANT_IDS.stc, VARIANT_IDS.gbflash]) {
      expect(wrapper.find(`[data-testid="variant-${variantId}"]`).exists()).toBe(true);
    }
    expect(wrapper.findAll('.variant-option')).toHaveLength(4);
  });

  it('persists the Boost variant and keeps the shared packet settings', async () => {
    const wrapper = mountModal();
    await nextTick();

    const current = wrapper.get('#param-romReadPageSize');
    await current.setValue('2048');
    await current.trigger('input');

    await wrapper.get(`[data-testid="variant-${VARIANT_IDS.stmBoost}"]`).trigger('click');
    await applyButton(wrapper).trigger('click');

    expect(AdvancedSettings.getVariantId()).toBe(VARIANT_IDS.stmBoost);
    expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(2048);

    // The Boost variant reads the same namespace value.
    AdvancedSettings.setVariantId(VARIANT_IDS.stmBoost);
    expect(AdvancedSettings.romReadPageSize).toBe(2048);
  });

  it('shows the active session profile and the reconnect notice without touching the session', async () => {
    const session = buildStmSession();
    const device: DeviceInfo = { port: null, connection: null, session };

    const wrapper = mountModal(device);
    await nextTick();

    const activeText = wrapper.get('[data-testid="active-session-profile"]').text();
    expect(activeText).toContain('ui.settings.firmware.activeProfile');
    expect(activeText).toContain('丐中丐');

    const noticeText = wrapper.get('[data-testid="firmware-reconnect-notice"]').text();
    expect(noticeText).toContain('ui.settings.firmware.reconnectNotice');

    await wrapper.get(`[data-testid="variant-${VARIANT_IDS.stc}"]`).trigger('click');
    await applyButton(wrapper).trigger('click');

    expect(AdvancedSettings.getVariantId()).toBe(VARIANT_IDS.stc);
    expect(device.session).toBe(session);
    expect(device.session?.variantId).toBe(VARIANT_IDS.stm);
  });

  it('renders the GBFlash baud rate and accepts the 0x2000 packet ceiling', async () => {
    const wrapper = mountModal();
    await nextTick();

    await wrapper.get('[data-testid="size-profile-flashgbx.cfw"]').trigger('click');
    await nextTick();

    expect(wrapper.find('#param-baudRate').exists()).toBe(true);

    const baud = wrapper.get('#param-baudRate');
    await baud.setValue('1500000');
    await baud.trigger('change');

    const romPage = wrapper.get('#param-romPageSize');
    await romPage.setValue('8192');
    await romPage.trigger('input');
    expect(wrapper.text()).not.toContain('ui.settings.size.validation.range');

    await wrapper.get(`[data-testid="variant-${VARIANT_IDS.gbflash}"]`).trigger('click');
    await applyButton(wrapper).trigger('click');

    expect(AdvancedSettings.getVariantId()).toBe(VARIANT_IDS.gbflash);
    expect(AdvancedSettings.getBaudRate()).toBe(1500000);
    expect(AdvancedSettings.getNamespaceSizes('flashgbx.cfw').romPageSize).toBe(0x2000);
    // The Beggar namespace is untouched by the GBFlash edit.
    expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romPageSize).toBe(0x1000);
  });

  it('rejects a GBFlash packet size above 0x2000 and disables applying', async () => {
    const wrapper = mountModal();
    await nextTick();

    await wrapper.get('[data-testid="size-profile-flashgbx.cfw"]').trigger('click');
    await nextTick();

    const romPage = wrapper.get('#param-romPageSize');
    await romPage.setValue('16384');
    await romPage.trigger('input');

    expect(wrapper.text()).toContain('ui.settings.size.validation.range');
    expect((applyButton(wrapper).element as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies settings even when a legacy value exceeds the namespace ceiling', async () => {
    // v1 could store a 16 KiB STM read page; the shared STM/Boost ceiling is 8 KiB, and the
    // form validates every namespace at once — this used to block "apply" for unrelated edits.
    AdvancedSettings.setNamespaceSize('beggar.stm', 'romReadPageSize', 0x4000);

    const wrapper = mountModal();
    await nextTick();

    expect((wrapper.get('#param-romReadPageSize').element as HTMLInputElement).value).toBe('8192');
    expect((applyButton(wrapper).element as HTMLButtonElement).disabled).toBe(false);

    await applyButton(wrapper).trigger('click');

    // Applying writes the clamped value back, so the record stops carrying an illegal size.
    expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(0x2000);
  });

  it('keeps STM and STC linked unless independent sizes are enabled', async () => {
    const wrapper = mountModal();
    await nextTick();

    expect(wrapper.find('[data-testid="size-profile-beggar.stc"]').exists()).toBe(false);

    await wrapper.get('[data-testid="independent-sizes"] input[type="checkbox"]').setValue(true);
    await nextTick();

    expect(wrapper.find('[data-testid="size-profile-beggar.stc"]').exists()).toBe(true);

    await wrapper.get('[data-testid="size-profile-beggar.stc"]').trigger('click');
    await nextTick();
    const stcRead = wrapper.get('#param-romReadPageSize');
    await stcRead.setValue('4096');
    await stcRead.trigger('input');

    await wrapper.get('[data-testid="size-profile-beggar.stm"]').trigger('click');
    await nextTick();
    await wrapper.get('#param-romReadPageSize').setValue('8192');
    await wrapper.trigger('input');

    await applyButton(wrapper).trigger('click');

    expect(AdvancedSettings.getIndependentSizes()).toBe(true);
    expect(AdvancedSettings.getNamespaceSizes('beggar.stm').romReadPageSize).toBe(8192);
    expect(AdvancedSettings.getNamespaceSizes('beggar.stc').romReadPageSize).toBe(4096);
  });

  it('keeps appearance and control sections with their inputs', async () => {
    const wrapper = mountModal();
    await nextTick();

    expect(wrapper.findAll('.settings-nav-button')).toHaveLength(4);

    await wrapper.get('[data-testid="color-mode-dark"]').trigger('click');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await wrapper.get('[data-testid="color-mode-system"]').trigger('click');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    const controlSection = wrapper.get('.control-sections');
    expect(controlSection.find('#default-timeout').exists()).toBe(true);
    expect(controlSection.find('#rom-read-throttle').exists()).toBe(true);
    expect(controlSection.find('#rom-read-retry-count').exists()).toBe(true);
  });

  it('saves the global operation parameters through the same store', async () => {
    const wrapper = mountModal();
    await nextTick();

    const throttle = wrapper.get('#rom-read-throttle');
    await throttle.setValue('15');
    await throttle.trigger('input');
    const timeout = wrapper.get('#default-timeout');
    await timeout.setValue('5000');
    await timeout.trigger('input');

    await applyButton(wrapper).trigger('click');

    expect(AdvancedSettings.romReadThrottleMs).toBe(15);
    expect(AdvancedSettings.defaultTimeout).toBe(5000);
  });
});
