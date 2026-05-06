import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

import { DEFAULT_SERIAL_CONFIG } from '../constants';
import { initDeviceSignals } from '../device-signals';
import { WebSerialTransport } from '../transports';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';

function toWebSerialPortInfo(port: SerialPort): SerialPortInfo | undefined {
  const info = port.getInfo?.();
  if (!info) {
    return undefined;
  }

  return {
    path: 'web-serial',
    vendorId: info.usbVendorId?.toString(16).padStart(4, '0'),
    productId: info.usbProductId?.toString(16).padStart(4, '0'),
  };
}

export class WebDeviceGateway implements DeviceGateway {
  list(_filter?: PortFilter): Promise<SerialPortInfo[]> {
    return Promise.resolve([]);
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
    if (!navigator.serial) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    const serialPortFilters = filter?.toWebSerialFilters ? filter.toWebSerialFilters() : [];
    const port = await navigator.serial.requestPort({ filters: serialPortFilters });

    if (!port) {
      return null;
    }

    return {
      webPort: port,
      webSerialFilters: serialPortFilters,
    };
  }

  async connect(selection?: DeviceSelection | null): Promise<DeviceHandle> {
    if (!navigator.serial) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    const port = selection?.webPort ?? await navigator.serial.requestPort({
      filters: selection?.webSerialFilters ?? [],
    });
    await port.open({
      baudRate: DEFAULT_SERIAL_CONFIG.baudRate,
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
      portInfo: toWebSerialPortInfo(port),
    };
  }

  async init(device: DeviceHandle): Promise<void> {
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
