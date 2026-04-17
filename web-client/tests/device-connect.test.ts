import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceConnect from '@/components/DeviceConnect.vue';

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

vi.mock('@/utils/tauri', () => ({
  isTauri: vi.fn(() => true),
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
          BaseButton: {
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
});
