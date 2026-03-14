import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ElectronDeviceGateway } from '@/platform/serial/electron/device-gateway';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilters } from '@/utils/port-filter';

import { WebDeviceGateway } from '../src/platform/serial/web/device-gateway';

vi.mock('@/utils/async-utils', () => ({
  timeout: vi.fn().mockResolvedValue(undefined),
}));

interface ElectronCallbacks {
  onData?: (portId: string, data: Uint8Array) => void;
  onError?: (portId: string, error: string) => void;
  onClose?: (portId: string) => void;
}

function createElectronApiMock() {
  const callbacks: ElectronCallbacks = {};

  const serial = {
    listPorts: vi.fn().mockResolvedValue([
      { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' },
    ]),
    open: vi.fn().mockResolvedValue('port-1'),
    write: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    isOpen: vi.fn().mockResolvedValue(true),
    setSignals: vi.fn().mockResolvedValue(true),
    onData: vi.fn((cb: (portId: string, data: Uint8Array) => void) => {
      callbacks.onData = cb;
    }),
    onError: vi.fn((cb: (portId: string, error: string) => void) => {
      callbacks.onError = cb;
    }),
    onClose: vi.fn((cb: (portId: string) => void) => {
      callbacks.onClose = cb;
    }),
    removeAllListeners: vi.fn(),
  };

  const electronAPI = {
    getPlatform: vi.fn().mockResolvedValue('darwin'),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    requestSerialPort: vi.fn().mockResolvedValue({ granted: true }),
    selectSerialPort: vi.fn().mockResolvedValue({
      ports: [{ path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' }],
      needsSelection: false,
    }),
    serial,
    isElectron: true,
    versions: { node: '22', chrome: '128', electron: '33' },
  };

  return { electronAPI, serial, callbacks };
}

describe('Device gateway integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    expect(setSignals).toHaveBeenNthCalledWith(1, { dataTerminalReady: true, requestToSend: true });
    expect(setSignals).toHaveBeenNthCalledWith(2, { dataTerminalReady: false, requestToSend: false });

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

  it('ElectronDeviceGateway covers lifecycle success path', async () => {
    const { electronAPI, serial } = createElectronApiMock();
    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      configurable: true,
      writable: true,
    });

    const gateway = new ElectronDeviceGateway();
    const ports = await gateway.list();
    expect(ports).toHaveLength(1);

    const selection = await gateway.select();
    const device = await gateway.connect(selection);
    expect(device.platform).toBe('electron');
    expect(serial.open).toHaveBeenCalledOnce();

    await gateway.init(device);
    expect(serial.setSignals).toHaveBeenNthCalledWith(1, 'port-1', { dataTerminalReady: true, requestToSend: true });
    expect(serial.setSignals).toHaveBeenNthCalledWith(2, 'port-1', { dataTerminalReady: false, requestToSend: false });

    await gateway.disconnect(device);
    expect(serial.close).toHaveBeenCalledWith('port-1');
  });

  it('ElectronDeviceGateway handles failure semantics for select/connect', async () => {
    const { electronAPI, serial } = createElectronApiMock();
    electronAPI.selectSerialPort.mockResolvedValue({
      ports: [
        { path: '/dev/a', vendorId: '0483', productId: '0721' },
        { path: '/dev/b', vendorId: '0483', productId: '0721' },
      ],
      needsSelection: true,
    });
    serial.open.mockRejectedValue(new Error('open failed'));

    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      configurable: true,
      writable: true,
    });

    const gateway = new ElectronDeviceGateway();
    await expect(gateway.select()).rejects.toBeInstanceOf(PortSelectionRequiredError);
    await expect(gateway.connect({ portInfo: { path: '/dev/a', vendorId: '0483', productId: '0721' } })).rejects.toThrow('open failed');
  });

  it('Web and Electron init behavior is parity-consistent for signal toggling', async () => {
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

    const { electronAPI, serial } = createElectronApiMock();
    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      configurable: true,
      writable: true,
    });
    const electronGateway = new ElectronDeviceGateway();
    const electronDevice = await electronGateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    await electronGateway.init(electronDevice);

    expect(setSignals).toHaveBeenNthCalledWith(1, { dataTerminalReady: true, requestToSend: true });
    expect(setSignals).toHaveBeenNthCalledWith(2, { dataTerminalReady: false, requestToSend: false });
    expect(serial.setSignals).toHaveBeenNthCalledWith(1, 'port-1', { dataTerminalReady: true, requestToSend: true });
    expect(serial.setSignals).toHaveBeenNthCalledWith(2, 'port-1', { dataTerminalReady: false, requestToSend: false });
  });
});
