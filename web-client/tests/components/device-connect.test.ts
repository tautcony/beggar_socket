import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceConnect from '@/components/DeviceConnect.vue';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { FLASHGBX_FIRMWARE_PROFILE } from '@/types/firmware-profile';

const { showToastMock, requestDeviceMock, connectWithSelectedPortMock, disconnectDeviceMock, initializeDeviceMock, listAvailablePortsMock, isDeviceConnectedMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  requestDeviceMock: vi.fn(),
  connectWithSelectedPortMock: vi.fn(),
  disconnectDeviceMock: vi.fn(),
  initializeDeviceMock: vi.fn(),
  listAvailablePortsMock: vi.fn(),
  isDeviceConnectedMock: vi.fn(() => false),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/platform/runtime', () => ({
  getRuntimeKind: vi.fn(() => 'tauri'),
  isTauriRuntime: vi.fn(() => true),
  isWebRuntime: vi.fn(() => false),
}));

vi.mock('@/services/device-connection-manager', () => {
  class MockPortSelectionRequiredError extends Error {
    availablePorts: unknown[];

    constructor(availablePorts: unknown[]) {
      super('selection required');
      this.name = 'PortSelectionRequiredError';
      this.availablePorts = availablePorts;
    }
  }

  return {
    PortSelectionRequiredError: MockPortSelectionRequiredError,
    DeviceConnectionManager: {
      getInstance: () => ({
        requestDevice: requestDeviceMock,
        connectWithSelectedPort: connectWithSelectedPortMock,
        disconnectDevice: disconnectDeviceMock,
        initializeDevice: initializeDeviceMock,
        listAvailablePorts: listAvailablePortsMock,
        isDeviceConnected: isDeviceConnectedMock,
      }),
    },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('DeviceConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDeviceConnectedMock.mockReturnValue(false);
    Object.defineProperty(import.meta, 'hot', {
      value: undefined,
      configurable: true,
    });
  });

  it('serializes repeated connect requests through a single in-flight operation', async () => {
    const pending = deferred<{ port: null; transport: Record<string, never>; connection: null }>();
    requestDeviceMock.mockReturnValue(pending.promise);

    const wrapper = mount(DeviceConnect, {
      global: {
        stubs: {
          RetroButton: {
            template: '<button @click="$emit(\'click\')" />',
          },
          PortSelectorModal: true,
        },
      },
    });

    const vm = wrapper.vm as unknown as { connect: () => Promise<void> };
    const firstConnect = vm.connect();
    const secondConnect = vm.connect();

    await flushPromises();
    expect(requestDeviceMock).toHaveBeenCalledTimes(1);

    pending.resolve({ port: null, transport: {}, connection: null });
    await firstConnect;
    await secondConnect;
  });

  it('uses flashgbx port filter and logs device name, firmware, and power capability without rendering permanent summary text', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    AdvancedSettings.firmwareProfile = 'flashgbx';
    requestDeviceMock.mockResolvedValue({
      port: null,
      transport: {},
      connection: null,
      firmwareProfile: {
        ...FLASHGBX_FIRMWARE_PROFILE,
        label: 'GBFlash',
        firmwareVersion: 'L14',
        capabilities: {
          ...FLASHGBX_FIRMWARE_PROFILE.capabilities,
          cartPowerControl: true,
        },
      },
      flashgbxInfo: {
        family: 'gbflash',
        cfwId: 'L',
        fwVer: 14,
        pcbVer: 13,
        fwTs: 0,
        ofwVer: null,
        pcbName: 'GBFlash',
        cartPowerCtrl: true,
        cartPresenceSwitch: false,
        cartModeSwitch: false,
        bootloaderReset: true,
        hasDeviceSerial: false,
        unregistered: false,
        audioWePin: true,
        isCdc: false,
      },
    });

    const wrapper = mount(DeviceConnect, {
      global: {
        stubs: {
          RetroButton: {
            template: '<button @click="$emit(\'click\')" />',
          },
          PortSelectorModal: true,
        },
      },
    });

    const vm = wrapper.vm as unknown as { connect: () => Promise<void> };
    await vm.connect();
    await flushPromises();

    expect(requestDeviceMock).toHaveBeenCalledTimes(1);
    const passedFilter = requestDeviceMock.mock.calls[0][0] as { config?: { devices?: unknown[] } };
    expect(passedFilter?.config?.devices).toHaveLength(2);

    expect(wrapper.find('[data-testid="flashgbx-device-summary"]').exists()).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith(
      '[DeviceConnect] FlashGBX device connected',
      expect.objectContaining({
        name: 'GBFlash',
        firmware: 'L14',
        powerControl: true,
      }),
    );

    infoSpy.mockRestore();
    AdvancedSettings.resetToDefaults();
  });
});
