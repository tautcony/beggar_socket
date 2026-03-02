import type { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';
import { isElectron } from '@/utils/electron';

import { ConnectionTransport, WebSerialTransport } from './transports';
import type { DeviceHandle, Transport } from './types';

export function toLegacyDeviceInfo(device: DeviceHandle): DeviceInfo {
  return {
    port: device.port,
    connection: device.connection ?? null,
    transport: device.transport,
    serialHandle: device,
  };
}

export function fromLegacyDeviceInfo(device: DeviceInfo): DeviceHandle {
  const existing = device.serialHandle;
  if (existing) return existing;

  const transport = resolveTransport(device);
  return {
    platform: isElectron() ? 'electron' : 'web',
    transport,
    port: device.port,
    connection: device.connection ?? null,
    portInfo: undefined,
  };
}

export function withPortInfo(device: DeviceInfo, portInfo?: SerialPortInfo): DeviceInfo {
  if (device.serialHandle) {
    device.serialHandle.portInfo = portInfo;
  }
  device.portInfo = portInfo;
  return device;
}

export function resolveTransport(device: DeviceInfo | { transport: Transport }): Transport {
  if ('transport' in device && device.transport) {
    return device.transport;
  }

  if ('connection' in device && device.connection) {
    return new ConnectionTransport(device.connection);
  }

  if ('port' in device && device.port) {
    return new WebSerialTransport(device.port);
  }

  throw new Error('Serial port not properly initialized');
}
