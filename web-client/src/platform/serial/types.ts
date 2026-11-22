import type { FirmwareProfile } from '@/types/firmware-profile';
import type { SerialPortInfo } from '@/types/serial';
import type { PortFilter } from '@/utils/port-filter';

export type TransportReadMode = 'byob' | 'default';

export interface SendAndReceiveOptions {
  /** Flush any stray buffered input inside the same exclusive lock acquisition after reading. */
  flushAfterRead?: boolean;
}

export interface Transport {
  send: (payload: Uint8Array, timeoutMs?: number) => Promise<boolean>;
  read: (length: number, timeoutMs?: number, mode?: TransportReadMode) => Promise<{ data: Uint8Array }>;
  /** Atomic send-then-read guarded by a mutex so concurrent callers are serialised. */
  sendAndReceive: (
    payload: Uint8Array,
    readLength: number,
    sendTimeoutMs?: number,
    readTimeoutMs?: number,
    options?: SendAndReceiveOptions,
  ) => Promise<{ data: Uint8Array }>;
  setSignals: (signals: SerialOutputSignals) => Promise<void>;
  flushInput?: () => Promise<void>;
  flushOutput?: () => Promise<void>;
  readAvailable?: (timeoutMs?: number) => Promise<{ data: Uint8Array }>;
  /**
   * Discard buffered input and keep discarding until the line stays quiet.
   * Unlike flushInput (a point-in-time snapshot clear), this also absorbs bytes
   * still in transit in the OS/USB stack — e.g. a late response from a command
   * the host has already given up on.
   */
  drainInput?: (quietMs?: number, maxWaitMs?: number) => Promise<void>;
  close?: () => Promise<void>;
}

export interface DeviceSelection {
  portInfo?: SerialPortInfo;
  webPort?: SerialPort;
  webSerialFilters?: SerialPortFilter[];
  baudRate?: number;
  skipSignalInit?: boolean;
}

export interface DeviceHandle {
  platform: 'web' | 'tauri' | 'simulated';
  transport: Transport;
  port: SerialPort | null;
  connection?: null;
  portInfo?: SerialPortInfo;
  firmwareProfile?: FirmwareProfile;
  skipSignalInit?: boolean;
}

export interface DeviceGateway {
  list: (filter?: PortFilter) => Promise<SerialPortInfo[]>;
  select: (filter?: PortFilter) => Promise<DeviceSelection | null>;
  connect: (selection?: DeviceSelection | null) => Promise<DeviceHandle>;
  init: (device: DeviceHandle) => Promise<void>;
  disconnect: (device: DeviceHandle) => Promise<void>;
}
