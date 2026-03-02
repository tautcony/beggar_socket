import { timeout } from '@/utils/async-utils';
import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

import { WebSerialTransport } from '../transports';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';

export class WebDeviceGateway implements DeviceGateway {
  list(_filter?: PortFilter): Promise<SerialPortInfo[]> {
    return Promise.resolve([]);
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
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
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    const port = selection?.webPort ?? await navigator.serial.requestPort({
      filters: selection?.webSerialFilters ?? [],
    });
    await port.open({
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: 'none',
    });

    return {
      platform: 'web',
      transport: new WebSerialTransport(port),
      port,
      connection: null,
    };
  }

  async init(device: DeviceHandle): Promise<void> {
    await device.transport.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(200);
    await device.transport.setSignals({ dataTerminalReady: true, requestToSend: true });
  }

  async disconnect(device: DeviceHandle): Promise<void> {
    if (device.transport.close) {
      await device.transport.close();
    }
    device.port = null;
    device.connection = null;
  }
}
