import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceGatewayConnectionPortAdapter } from '@/features/burner/adapters';
import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';
import { WebDeviceGateway } from '@/platform/serial/web/device-gateway';

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
  },
  availablePortsDirect: {},
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

function runConnectionPortContract(
  runtime: 'web' | 'tauri',
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

      if (runtime === 'tauri') {
        serialPluginState.open.mockRejectedValueOnce(new Error('open failed'));
      }

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
    serialPluginState.open.mockResolvedValue(undefined);
    serialPluginState.availablePortsDirect = {};
    serialPluginState.close.mockResolvedValue(undefined);
    serialPluginState.readBinary.mockResolvedValue(new Uint8Array([0xaa]));
    serialPluginState.clearBuffer.mockResolvedValue(undefined);
    serialPluginState.writeBinary.mockResolvedValue(1);
    serialPluginState.writeDataTerminalReady.mockResolvedValue(undefined);
    serialPluginState.writeRequestToSend.mockResolvedValue(undefined);
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

  runConnectionPortContract('tauri', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
      writable: true,
    });

    return new DeviceGatewayConnectionPortAdapter(new TauriDeviceGateway());
  });
});
