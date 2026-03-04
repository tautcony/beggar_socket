import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceGatewayConnectionPortAdapter } from '@/features/burner/adapters';
import { ElectronDeviceGateway } from '@/platform/serial/electron/device-gateway';
import { WebDeviceGateway } from '@/platform/serial/web/device-gateway';

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

  return { electronAPI, serial };
}

function runConnectionPortContract(
  runtime: 'web' | 'electron',
  createPort: () => DeviceGatewayConnectionPortAdapter,
) {
  describe(`${runtime} connection port contract`, () => {
    it('supports list/select/connect/init/disconnect success path', async () => {
      const port = createPort();
      const listResult = await port.list();
      expect(listResult.ok).toBe(true);

      const selectionResult = await port.select();
      expect(selectionResult.ok).toBe(true);

      const connectResult = await port.connect(selectionResult.ok ? selectionResult.data : null);
      expect(connectResult.ok).toBe(true);
      if (!connectResult.ok) {
        return;
      }

      const initResult = await port.init(connectResult.data);
      expect(initResult.ok).toBe(true);

      const disconnectResult = await port.disconnect(connectResult.data);
      expect(disconnectResult.ok).toBe(true);
    });

    it('maps connection failures into normalized domain error structure', async () => {
      const port = createPort();
      const firstConnect = await port.connect();
      expect(firstConnect.ok).toBe(true);

      const connectResult = await port.connect();

      expect(connectResult.ok).toBe(false);
      if (connectResult.ok) {
        return;
      }
      expect(connectResult.error.stage).toBe('connection');
      expect(connectResult.error.code).toBe('connect_failed');
    });
  });
}

describe('Burner connection port adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  runConnectionPortContract('web', () => {
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

    const requestPort = vi
      .fn()
      .mockResolvedValueOnce(fakePort)
      .mockRejectedValueOnce(new Error('request failed'));
    Object.defineProperty(window.navigator, 'serial', { value: { requestPort }, configurable: true, writable: true });

    return new DeviceGatewayConnectionPortAdapter(new WebDeviceGateway());
  });

  runConnectionPortContract('electron', () => {
    const { electronAPI, serial } = createElectronApiMock();
    serial.open
      .mockResolvedValueOnce('port-1')
      .mockRejectedValueOnce(new Error('open failed'));

    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      configurable: true,
      writable: true,
    });

    return new DeviceGatewayConnectionPortAdapter(new ElectronDeviceGateway());
  });
});
