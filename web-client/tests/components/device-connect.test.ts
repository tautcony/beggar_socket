import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceConnect from '@/components/DeviceConnect.vue';
import PortSelectorModal from '@/components/modal/PortSelectorModal.vue';
import type { ConnectionLogEntry } from '@/device-runtime/connection-report';

import { buildGbflashSession, buildStmSession } from '../helpers/session-profile';

const { showToastMock, requestDeviceMock, connectWithSelectedPortMock, disconnectDeviceMock, initializeDeviceMock, listAvailablePortsMock, listPortsMatchingSelectionMock, isDeviceConnectedMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  requestDeviceMock: vi.fn(),
  connectWithSelectedPortMock: vi.fn(),
  disconnectDeviceMock: vi.fn(),
  initializeDeviceMock: vi.fn(),
  listAvailablePortsMock: vi.fn(),
  listPortsMatchingSelectionMock: vi.fn(),
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
        listPortsMatchingSelection: listPortsMatchingSelectionMock,
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

function gbflashDevice() {
  return {
    port: null,
    transport: {},
    connection: null,
    connectionId: 'session-1',
    portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
    // The session facts and the port metadata describe the same port, as they do in the app.
    session: buildGbflashSession({ usb: { vendorId: '1a86', productId: '7523' } }),
  };
}

/**
 * The log is an emitted event, so the helper only needs `emitted`. Declaring that
 * structurally keeps it independent of the wrapper generic, which the `mount` overloads
 * widen to `any` and which would make every call an unsafe argument.
 */
interface ConnectionLogEmitter {
  emitted: (event: string) => unknown[][] | undefined;
}

function connectionLogEntries(wrapper: ConnectionLogEmitter): readonly ConnectionLogEntry[] {
  const emitted = wrapper.emitted('connection-log');
  expect(emitted).toBeTruthy();
  const last = emitted === undefined ? undefined : emitted[emitted.length - 1];
  return (last?.[0] ?? []) as readonly ConnectionLogEntry[];
}

/**
 * Component search through the modal returns a wrapper whose `vm` is untyped, so the
 * emitted event is declared once here rather than cast at all four call sites.
 */
function emitFromModal(modal: { vm: unknown }, event: string, payload?: unknown): void {
  (modal.vm as { $emit: (name: string, ...args: unknown[]) => void }).$emit(event, payload);
}

describe('DeviceConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDeviceConnectedMock.mockReturnValue(false);
    listAvailablePortsMock.mockResolvedValue([]);
    listPortsMatchingSelectionMock.mockResolvedValue([]);
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

  it('requests the saved variant, then logs device, firmware, port match and diagnostics to the right-hand log area', async () => {
    requestDeviceMock.mockResolvedValue(gbflashDevice());

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

    // Discovery follows the binding of the saved variant; the component no longer passes a filter.
    expect(requestDeviceMock).toHaveBeenCalledTimes(1);
    expect(requestDeviceMock).toHaveBeenCalledWith({});

    // No permanent summary element: the log area is the only place this is rendered.
    expect(wrapper.find('[data-testid="gbflash-device-summary"]').exists()).toBe(false);

    const entries = connectionLogEntries(wrapper);
    expect(entries[0]).toMatchObject({
      level: 'info',
      message: 'Connected: GBFlash (L14)',
    });
    expect(entries[0].details).toContain('variant=gbflash');
    expect(entries[0].details).toContain('port=/dev/cu.usbserial-110 (1a86:7523)');
    expect(entries[0].details).toContain('match=match');
  });

  it('reports a failed connection with an actionable hint for the failing stage', async () => {
    requestDeviceMock.mockRejectedValue(Object.assign(new Error('boost handshake did not answer'), {
      failure: {
        stage: 'probe',
        code: 'boost-unsupported',
        message: 'Beggar Boost handshake did not answer',
        diagnostics: [
          {
            code: 'boost-probe-failed',
            severity: 'error',
            message: 'Boost handshake failed',
            stage: 'probe',
          },
        ],
      },
    }));

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

    const entries = connectionLogEntries(wrapper);
    expect(entries[0]).toMatchObject({
      level: 'error',
      message: 'Connection failed at probe: Beggar Boost handshake did not answer',
    });
    // The hint stays on the protocol stage instead of collapsing into "connect".
    expect(entries[0].details).toContain('did not answer the selected firmware handshake');
    expect(entries[1]).toMatchObject({
      level: 'error',
      message: '[probe/boost-probe-failed] Boost handshake failed',
    });
  });

  it('hides select-other-port in the connect button context menu and passes allowAnyPort when clicked', async () => {
    requestDeviceMock.mockResolvedValue(gbflashDevice());

    const wrapper = mount(DeviceConnect, {
      global: {
        stubs: {
          RetroButton: {
            props: ['text'],
            template: '<button @click="$emit(\'click\')" @contextmenu="$emit(\'contextmenu\', $event)">{{ text }}</button>',
          },
          PortSelectorModal: true,
          Teleport: true,
        },
      },
    });

    // No standalone "select other port" button in the toolbar
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(1);
    expect(wrapper.find('[data-testid="connect-context-menu"]').exists()).toBe(false);

    // Right-click opens the context menu with "select other port"
    await wrapper.get('[data-testid="connect-device-btn"]').trigger('contextmenu', { clientX: 120, clientY: 60 });
    expect(wrapper.find('[data-testid="connect-context-menu"]').exists()).toBe(true);

    await wrapper.get('[data-testid="select-other-port-item"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="connect-context-menu"]').exists()).toBe(false);
    expect(requestDeviceMock).toHaveBeenCalledWith({ allowAnyPort: true });

    // Once connected, right-clicking the button does not reopen the menu
    await wrapper.get('[data-testid="connect-device-btn"]').trigger('contextmenu', { clientX: 120, clientY: 60 });
    expect(wrapper.find('[data-testid="connect-context-menu"]').exists()).toBe(false);
  });

  it('offers the matching ports first, the full list on refresh, and connects a manually chosen mismatch port', async () => {
    const { PortSelectionRequiredError } = await import('@/services/device-connection-manager');
    const matching = { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };
    const other = { path: '/dev/cu.Bluetooth-Incoming-Port' };
    requestDeviceMock.mockRejectedValue(new PortSelectionRequiredError([matching]));
    listPortsMatchingSelectionMock.mockResolvedValue([matching]);
    listAvailablePortsMock.mockResolvedValue([matching, other]);
    connectWithSelectedPortMock.mockResolvedValue(gbflashDevice());

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

    const modal = wrapper.findComponent(PortSelectorModal);
    // Automatic discovery offered exactly the matching port and did not open anything.
    expect(modal.props('visible')).toBe(true);
    expect(modal.props('ports')).toEqual([matching]);
    expect(connectWithSelectedPortMock).not.toHaveBeenCalled();

    // Refreshing keeps the matching ports rather than offering every port.
    emitFromModal(modal, 'refresh');
    await flushPromises();
    expect(listPortsMatchingSelectionMock).toHaveBeenCalled();
    expect(modal.props('ports')).toEqual([matching]);

    // With no match, the complete list is offered instead.
    listPortsMatchingSelectionMock.mockResolvedValue([]);
    emitFromModal(modal, 'refresh');
    await flushPromises();
    expect(modal.props('ports')).toEqual([matching, other]);

    // The user explicitly picks a port: it is connected with the saved variant.
    emitFromModal(modal, 'select', other);
    await flushPromises();
    expect(connectWithSelectedPortMock).toHaveBeenCalledWith(other);
  });

  it('logs the mismatch diagnostic when the user picks a port that does not match the variant', async () => {
    const { PortSelectionRequiredError } = await import('@/services/device-connection-manager');
    const other = { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };
    requestDeviceMock.mockRejectedValue(new PortSelectionRequiredError([]));
    // The selected variant is standard STM but the port reports the CH340 identity: the
    // resolver records a transport-stage mismatch and the session still commits.
    const stmOnCh340 = buildStmSession({ usb: { vendorId: '1a86', productId: '7523' } });
    connectWithSelectedPortMock.mockResolvedValue({
      ...gbflashDevice(),
      portInfo: other,
      session: stmOnCh340,
      diagnostics: stmOnCh340.diagnostics,
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

    emitFromModal(wrapper.findComponent(PortSelectorModal), 'select', other);
    await flushPromises();

    const entries = connectionLogEntries(wrapper);
    expect(entries.some(entry => entry.message.includes('port-mismatch'))).toBe(true);
    expect(entries.some(entry => entry.details?.includes('match=mismatch'))).toBe(true);
  });
});
