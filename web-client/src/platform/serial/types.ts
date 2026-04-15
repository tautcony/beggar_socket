import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

export type TransportReadMode = 'byob' | 'default';

export interface Transport {
  send: (payload: Uint8Array, timeoutMs?: number) => Promise<boolean>;
  read: (length: number, timeoutMs?: number, mode?: TransportReadMode) => Promise<{ data: Uint8Array }>;
  /** Atomic send-then-read guarded by a mutex so concurrent callers are serialised. */
  sendAndReceive: (payload: Uint8Array, readLength: number, sendTimeoutMs?: number, readTimeoutMs?: number) => Promise<{ data: Uint8Array }>;
  setSignals: (signals: SerialOutputSignals) => Promise<void>;
  flushInput?: () => Promise<void>;
  close?: () => Promise<void>;
}

export interface DeviceSelection {
  portInfo?: SerialPortInfo;
  webPort?: SerialPort;
  webSerialFilters?: SerialPortFilter[];
}

export interface DeviceHandle {
  platform: 'web' | 'tauri';
  transport: Transport;
  port: SerialPort | null;
  connection?: null;
  portInfo?: SerialPortInfo;
}

export interface DeviceGateway {
  list: (filter?: PortFilter) => Promise<SerialPortInfo[]>;
  select: (filter?: PortFilter) => Promise<DeviceSelection | null>;
  connect: (selection?: DeviceSelection | null) => Promise<DeviceHandle>;
  init: (device: DeviceHandle) => Promise<void>;
  disconnect: (device: DeviceHandle) => Promise<void>;
}
