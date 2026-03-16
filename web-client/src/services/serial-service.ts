/**
 * Legacy serial service facade.
 * Internally routes to platform/serial gateway while keeping existing API shape.
 */
import { type DeviceSelection, getDeviceGateway, toLegacyDeviceInfo } from '@/platform/serial';
import type { DeviceInfo } from '@/types';
import type { SerialConnection, SerialPortInfo } from '@/types/serial';

export class SerialService {
  private static instance: SerialService;
  private readonly gateway = getDeviceGateway();
  private readonly openConnections = new Map<string, SerialConnection>();

  private constructor() {}

  static getInstance(): SerialService {
    if (!SerialService.instance) {
      SerialService.instance = new SerialService();
    }
    return SerialService.instance;
  }

  async listPorts(filter?: (port: SerialPortInfo) => boolean): Promise<SerialPortInfo[]> {
    return this.gateway.list(filter);
  }

  async getPortSelectionInfo(filter?: (port: SerialPortInfo) => boolean): Promise<{ ports: SerialPortInfo[]; needsSelection: boolean } | null> {
    const ports = await this.listPorts(filter);
    return {
      ports,
      needsSelection: ports.length > 1,
    };
  }

  async openPort(portPath: string, _options: SerialOptions): Promise<DeviceInfo> {
    const selection: DeviceSelection = { portInfo: { path: portPath } };
    const handle = await this.gateway.connect(selection);

    let device: DeviceInfo;
    try {
      device = toLegacyDeviceInfo(handle);
    } catch (e) {
      // Prevent handle leak when conversion fails
      if (handle.transport?.close) {
        await handle.transport.close().catch(() => {});
      }
      throw e;
    }

    if (device.connection) {
      this.openConnections.set(device.connection.id, device.connection);
    }

    return device;
  }

  onData(_portId: string, _callback: (data: Uint8Array) => void) {}

  onError(_portId: string, _callback: (error: string) => void) {}

  onClose(_portId: string, _callback: () => void) {}

  removeListeners(_portId: string) {}

  getConnection(portId: string): SerialConnection | undefined {
    return this.openConnections.get(portId);
  }

  async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.openConnections.values()).map(conn => conn.close());
    await Promise.all(promises);
    this.openConnections.clear();
  }
}

export const serialService = SerialService.getInstance();
export type { SerialConnection, SerialPortInfo } from '@/types/serial';
