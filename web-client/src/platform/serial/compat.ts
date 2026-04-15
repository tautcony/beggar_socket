import type { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';
import { isTauri } from '@/utils/tauri';

import { WebSerialTransport } from './transports';
import type { DeviceHandle, Transport } from './types';

export function toLegacyDeviceInfo(device: DeviceHandle): DeviceInfo {
  return {
    port: device.port,
    connection: null,
    transport: device.transport,
    serialHandle: device,
    portInfo: device.portInfo,
  };
}

export function fromLegacyDeviceInfo(device: DeviceInfo): DeviceHandle {
  const existing = device.serialHandle;
  if (existing) return existing;

  const transport = resolveTransport(device);
  return {
    platform: isTauri() ? 'tauri' : 'web',
    transport,
    port: device.port,
    connection: null,
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

  if ('port' in device && device.port) {
    return new WebSerialTransport(device.port);
  }

  throw new Error('Serial port not properly initialized');
}
