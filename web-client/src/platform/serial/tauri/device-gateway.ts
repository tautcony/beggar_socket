import { listNativeSerialPorts, openNativeSerialPort } from '@/platform/native';
import type { SerialPortInfo } from '@/types/serial';
import { withTimeout } from '@/utils/async-utils';
import { PortSelectionRequiredError } from '@/utils/errors/PortSelectionRequiredError';
import type { PortFilter } from '@/utils/port-filter';

import { initDeviceSignals } from '../device-signals';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '../types';
import { TauriSerialTransport } from './tauri-serial-transport';

function toDeviceAliasPath(path: string): string {
  return path.replace(/^\/dev\/(?:cu|tty)\./, '/dev/');
}

function getPortIdentityKey(port: SerialPortInfo): string {
  return [
    port.vendorId ?? '',
    port.productId ?? '',
    port.serialNumber ?? '',
    port.product ?? '',
    port.manufacturer ?? '',
    toDeviceAliasPath(port.path),
  ].join('|');
}

function isPreferredPortPath(path: string): boolean {
  return path.startsWith('/dev/cu.');
}

function choosePreferredPort(current: SerialPortInfo, candidate: SerialPortInfo): SerialPortInfo {
  if (isPreferredPortPath(candidate.path) && !isPreferredPortPath(current.path)) {
    return candidate;
  }
  if (isPreferredPortPath(current.path) && !isPreferredPortPath(candidate.path)) {
    return current;
  }
  return candidate.path.localeCompare(current.path) < 0 ? candidate : current;
}

function dedupeAndSortPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
  const deduped = new Map<string, SerialPortInfo>();

  for (const port of ports) {
    const key = getPortIdentityKey(port);
    const existing = deduped.get(key);
    deduped.set(key, existing ? choosePreferredPort(existing, port) : port);
  }

  return [...deduped.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function describePort(port: SerialPortInfo): string {
  const details = [
    port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : null,
    port.manufacturer ?? null,
    port.product ?? null,
  ].filter(Boolean);

  return details.length > 0
    ? `${port.path} (${details.join(', ')})`
    : port.path;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class TauriDeviceGateway implements DeviceGateway {
  private static readonly OPEN_TIMEOUT_MS = 5000;

  async list(filter?: PortFilter): Promise<SerialPortInfo[]> {
    const mapped = dedupeAndSortPorts(await listNativeSerialPorts());
    const filtered = filter ? mapped.filter(filter) : mapped;
    console.info('[TauriDeviceGateway] list', {
      total: mapped.length,
      filtered: filtered.length,
      filterConfig: filter?.config,
      ports: filtered.map(describePort),
    });
    return filtered;
  }

  async select(filter?: PortFilter): Promise<DeviceSelection | null> {
    const ports = await this.list(filter);
    if (ports.length === 0) {
      return null;
    }
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

    let sessionId: number;
    try {
      console.info('[TauriDeviceGateway] open', describePort(selectedPort));
      const session = await withTimeout(
        openNativeSerialPort(selectedPort.path),
        TauriDeviceGateway.OPEN_TIMEOUT_MS,
        `Tauri serial connect timeout after ${TauriDeviceGateway.OPEN_TIMEOUT_MS}ms for ${selectedPort.path}`,
      );
      sessionId = session.sessionId;
    } catch (error) {
      throw new Error(`Tauri serial connect failed for ${selectedPort.path}: ${errorMessage(error)}`);
    }

    const transport = new TauriSerialTransport(sessionId);
    try {
      await transport.attachListener();
    } catch (error) {
      await transport.close().catch(() => {});
      throw new Error(`Tauri serial listener attach failed for ${selectedPort.path}: ${errorMessage(error)}`);
    }

    return {
      platform: 'tauri',
      transport,
      port: null,
      connection: null,
      portInfo: selectedPort,
    };
  }

  async init(device: DeviceHandle): Promise<void> {
    const portLabel = describePort(device.portInfo ?? { path: 'unknown-port' });

    try {
      console.info('[TauriDeviceGateway] init signals start', portLabel);
      await initDeviceSignals(device.transport);
      console.info('[TauriDeviceGateway] init complete', portLabel);
    } catch (error) {
      try {
        console.info('[TauriDeviceGateway] init rollback -> low', portLabel);
        await device.transport.setSignals({ dataTerminalReady: false, requestToSend: false });
      } catch (rollbackError) {
        console.debug('[TauriDeviceGateway] init rollback failed', {
          port: portLabel,
          rollbackError,
        });
      }
      console.error('[TauriDeviceGateway] init failed', {
        port: portLabel,
        error,
      });
      throw new Error(`Tauri serial init failed for ${device.portInfo?.path ?? 'unknown-port'}: ${errorMessage(error)}`);
    }
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
