import type { SerialConnection, SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

export type TransportReadMode = 'byob' | 'default';

export interface Transport {
  send: (payload: Uint8Array, timeoutMs?: number) => Promise<boolean>;
  read: (length: number, timeoutMs?: number, mode?: TransportReadMode) => Promise<{ data: Uint8Array }>;
  setSignals: (signals: SerialOutputSignals) => Promise<void>;
  close?: () => Promise<void>;
}

export interface DeviceSelection {
  portInfo?: SerialPortInfo;
  webPort?: SerialPort;
  webSerialFilters?: SerialPortFilter[];
}

export interface DeviceHandle {
  platform: 'web' | 'electron';
  transport: Transport;
  port: SerialPort | null;
  connection?: SerialConnection | null;
  portInfo?: SerialPortInfo;
}

export interface DeviceGateway {
  list: (filter?: PortFilter) => Promise<SerialPortInfo[]>;
  select: (filter?: PortFilter) => Promise<DeviceSelection | null>;
  connect: (selection?: DeviceSelection | null) => Promise<DeviceHandle>;
  init: (device: DeviceHandle) => Promise<void>;
  disconnect: (device: DeviceHandle) => Promise<void>;
}
