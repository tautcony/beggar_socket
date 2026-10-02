import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import { AdvancedSettings } from '@/settings/advanced-settings';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
function mountSettings() {
  return mount(AdvancedSettingsModal, {
    props: { modelValue: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { BaseModal: { template: '<div><slot /><slot name="footer" /></div>' } },
    },
  });
}

describe('operation budget settings modal', () => {
  beforeEach(() => { AdvancedSettings.resetToDefaults(); });
  afterEach(() => { vi.restoreAllMocks(); AdvancedSettings.resetToDefaults(); });

  it('saves the real checkbox and duration through the existing apply action', async () => {
    const wrapper = mountSettings();
    await wrapper.get('#operation-budget-enabled').setValue(true);
    await wrapper.get('#operation-timeout').setValue('9000');
    expect(AdvancedSettings.operationBudgetEnabled).toBe(false);
    await wrapper.get('.btn-primary').trigger('click');
    expect(AdvancedSettings.operationBudgetEnabled).toBe(true);
    expect(AdvancedSettings.operationTimeout).toBe(9000);
    AdvancedSettings.loadSettings();
    expect(AdvancedSettings.operationBudgetEnabled).toBe(true);
    expect(wrapper.emitted('applied')).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps an unsaved checkbox local and reset restores its disabled default', async () => {
    const wrapper = mountSettings();
    await wrapper.get('#operation-budget-enabled').setValue(true);
    await wrapper.get('.footer-right .btn-secondary').trigger('click');
    expect(AdvancedSettings.operationBudgetEnabled).toBe(false);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await wrapper.get('.btn-secondary').trigger('click');
    expect((wrapper.get('#operation-budget-enabled').element as HTMLInputElement).checked).toBe(false);
    await wrapper.get('.btn-primary').trigger('click');
    expect(AdvancedSettings.operationBudgetEnabled).toBe(false);
    wrapper.unmount();
  });
});
