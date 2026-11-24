import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionPlan } from '@/device/session';
import type { SessionEstablishment } from '@/device-runtime';
import { DeviceGatewayConnectionPortAdapter } from '@/features/burner/adapters';
import { ConnectionOrchestrationUseCase } from '@/features/burner/application';
import type { DeviceGateway } from '@/platform/serial';
import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';
import { WebDeviceGateway } from '@/platform/serial/web/device-gateway';

vi.mock('@/utils/async-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/async-utils')>();

  return {
    ...actual,
    timeout: vi.fn().mockResolvedValue(undefined),
  };
});

const nativeState = vi.hoisted(() => ({
  availablePorts: [
    {
      path: '/dev/tty.usbmodem1',
      manufacturer: 'STMicroelectronics',
      product: 'Beggar Socket',
      productId: '0721',
      serialNumber: 'abc123',
      vendorId: '0483',
    },
  ],
  openNativeSerialPort: vi.fn(),
  closeNativeSerial: vi.fn(),
  readNativeSerial: vi.fn(),
  flushNativeSerialInput: vi.fn(),
  writeNativeSerial: vi.fn(),
  setNativeSerialSignals: vi.fn(),
}));

vi.mock('@/platform/native', () => {
  return {
    listNativeSerialPorts: vi.fn(() => Promise.resolve(nativeState.availablePorts)),
    openNativeSerialPort: nativeState.openNativeSerialPort,
    closeNativeSerial: nativeState.closeNativeSerial,
    readNativeSerial: nativeState.readNativeSerial,
    flushNativeSerialInput: nativeState.flushNativeSerialInput,
    writeNativeSerial: nativeState.writeNativeSerial,
    setNativeSerialSignals: nativeState.setNativeSerialSignals,
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
        nativeState.openNativeSerialPort.mockRejectedValueOnce(new Error('open failed'));
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
    nativeState.availablePorts = [
      {
        path: '/dev/tty.usbmodem1',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'abc123',
        vendorId: '0483',
      },
    ];
    nativeState.openNativeSerialPort.mockResolvedValue({ sessionId: 1 });
    nativeState.closeNativeSerial.mockResolvedValue(undefined);
    nativeState.readNativeSerial.mockResolvedValue(new Uint8Array([0xaa]));
    nativeState.flushNativeSerialInput.mockResolvedValue(undefined);
    nativeState.writeNativeSerial.mockResolvedValue(undefined);
    nativeState.setNativeSerialSignals.mockResolvedValue(undefined);
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

describe('connection port shutdown diagnostics', () => {
  const teardownDiagnostic = {
    code: 'teardown-failed',
    severity: 'warning' as const,
    message: 'protocol teardown failed',
    stage: 'disconnect' as const,
  };

  function stubGateway(overrides: Partial<DeviceGateway> = {}): DeviceGateway {
    const portInfo = { path: 'web-serial', vendorId: '1a86', productId: '7523' };
    return {
      list: vi.fn().mockResolvedValue([portInfo]),
      select: vi.fn().mockResolvedValue({ portInfo }),
      connect: vi.fn().mockResolvedValue({
        platform: 'web' as const,
        transport: {},
        port: null,
        portInfo,
      }),
      init: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function createAdapter(gateway: DeviceGateway, teardown = vi.fn().mockResolvedValue([teardownDiagnostic])) {
    const establishment = {
      establish: vi.fn().mockResolvedValue({
        active: { connectionId: 'handle-1', profile: {}, transport: {} },
        diagnostics: [],
      }),
      teardown,
    } as unknown as SessionEstablishment;
    return { adapter: new DeviceGatewayConnectionPortAdapter(gateway, establishment), teardown };
  }

  async function openSession(adapter: DeviceGatewayConnectionPortAdapter) {
    const selection = await adapter.select();
    const connected = await adapter.connect(selection.ok ? selection.data : null);
    if (!connected.ok || !adapter.establishSession) {
      throw new Error('the adapter did not open a handle');
    }
    const session = await adapter.establishSession(connected.data);
    expect(session.ok).toBe(true);
    return connected.data;
  }

  it('keeps the teardown diagnostic when the port close fails as well', async () => {
    const gateway = stubGateway({ disconnect: vi.fn().mockRejectedValue(new Error('close failed')) });
    const { adapter } = createAdapter(gateway);
    const handle = await openSession(adapter);

    const result = await adapter.disconnect(handle);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    // Which half of the shutdown failed must stay visible: a single "disconnect failed"
    // would hide the protocol teardown that also went wrong.
    expect(result.error.diagnostics?.map(diagnostic => diagnostic.code))
      .toEqual(['teardown-failed', 'port-close-failed']);
    expect(result.error.code).toBe('disconnect_failed');
  });

  it('drops the committed identity before the close so cleanup cannot revive it', async () => {
    const gateway = stubGateway({ disconnect: vi.fn().mockRejectedValue(new Error('close failed')) });
    const { adapter, teardown } = createAdapter(gateway);
    const handle = await openSession(adapter);

    await adapter.disconnect(handle);
    // The retry of the close is a port release, not a second teardown of a dead session.
    await adapter.disconnect(handle);

    expect(teardown).toHaveBeenCalledOnce();
  });
});

describe('Web Serial granted ports', () => {
  /** Port plus its `open` spy, kept apart so the spy can be asserted unbound. */
  function fakePort(info: { usbVendorId?: number; usbProductId?: number }) {
    const open = vi.fn().mockResolvedValue(undefined);
    return {
      open,
      port: {
        open,
        close: vi.fn().mockResolvedValue(undefined),
        setSignals: vi.fn().mockResolvedValue(undefined),
        getInfo: () => info,
        readable: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
            releaseLock: vi.fn(),
          }),
        },
        writable: {
          getWriter: () => ({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as SerialPort,
    };
  }

  function installSerial(api: { getPorts: ReturnType<typeof vi.fn>; requestPort: ReturnType<typeof vi.fn> }) {
    Object.defineProperty(window.navigator, 'serial', { value: api, configurable: true, writable: true });
  }

  it('lists granted ports and reads their identity before opening', async () => {
    const { open, port } = fakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
    installSerial({ getPorts: vi.fn().mockResolvedValue([port]), requestPort: vi.fn() });
    const gateway = new WebDeviceGateway();

    // Web Serial can only enumerate ports the user already granted, which is exactly the
    // retry case: the list is no longer always empty.
    expect(await gateway.list()).toEqual([{ path: 'web-serial', vendorId: '1a86', productId: '7523' }]);
    expect(open).not.toHaveBeenCalled();
  });

  it('reports the identity of a newly granted port without opening it', async () => {
    const { open, port } = fakePort({ usbVendorId: 0x0483, usbProductId: 0x0721 });
    installSerial({ getPorts: vi.fn().mockResolvedValue([]), requestPort: vi.fn().mockResolvedValue(port) });
    const gateway = new WebDeviceGateway();

    const selection = await gateway.select();

    expect(selection?.portInfo).toEqual({ path: 'web-serial', vendorId: '0483', productId: '0721' });
    expect(selection?.webPort).toBe(port);
    expect(open).not.toHaveBeenCalled();
  });

  it('reopens a granted port for a retry instead of prompting again', async () => {
    const { open, port } = fakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
    const requestPort = vi.fn();
    installSerial({ getPorts: vi.fn().mockResolvedValue([port]), requestPort });
    const gateway = new WebDeviceGateway();
    await gateway.list();

    const handle = await gateway.connect({
      portInfo: { path: 'web-serial', vendorId: '1a86', productId: '7523' },
      baudRate: 1_000_000,
    });

    expect(requestPort).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ baudRate: 1_000_000 }));
    expect(handle.portInfo).toEqual({ path: 'web-serial', vendorId: '1a86', productId: '7523' });
  });
});

describe('Web Serial retry attempts', () => {
  /** Open spy that fails once (port busy) and then succeeds. */
  function createWebPort() {
    const open = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to open serial port: port is busy'))
      .mockResolvedValue(undefined);
    const port = {
      open,
      close: vi.fn().mockResolvedValue(undefined),
      setSignals: vi.fn().mockResolvedValue(undefined),
      getInfo: () => ({ usbVendorId: 0x0483, usbProductId: 0x0721 }),
      readable: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
      writable: {
        getWriter: () => ({
          write: vi.fn().mockResolvedValue(undefined),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as SerialPort;
    return { open, port };
  }

  function installSerial(port: SerialPort) {
    const requestPort = vi.fn().mockResolvedValue(port);
    Object.defineProperty(window.navigator, 'serial', {
      value: { getPorts: vi.fn().mockResolvedValue([]), requestPort },
      configurable: true,
      writable: true,
    });
    return { requestPort };
  }

  const GBFLASH_PLAN: ConnectionPlan = {
    variantId: 'gbflash',
    parameters: {},
    baudRate: 2_000_000,
  };
  /** A standard STM binding declares no baud rate at all. */
  const STM_PLAN: ConnectionPlan = { variantId: 'stm', parameters: {} };

  async function openOnceAndFail() {
    const { open, port } = createWebPort();
    const { requestPort } = installSerial(port);
    const portAdapter = new DeviceGatewayConnectionPortAdapter(new WebDeviceGateway());
    const useCase = new ConnectionOrchestrationUseCase(portAdapter);

    const first = await useCase.prepareConnection({
      plan: GBFLASH_PLAN,
      baudRate: 2_000_000,
      skipSignalInit: true,
    });

    expect(first.success).toBe(false);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ baudRate: 2_000_000 }));
    // The browser keeps the grant, so the failure leaves a port that may be retried.
    expect(useCase.retryableSelection).not.toBeNull();
    return { open, requestPort, useCase };
  }

  it('opens the authorized port with the retry plan baud rate instead of the failed one', async () => {
    const { open, requestPort, useCase } = await openOnceAndFail();

    // The user switches to a standard STM selection and retries: nothing may inherit the
    // 2 Mbps of the GBFlash attempt, because STM opens at the serial default.
    const retried = await useCase.retryConnection({ plan: STM_PLAN, skipSignalInit: true });

    expect(retried.success).toBe(true);
    expect(requestPort).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ baudRate: 9600 }));
  });

  it('reuses nothing but the port identity when the retry plan changes', async () => {
    const { useCase } = await openOnceAndFail();
    const portAdapter = new DeviceGatewayConnectionPortAdapter(new WebDeviceGateway());
    const previous = useCase.retryableSelection;
    expect(previous).not.toBeNull();
    if (!previous) {
      return;
    }

    const reused = portAdapter.reuseSelection(previous, { plan: STM_PLAN, skipSignalInit: false });

    // The web port handle survives; every open parameter is rebuilt from this attempt.
    const reusedContext = reused.context as Record<string, unknown>;
    expect(reusedContext).toMatchObject({
      portInfo: expect.objectContaining({ path: 'web-serial', vendorId: '0483', productId: '0721' }),
      webPort: (previous.context as { webPort: unknown }).webPort,
      skipSignalInit: false,
    });
    expect(reusedContext).not.toHaveProperty('baudRate');
    expect(reused.plan).toBe(STM_PLAN);
  });

  it('prompts for another port even when a granted port could be reused', async () => {
    const { requestPort, useCase } = await openOnceAndFail();

    // "Choose another port" asks for a fresh prompt, so it must not reuse the granted port
    // (the one the user just rejected, or the one that is still busy).
    await useCase.prepareConnection({ plan: STM_PLAN, skipSignalInit: true });

    expect(requestPort).toHaveBeenCalledTimes(2);
  });
});
