import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

import { DEFAULT_SERIAL_CONFIG } from '../constants';
import { initDeviceSignals } from '../device-signals';
import { WebSerialTransport } from '../transports';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';

/**
 * Synthetic path of one granted Web Serial port.
 *
 * Web Serial gives no device path, so the identity we expose is the USB id pair plus this
 * stable label. It is stable for one browser session, which is all the port list, the
 * discovery diagnostics and the retry path need.
 */
function webPathFor(index: number, total: number): string {
  return total <= 1 ? 'web-serial' : `web-serial#${index + 1}`;
}

/**
 * Reads the USB identity of a port *before* it is opened: `getInfo()` is available on a
 * granted port, so discovery and matching never have to wait for `open()`.
 */
function toWebSerialPortInfo(port: SerialPort, path = 'web-serial'): SerialPortInfo {
  const info = port.getInfo?.();
  const vendorId = info?.usbVendorId !== undefined ? info.usbVendorId.toString(16).padStart(4, '0') : undefined;
  const productId = info?.usbProductId !== undefined ? info.usbProductId.toString(16).padStart(4, '0') : undefined;
  return {
    path,
    ...(vendorId ? { vendorId } : {}),
    ...(productId ? { productId } : {}),
  };
}

/** The browser's Web Serial surface (`navigator.serial`), or undefined outside a browser. */
type WebSerialApi = NonNullable<Navigator['serial']>;

function serialApi(): WebSerialApi | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.serial;
}

export class WebDeviceGateway implements DeviceGateway {
  /** Ports this page may open without a new user gesture, keyed by their exposed path. */
  private readonly granted = new Map<string, SerialPort>();

  /**
   * Granted ports (`getPorts()`), never a user prompt.
   *
   * Web Serial cannot enumerate ports that were never granted, so an empty list simply
   * means "nothing authorized yet"; the caller falls back to `select()`.
   */
  async list(filter?: PortFilter): Promise<SerialPortInfo[]> {
    const serial = serialApi();
    if (!serial?.getPorts) {
      return [];
    }

    let ports: SerialPort[];
    try {
      ports = await serial.getPorts();
    } catch {
      return [];
    }

    const described = ports.map((port, index) => {
      const info = toWebSerialPortInfo(port, webPathFor(index, ports.length));
      this.granted.set(info.path, port);
      return info;
    });
    return filter ? described.filter(filter) : described;
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
    const serial = serialApi();
    if (!serial) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    const serialPortFilters = filter?.toWebSerialFilters ? filter.toWebSerialFilters() : [];
    const port = await serial.requestPort({ filters: serialPortFilters });

    if (!port) {
      return null;
    }

    // Identity is read here, before `open()`: the attempt snapshot, the match diagnostics
    // and the connection log all use it, even when opening the port then fails.
    const portInfo = toWebSerialPortInfo(port);
    this.granted.set(portInfo.path, port);
    return {
      portInfo,
      webPort: port,
      webSerialFilters: serialPortFilters,
    };
  }

  async connect(selection?: DeviceSelection | null): Promise<DeviceHandle> {
    const serial = serialApi();
    if (!serial) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    const port = selection?.webPort
      ?? (selection?.portInfo?.path ? this.granted.get(selection.portInfo.path) : undefined)
      ?? await serial.requestPort({ filters: selection?.webSerialFilters ?? [] });
    const baudRate = selection?.baudRate ?? DEFAULT_SERIAL_CONFIG.baudRate;
    await port.open({
      baudRate,
      dataBits: DEFAULT_SERIAL_CONFIG.dataBits,
      parity: DEFAULT_SERIAL_CONFIG.parity,
      stopBits: DEFAULT_SERIAL_CONFIG.stopBits,
      flowControl: DEFAULT_SERIAL_CONFIG.flowControl,
      bufferSize: DEFAULT_SERIAL_CONFIG.bufferSize,
    });

    return {
      platform: 'web',
      transport: new WebSerialTransport(port),
      port,
      connection: null,
      portInfo: selection?.portInfo ?? toWebSerialPortInfo(port),
      skipSignalInit: Boolean(selection?.skipSignalInit),
    };
  }

  async init(device: DeviceHandle): Promise<void> {
    if (device.skipSignalInit) {
      return;
    }
    await initDeviceSignals(device.transport);
  }

  async disconnect(device: DeviceHandle): Promise<void> {
    let closeError: unknown;

    try {
      if (device.transport.close) {
        await device.transport.close();
      }
    } catch (error) {
      closeError = error;
    } finally {
      device.port = null;
      device.connection = null;
    }

    if (closeError) {
      throw closeError instanceof Error ? closeError : new Error('Serial close failed');
    }
  }
}
