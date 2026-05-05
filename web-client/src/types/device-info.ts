import type { DeviceHandle, Transport } from '@/platform/serial';
import type { FirmwareProfile } from '@/types/firmware-profile';
import type { SerialPortInfo } from '@/types/serial';

export interface DeviceInfo {
  port: SerialPort | null;
  connection?: null;
  transport?: Transport | null;
  serialHandle?: DeviceHandle | null;
  portInfo?: SerialPortInfo;
  firmwareProfile?: FirmwareProfile;
}

// Reader types for utility functions
export type BYOBReader = ReadableStreamBYOBReader;
export type DefaultReader = ReadableStreamDefaultReader<Uint8Array>;
