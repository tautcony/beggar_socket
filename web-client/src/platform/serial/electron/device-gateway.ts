import type { SerialConnection, SerialPortInfo } from '@/types/serial';
import { timeout } from '@/utils/async-utils';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import type { PortFilter } from '@/utils/port-filter';

import { ConnectionTransport } from '../transports';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';

type DataListener = (data: Uint8Array) => void;
type ErrorListener = (error: string) => void;
type CloseListener = () => void;

export class ElectronDeviceGateway implements DeviceGateway {
  private readonly connections = new Map<string, SerialConnection>();
  private readonly dataListeners = new Map<string, DataListener>();
  private readonly errorListeners = new Map<string, ErrorListener>();
  private readonly closeListeners = new Map<string, CloseListener>();
  private listenersBound = false;

  constructor() {
    this.setupListeners();
  }

  async list(filter?: PortFilter): Promise<SerialPortInfo[]> {
    const ports = await window.electronAPI.serial.listPorts();
    return filter ? ports.filter(filter) : ports;
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
    const result = await window.electronAPI.selectSerialPort();
    if (!result) return null;

    const ports = filter ? result.ports.filter(filter) : result.ports;
    if (ports.length === 0) return null;
    if (ports.length > 1) {
      throw new PortSelectionRequiredError(ports);
    }

    return { portInfo: ports[0] };
  }

  async connect(selection?: DeviceSelection | null): Promise<DeviceHandle> {
    let selectedPort = selection?.portInfo;
    if (!selectedPort) {
      const ports = await this.list();
      if (ports.length !== 1) {
        throw new PortSelectionRequiredError(ports);
      }
      selectedPort = ports[0];
    }

    const portId = await window.electronAPI.serial.open(selectedPort.path, {
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
    });

    const connection: SerialConnection = {
      id: portId,
      isOpen: true,
      write: async (data: Uint8Array | number[]) => {
        const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
        await window.electronAPI.serial.write(portId, payload);
      },
      close: async () => {
        await window.electronAPI.serial.close(portId);
        this.connections.delete(portId);
        this.dataListeners.delete(portId);
        this.errorListeners.delete(portId);
        this.closeListeners.delete(portId);
      },
      setSignals: async (signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) => {
        await window.electronAPI.serial.setSignals(portId, signals);
      },
      onData: (callback: DataListener) => {
        this.dataListeners.set(portId, callback);
      },
      onError: (callback: ErrorListener) => {
        this.errorListeners.set(portId, callback);
      },
      onClose: (callback: CloseListener) => {
        this.closeListeners.set(portId, callback);
      },
      removeDataListener: (_callback: DataListener) => {
        this.dataListeners.delete(portId);
      },
      removeErrorListener: (_callback: ErrorListener) => {
        this.errorListeners.delete(portId);
      },
      removeCloseListener: (_callback: CloseListener) => {
        this.closeListeners.delete(portId);
      },
    };

    this.connections.set(portId, connection);

    return {
      platform: 'electron',
      transport: new ConnectionTransport(connection),
      port: null,
      connection,
      portInfo: selectedPort,
    };
  }

  async init(device: DeviceHandle): Promise<void> {
    await device.transport.setSignals({ dataTerminalReady: true, requestToSend: true });
    await timeout(10);
    await device.transport.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(200);
  }

  async disconnect(device: DeviceHandle): Promise<void> {
    if (device.connection) {
      await device.connection.close();
      device.connection = null;
    }
    device.port = null;
  }

  private setupListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;

    window.electronAPI.serial.onData((portId: string, data: Uint8Array) => {
      const listener = this.dataListeners.get(portId);
      if (listener) listener(data);
    });

    window.electronAPI.serial.onError((portId: string, error: string) => {
      const listener = this.errorListeners.get(portId);
      if (listener) listener(error);
    });

    window.electronAPI.serial.onClose((portId: string) => {
      const listener = this.closeListeners.get(portId);
      if (listener) listener();
      this.connections.delete(portId);
    });
  }
}
