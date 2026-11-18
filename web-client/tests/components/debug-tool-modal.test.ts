import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import DebugToolModal from '@/components/modal/DebugToolModal.vue';
import type { DeviceInfo } from '@/types/device-info';

const { runConnectionOperationMock, executeDebugCommandMock, showToastMock } = vi.hoisted(() => ({
  runConnectionOperationMock: vi.fn(),
  executeDebugCommandMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock('@/composables/useConnectionOperationBusy', () => ({
  useConnectionOperationBusy: () => ({
    connectionBusy: ref(false),
  }),
}));

vi.mock('@/services/device-connection-manager', () => ({
  DeviceConnectionManager: {
    getInstance: () => ({
      runConnectionOperation: runConnectionOperationMock,
    }),
  },
}));

vi.mock('@/services/debug-protocol-service', async () => {
  const actual = await vi.importActual<typeof import('@/services/debug-protocol-service')>('@/services/debug-protocol-service');
  return {
    ...actual,
    executeDebugCommand: executeDebugCommandMock,
  };
});

function makeDevice(): DeviceInfo {
  return {
    port: null,
    connectionGeneration: 1,
    transport: { send: vi.fn(), read: vi.fn() } as unknown as DeviceInfo['transport'],
    portInfo: { path: '/dev/tty.usbmodem1' },
  };
}

describe('DebugToolModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runConnectionOperationMock.mockImplementation(async ({ fn }: { fn: () => Promise<unknown> }) => ({
      ok: true,
      value: await fn(),
    }));
    executeDebugCommandMock.mockResolvedValue({
      requestData: new Uint8Array([0x00, 0x05, 0xf6, 0x01, 0x02]),
      responseData: new Uint8Array([0x41, 0x42, 0x43, 0x44]),
    });
  });

  it('auto-updates receiveLength with length for READ commands and validates hex data live', async () => {
    const wrapper = mount(DebugToolModal, {
      props: {
        modelValue: true,
        device: makeDevice(),
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          Teleport: true,
        },
      },
    });

    const selects = wrapper.findAll('select');
    await selects[0].setValue('GBA');
    await selects[0].trigger('change');

    const commandSelect = wrapper.findAll('select')[1];
    await commandSelect.setValue(String(0xf6)); // GBA READ
    await commandSelect.trigger('change');

    const numberInputs = wrapper.findAll('input[type="number"]');
    const lengthInput = numberInputs[0];
    const receiveInput = numberInputs[1];
    expect((receiveInput.element as HTMLInputElement).value).toBe('258');

    await lengthInput.setValue('16');
    await lengthInput.trigger('input');
    expect((receiveInput.element as HTMLInputElement).value).toBe('18');

    const textarea = wrapper.find('textarea');
    await textarea.setValue('01 02 0');
    expect(wrapper.text()).toContain('ui.debug.tool.errors.invalidHexLength');

    const sendButton = wrapper.findAll('button').find(b => b.text().includes('ui.debug.tool.send'));
    expect(sendButton?.attributes('disabled')).toBeDefined();

    await textarea.setValue('01 02 03');
    expect(wrapper.text()).toContain('3 ui.debug.tool.bytes');
    expect(sendButton?.attributes('disabled')).toBeUndefined();

    wrapper.unmount();
  });

  it('sends command, toggles HEX+ASCII dump view, and restores from history', async () => {
    const wrapper = mount(DebugToolModal, {
      props: {
        modelValue: true,
        device: makeDevice(),
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          Teleport: true,
        },
      },
    });

    const selects = wrapper.findAll('select');
    await selects[0].setValue('GBA');
    await selects[0].trigger('change');

    const commandSelect = wrapper.findAll('select')[1];
    await commandSelect.setValue(String(0xf6));
    await commandSelect.trigger('change');

    await wrapper.find('input[type="text"]').setValue('0x08000000');

    const sendButton = wrapper.findAll('button').find(b => b.text().includes('ui.debug.tool.send'));
    await sendButton?.trigger('click');
    await flushPromises();

    expect(executeDebugCommandMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('41 42 43 44');

    const dumpButton = wrapper.findAll('button').find(b => b.text() === 'ui.debug.tool.viewDump');
    await dumpButton?.trigger('click');
    expect(wrapper.text()).toContain('|ABCD|');

    const clearButton = wrapper.findAll('button').find(b => b.text().trim() === 'ui.debug.tool.clear');
    await clearButton?.trigger('click');
    expect(wrapper.findAll('select')[0].element.value).toBe('');

    const historyChip = wrapper.find('.history-chip');
    expect(historyChip.exists()).toBe(true);
    await historyChip.trigger('click');
    expect(wrapper.findAll('select')[0].element.value).toBe('GBA');
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('0x08000000');

    wrapper.unmount();
  });
});
