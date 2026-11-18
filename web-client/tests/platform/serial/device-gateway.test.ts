import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDeviceGateway, resetDeviceGatewayForTests } from '@/platform/serial';
import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';
import { TauriSerialTransport } from '@/platform/serial/tauri/tauri-serial-transport';
import { WebDeviceGateway } from '@/platform/serial/web/device-gateway';
import { DebugSettings } from '@/settings/debug-settings';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import { PortFilters } from '@/utils/port-filter';

interface MockAvailablePort {
  path: string;
  manufacturer: string;
  product?: string;
  productId: string;
  serialNumber: string;
  vendorId: string;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface NativeState {
  availablePorts: MockAvailablePort[];
  openNativeSerialPort: ReturnType<typeof vi.fn>;
  closeNativeSerial: ReturnType<typeof vi.fn>;
  readNativeSerial: ReturnType<typeof vi.fn>;
  flushNativeSerialInput: ReturnType<typeof vi.fn>;
  writeNativeSerial: ReturnType<typeof vi.fn>;
  setNativeSerialSignals: ReturnType<typeof vi.fn>;
}

vi.mock('@/utils/async-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/async-utils')>();

  return {
    ...actual,
    timeout: vi.fn().mockResolvedValue(undefined),
  };
});

const nativeState = vi.hoisted<NativeState>(() => ({
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

describe('Device gateway integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetDeviceGatewayForTests();
    DebugSettings.debugMode = false;
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
    nativeState.readNativeSerial.mockResolvedValue(new Uint8Array([0xaa]));
    nativeState.flushNativeSerialInput.mockResolvedValue(undefined);
    nativeState.closeNativeSerial.mockResolvedValue(undefined);
    nativeState.writeNativeSerial.mockResolvedValue(undefined);
    nativeState.setNativeSerialSignals.mockResolvedValue(undefined);
  });

  it('gateway factory routes to simulated gateway when debug mode is enabled', async () => {
    DebugSettings.debugMode = true;
    const gateway = getDeviceGateway();

    const ports = await gateway.list();
    expect(ports).toEqual([
      expect.objectContaining({
        path: 'simulated://beggar-socket',
        vendorId: '0483',
        productId: '0721',
      }),
    ]);

    const device = await gateway.connect();
    expect(device.platform).toBe('simulated');

    DebugSettings.debugMode = false;
    await gateway.init(device);
    await gateway.disconnect(device);
    expect(device.port).toBeNull();
  });

  it('WebDeviceGateway covers select/connect/init/disconnect success path', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const fakePort = {
      open,
      close,
      getInfo: vi.fn(() => ({ usbVendorId: 0x0483, usbProductId: 0x0721 })),
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
    expect(device.portInfo).toEqual({
      path: 'web-serial',
      vendorId: '0483',
      productId: '0721',
    });
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
    expect(nativeState.openNativeSerialPort).toHaveBeenCalledWith('/dev/tty.usbmodem1');

    await gateway.init(device);
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(1, 1, { dataTerminalReady: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(2, 1, { requestToSend: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(3, 1, { dataTerminalReady: true });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(4, 1, { requestToSend: true });

    await gateway.disconnect(device);
    expect(nativeState.closeNativeSerial).toHaveBeenCalledWith(1);
  });

  it('TauriDeviceGateway maps native port discovery results', async () => {
    nativeState.availablePorts = [
      {
        path: '/dev/tty.usbmodem2',
        manufacturer: 'STMicroelectronics',
        productId: '0721',
        serialNumber: 'xyz789',
        vendorId: '0483',
      },
    ];

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
    nativeState.availablePorts = [
      {
        path: '/dev/tty.usbmodem2',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'same-device',
        vendorId: '0483',
      },
      {
        path: '/dev/cu.usbmodem2',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'same-device',
        vendorId: '0483',
      },
      {
        path: '/dev/cu.usbmodem1',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'device-1',
        vendorId: '0483',
      },
    ];

    const gateway = new TauriDeviceGateway();
    const ports = await gateway.list();

    expect(ports.map(port => port.path)).toEqual([
      '/dev/cu.usbmodem1',
      '/dev/cu.usbmodem2',
    ]);
  });

  it('TauriDeviceGateway handles failure semantics for select/connect', async () => {
    nativeState.availablePorts = [
      {
        path: '/dev/a',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'a',
        vendorId: '0483',
      },
      {
        path: '/dev/b',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        productId: '0721',
        serialNumber: 'b',
        vendorId: '0483',
      },
    ];
    nativeState.openNativeSerialPort.mockRejectedValue(new Error('open failed'));

    const gateway = new TauriDeviceGateway();
    await expect(gateway.select()).rejects.toBeInstanceOf(PortSelectionRequiredError);
    await expect(gateway.connect({ portInfo: { path: '/dev/a', vendorId: '0483', productId: '0721' } })).rejects.toThrow('open failed');
  });

  it('TauriDeviceGateway times out stalled open attempts', async () => {
    vi.useFakeTimers();

    try {
      nativeState.openNativeSerialPort.mockReturnValue(new Promise(() => {}));
      const gateway = new TauriDeviceGateway();
      const connectPromise = gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
      const connectExpectation = expect(connectPromise).rejects.toThrow('Tauri serial connect failed for /dev/tty.usbmodem1: Tauri serial connect timeout after 5000ms for /dev/tty.usbmodem1');

      await vi.advanceTimersByTimeAsync(5000);
      await connectExpectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([false, true])('TauriDeviceGateway reclaims late open with cleanup failure=%s', async (cleanupFails) => {
    vi.useFakeTimers();
    const cleanupError = new Error('native cleanup failed');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const lateOpen = deferred<{ sessionId: number }>();
      const cleanup = deferred<undefined>();
      nativeState.openNativeSerialPort.mockReturnValueOnce(lateOpen.promise);
      nativeState.closeNativeSerial.mockReturnValueOnce(cleanup.promise);
      const gateway = new TauriDeviceGateway();
      const selection = { portInfo: { path: '/dev/tty.usbmodem1' } };
      const connection = gateway.connect(selection);
      const rejected = expect(connection).rejects.toThrow('connect timeout after 5000ms');
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;

      // A later healthy attempt must keep its own session while the timed-out one is reclaimed.
      nativeState.openNativeSerialPort.mockResolvedValueOnce({ sessionId: 2 });
      const healthyDevice = await gateway.connect(selection);
      expect(nativeState.closeNativeSerial).not.toHaveBeenCalled();
      lateOpen.resolve({ sessionId: 77 });
      await vi.advanceTimersByTimeAsync(0);
      expect(nativeState.closeNativeSerial).toHaveBeenCalledExactlyOnceWith(77);
      if (cleanupFails) {
        cleanup.reject(cleanupError);
      } else {
        cleanup.resolve(undefined);
      }
      await vi.advanceTimersByTimeAsync(0);
      if (cleanupFails) {
        expect(errorLog).toHaveBeenCalledWith('[TauriDeviceGateway] late open cleanup failed', {
          port: selection.portInfo.path,
          sessionId: 77,
          error: cleanupError,
        });
      } else {
        expect(errorLog).not.toHaveBeenCalled();
      }
      await healthyDevice.transport.send(new Uint8Array([1]));
      expect(nativeState.writeNativeSerial).toHaveBeenLastCalledWith(2, new Uint8Array([1]), expect.any(Number));
    } finally {
      vi.useRealTimers();
    }
  });

  it('TauriDeviceGateway handles late native open rejection after timeout', async () => {
    vi.useFakeTimers();
    try {
      const lateOpen = deferred<{ sessionId: number }>();
      nativeState.openNativeSerialPort.mockReturnValueOnce(lateOpen.promise);
      const connection = new TauriDeviceGateway().connect({ portInfo: { path: '/dev/late' } });
      const rejected = expect(connection).rejects.toThrow('connect timeout after 5000ms');
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      lateOpen.reject(new Error('late open failed'));
      await vi.advanceTimersByTimeAsync(0);
      expect(nativeState.closeNativeSerial).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('TauriDeviceGateway preserves an open completed just before the deadline', async () => {
    vi.useFakeTimers();
    try {
      const open = deferred<{ sessionId: number }>();
      nativeState.openNativeSerialPort.mockReturnValueOnce(open.promise);
      const connection = new TauriDeviceGateway().connect({ portInfo: { path: '/dev/healthy' } });
      await vi.advanceTimersByTimeAsync(4999);
      open.resolve({ sessionId: 88 });
      const device = await connection;
      await vi.advanceTimersByTimeAsync(5001);
      expect(nativeState.closeNativeSerial).not.toHaveBeenCalled();
      await device.transport.send(new Uint8Array([1]));
      expect(nativeState.writeNativeSerial).toHaveBeenLastCalledWith(88, new Uint8Array([1]), expect.any(Number));
    } finally {
      vi.useRealTimers();
    }
  });

  it('TauriDeviceGateway diagnoses cleanup failure after listener attachment fails', async () => {
    const attachError = new Error('listener attach failed');
    const cleanupError = new Error('close failed');
    vi.spyOn(TauriSerialTransport.prototype, 'attachListener').mockRejectedValueOnce(attachError);
    nativeState.closeNativeSerial.mockRejectedValueOnce(cleanupError);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new TauriDeviceGateway().connect({ portInfo: { path: '/dev/listener' } }))
      .rejects.toThrow('Tauri serial listener attach failed for /dev/listener: listener attach failed');
    expect(nativeState.closeNativeSerial).toHaveBeenCalledExactlyOnceWith(1);
    expect(errorLog).toHaveBeenCalledWith('[TauriDeviceGateway] listener attach cleanup failed', {
      port: '/dev/listener',
      sessionId: 1,
      error: cleanupError,
    });
  });

  it('TauriDeviceGateway rolls signals back low when init fails mid-sequence', async () => {
    nativeState.setNativeSerialSignals
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('dtr high failed'))
      .mockResolvedValueOnce(undefined);

    const gateway = new TauriDeviceGateway();
    const device = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });

    await expect(gateway.init(device)).rejects.toThrow('Tauri serial init failed for /dev/tty.usbmodem1: dtr high failed');
    expect(nativeState.setNativeSerialSignals).toHaveBeenLastCalledWith(1, { requestToSend: false });
  });

  it('TauriDeviceGateway clears handle state even when disconnect close fails', async () => {
    const gateway = new TauriDeviceGateway();
    const device = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    device.connection = {} as never;
    const closeError = new Error('close failed');
    device.transport.close = vi.fn().mockRejectedValue(closeError);
    const openCallsBeforeReconnect = nativeState.openNativeSerialPort.mock.calls.length;

    await expect(gateway.disconnect(device)).rejects.toThrow('close failed');
    expect(device.port).toBeNull();
    expect(device.connection).toBeNull();

    const reconnected = await gateway.connect({ portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } });
    expect(reconnected.platform).toBe('tauri');
    expect(nativeState.openNativeSerialPort.mock.calls.length).toBe(openCallsBeforeReconnect + 1);
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
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(1, 1, { dataTerminalReady: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(2, 1, { requestToSend: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(3, 1, { dataTerminalReady: true });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(4, 1, { requestToSend: true });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(5, 1, { dataTerminalReady: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(6, 1, { requestToSend: false });
  });
});
