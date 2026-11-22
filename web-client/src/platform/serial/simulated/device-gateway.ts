import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

import { DEFAULT_SERIAL_CONFIG } from '../constants';
import { initDeviceSignals } from '../device-signals';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';
import { createSimulatedDeviceState, getSimulatedPortInfo } from './runtime';
import { SimulatedTransport } from './transport';

export class SimulatedDeviceGateway implements DeviceGateway {
  list(filter?: PortFilter): Promise<SerialPortInfo[]> {
    const port = getSimulatedPortInfo();
    return Promise.resolve(filter && !filter(port) ? [] : [port]);
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
    const ports = await this.list(filter);
    return ports[0] ? { portInfo: ports[0] } : null;
  }

  connect(selection?: DeviceSelection | null): Promise<DeviceHandle> {
    const portInfo = selection?.portInfo ?? getSimulatedPortInfo();
    const _baudRate = selection?.baudRate ?? DEFAULT_SERIAL_CONFIG.baudRate;
    return Promise.resolve({
      platform: 'simulated',
      transport: new SimulatedTransport(createSimulatedDeviceState()),
      port: null,
      connection: null,
      portInfo,
      skipSignalInit: Boolean(selection?.skipSignalInit),
    });
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
      throw closeError instanceof Error ? closeError : new Error('Simulated transport close failed');
    }
  }
}
