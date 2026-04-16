import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilters } from '@/utils/port-filter';

import { WebDeviceGateway } from '../src/platform/serial/web/device-gateway';

vi.mock('@/utils/async-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/async-utils')>();

  return {
    ...actual,
    timeout: vi.fn().mockResolvedValue(undefined),
  };
});

const serialPluginState = vi.hoisted(() => ({
  availablePorts: {
    '/dev/tty.usbmodem1': {
      path: '/dev/tty.usbmodem1',
      manufacturer: 'STMicroelectronics',
      pid: '0721',
      product: 'Beggar Socket',
      serial_number: 'abc123',
      type: 'USB',
      vid: '0483',
    },
  } as Record<string, {
    path: string;
    manufacturer: string;
    pid: string;
    product: string;
    serial_number: string;
    type: string;
    vid: string;
  }>,
  availablePortsDirect: {} as Record<string, {
    path: string;
    manufacturer?: string;
    pid?: string;
    product?: string;
    serial_number?: string;
    type?: string;
    vid?: string;
  }>,
  open: vi.fn(),
  close: vi.fn(),
  readBinary: vi.fn(),
  clearBuffer: vi.fn(),
  writeBinary: vi.fn(),
  writeDataTerminalReady: vi.fn(),
  writeRequestToSend: vi.fn(),
}));

vi.mock('tauri-plugin-serialplugin-api', () => {
  class MockSerialPort {
    static available_ports = vi.fn(() => Promise.resolve(serialPluginState.availablePorts));
    static available_ports_direct = vi.fn(() => Promise.resolve(serialPluginState.availablePortsDirect));

    constructor(public readonly options: Record<string, unknown>) {}

    open = serialPluginState.open;
    close = serialPluginState.close;
    readBinary = serialPluginState.readBinary;
    clearBuffer = serialPluginState.clearBuffer;
    writeBinary = serialPluginState.writeBinary;
    writeDataTerminalReady = serialPluginState.writeDataTerminalReady;
    writeRequestToSend = serialPluginState.writeRequestToSend;
  }

  return {
    SerialPort: MockSerialPort,
    DataBits: { Eight: 'Eight' },
    FlowControl: { None: 'None' },
    Parity: { None: 'None' },
    StopBits: { One: 'One' },
  };
});

describe('Device gateway integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    serialPluginState.availablePorts = {
      '/dev/tty.usbmodem1': {
        path: '/dev/tty.usbmodem1',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'abc123',
        type: 'USB',
        vid: '0483',
      },
    };
    serialPluginState.availablePortsDirect = {};
    serialPluginState.open.mockResolvedValue(undefined);
    serialPluginState.readBinary.mockResolvedValue(new Uint8Array([0xaa]));
    serialPluginState.clearBuffer.mockResolvedValue(undefined);
    serialPluginState.close.mockResolvedValue(undefined);
    serialPluginState.writeBinary.mockResolvedValue(1);
    serialPluginState.writeDataTerminalReady.mockResolvedValue(undefined);
    serialPluginState.writeRequestToSend.mockResolvedValue(undefined);
  });

  it('WebDeviceGateway covers select/connect/init/disconnect success path', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const fakePort = {
      open,
      close,
      setSignals,
      readable: {
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
      writable: {
        getWriter: vi.fn().mockReturnValue({
          write: vi.fn().mockResolvedValue(undefined),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as SerialPort;
    const requestPort = vi.fn().mockResolvedValue(fakePort);
    Object.defineProperty(window.navigator, 'serial', { value: { requestPort }, configurable: true, writable: true });

    const gateway = new WebDeviceGateway();
    const filter = PortFilters.presets.beggarSocket();
    const selection = await gateway.select(filter);
    expect(selection?.webPort).toBe(fakePort);
    expect(requestPort).toHaveBeenCalledWith({ filters: filter.toWebSerialFilters?.() });

    const device = await gateway.connect(selection);
    expect(device.platform).toBe('web');
    expect(open).toHaveBeenCalledOnce();

    await gateway.init(device);
    expect(setSignals).toHaveBeenNthCalledWith(1, { dataTerminalReady: false, requestToSend: false });
    expect(setSignals).toHaveBeenNthCalledWith(2, { dataTerminalReady: true, requestToSend: true });
    expect(setSignals).toHaveBeenNthCalledWith(3, { dataTerminalReady: false, requestToSend: false });

    await gateway.disconnect(device);
    expect(close).toHaveBeenCalledOnce();
    expect(device.port).toBeNull();
    expect(device.connection).toBeNull();
  });

  it('WebDeviceGateway propagates connect failure', async () => {
    const requestPort = vi.fn().mockRejectedValue(new Error('request denied'));
    Object.defineProperty(window.navigator, 'serial', { value: { requestPort }, configurable: true, writable: true });

    const gateway = new WebDeviceGateway();
    await expect(gateway.connect()).rejects.toThrow('request denied');
  });

  it('WebDeviceGateway clears handle state even when disconnect close fails', async () => {
    const closeError = new Error('close failed');
    const open = vi.fn().mockResolvedValue(undefined);
    const fakePort = {
      open,
      close: vi.fn().mockResolvedValue(undefined),
      setSignals: vi.fn().mockResolvedValue(undefined),
      readable: null,
      writable: null,
    } as unknown as SerialPort;
    const requestPort = vi.fn().mockResolvedValue(fakePort);
    Object.defineProperty(window.navigator, 'serial', { value: { requestPort }, configurable: true, writable: true });

    const gateway = new WebDeviceGateway();
    const device = await gateway.connect();
    device.connection = {} as never;
    device.transport.close = vi.fn().mockRejectedValue(closeError);

    await expect(gateway.disconnect(device)).rejects.toThrow('close failed');
    expect(device.port).toBeNull();
    expect(device.connection).toBeNull();

    const reconnected = await gateway.connect();
    expect(reconnected.platform).toBe('web');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('TauriDeviceGateway covers lifecycle success path', async () => {
    const gateway = new TauriDeviceGateway();
    const ports = await gateway.list();
    expect(ports).toHaveLength(1);
    expect(ports[0]).toEqual({
      path: '/dev/tty.usbmodem1',
      manufacturer: 'STMicroelectronics',
      product: 'Beggar Socket',
      serialNumber: 'abc123',
      vendorId: '0483',
      productId: '0721',
    });

    const selection = await gateway.select();
    const device = await gateway.connect(selection);
    expect(device.platform).toBe('tauri');
    expect(serialPluginState.open).toHaveBeenCalledOnce();

    await gateway.init(device);
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenNthCalledWith(1, false);
    expect(serialPluginState.writeRequestToSend).toHaveBeenNthCalledWith(1, false);
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenNthCalledWith(2, true);
    expect(serialPluginState.writeRequestToSend).toHaveBeenNthCalledWith(2, true);

    await gateway.disconnect(device);
    expect(serialPluginState.close).toHaveBeenCalled();
  });

  it('TauriDeviceGateway merges direct port discovery results', async () => {
    serialPluginState.availablePorts = {};
    serialPluginState.availablePortsDirect = {
      '/dev/tty.usbmodem2': {
        path: '/dev/tty.usbmodem2',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        serial_number: 'xyz789',
        type: 'USB',
        vid: '0483',
      },
    };

    const gateway = new TauriDeviceGateway();
    const ports = await gateway.list(PortFilters.presets.beggarSocket());

    expect(ports).toEqual([
      {
        path: '/dev/tty.usbmodem2',
        manufacturer: 'STMicroelectronics',
        product: undefined,
        serialNumber: 'xyz789',
        vendorId: '0483',
        productId: '0721',
      },
    ]);
  });

  it('TauriDeviceGateway dedupes cu/tty aliases and keeps a stable order', async () => {
    serialPluginState.availablePorts = {
      '/dev/tty.usbmodem2': {
        path: '/dev/tty.usbmodem2',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'same-device',
        type: 'USB',
        vid: '0483',
      },
      '/dev/cu.usbmodem2': {
        path: '/dev/cu.usbmodem2',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'same-device',
        type: 'USB',
        vid: '0483',
      },
      '/dev/cu.usbmodem1': {
        path: '/dev/cu.usbmodem1',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'device-1',
        type: 'USB',
        vid: '0483',
      },
    };

    const gateway = new TauriDeviceGateway();
    const ports = await gateway.list();

    expect(ports.map(port => port.path)).toEqual([
      '/dev/cu.usbmodem1',
      '/dev/cu.usbmodem2',
    ]);
  });

  it('TauriDeviceGateway handles failure semantics for select/connect', async () => {
    serialPluginState.availablePorts = {
      '/dev/a': {
        path: '/dev/a',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'a',
        type: 'USB',
        vid: '0483',
      },
      '/dev/b': {
        path: '/dev/b',
        manufacturer: 'STMicroelectronics',
        pid: '0721',
        product: 'Beggar Socket',
        serial_number: 'b',
        type: 'USB',
        vid: '0483',
      },
    };
    serialPluginState.open.mockRejectedValue(new Error('open failed'));

    const gateway = new TauriDeviceGateway();
    await expect(gateway.select()).rejects.toBeInstanceOf(PortSelectionRequiredError);
    await expect(gateway.connect({ portInfo: { path: '/dev/a', vendorId: '0483', productId: '0721' } })).rejects.toThrow('open failed');
  });

  it('TauriDeviceGateway times out stalled open attempts', async () => {
    vi.useFakeTimers();

    try {
      serialPluginState.open.mockImplementation(() => new Promise(() => {}));
      const gateway = new TauriDeviceGateway();
      const connectPromise = gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
      const connectExpectation = expect(connectPromise).rejects.toThrow('Tauri serial connect failed for /dev/tty.usbmodem1: Tauri serial connect timeout after 5000ms for /dev/tty.usbmodem1');

      await vi.advanceTimersByTimeAsync(5000);
      await connectExpectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('TauriDeviceGateway rolls signals back low when init fails mid-sequence', async () => {
    serialPluginState.writeDataTerminalReady
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('dtr high failed'))
      .mockResolvedValueOnce(undefined);
    serialPluginState.writeRequestToSend
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const gateway = new TauriDeviceGateway();
    const device = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });

    await expect(gateway.init(device)).rejects.toThrow('Tauri serial init failed for /dev/tty.usbmodem1: dtr high failed');
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenLastCalledWith(false);
    expect(serialPluginState.writeRequestToSend).toHaveBeenLastCalledWith(false);
  });

  it('TauriDeviceGateway clears handle state even when disconnect close fails', async () => {
    const gateway = new TauriDeviceGateway();
    const device = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    device.connection = {} as never;
    const closeError = new Error('close failed');
    device.transport.close = vi.fn().mockRejectedValue(closeError);
    const openCallsBeforeReconnect = serialPluginState.open.mock.calls.length;

    await expect(gateway.disconnect(device)).rejects.toThrow('close failed');
    expect(device.port).toBeNull();
    expect(device.connection).toBeNull();

    const reconnected = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    expect(reconnected.platform).toBe('tauri');
    expect(serialPluginState.open.mock.calls.length).toBe(openCallsBeforeReconnect + 1);
  });

  it('Web and Tauri init behavior is parity-consistent for signal toggling', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const webPort = {
      open,
      close,
      setSignals,
      readable: null,
      writable: null,
    } as unknown as SerialPort;
    const requestPort = vi.fn().mockResolvedValue(webPort);
    Object.defineProperty(window.navigator, 'serial', { value: { requestPort }, configurable: true, writable: true });
    const webGateway = new WebDeviceGateway();
    const webDevice = await webGateway.connect();
    await webGateway.init(webDevice);

    const tauriGateway = new TauriDeviceGateway();
    const tauriDevice = await tauriGateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    await tauriGateway.init(tauriDevice);

    expect(setSignals).toHaveBeenNthCalledWith(1, { dataTerminalReady: false, requestToSend: false });
    expect(setSignals).toHaveBeenNthCalledWith(2, { dataTerminalReady: true, requestToSend: true });
    expect(setSignals).toHaveBeenNthCalledWith(3, { dataTerminalReady: false, requestToSend: false });
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenNthCalledWith(1, false);
    expect(serialPluginState.writeRequestToSend).toHaveBeenNthCalledWith(1, false);
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenNthCalledWith(2, true);
    expect(serialPluginState.writeRequestToSend).toHaveBeenNthCalledWith(2, true);
    expect(serialPluginState.writeDataTerminalReady).toHaveBeenNthCalledWith(3, false);
    expect(serialPluginState.writeRequestToSend).toHaveBeenNthCalledWith(3, false);
  });
});
