import type { DeviceDiagnostic, SessionProfile } from '@/device/session';
import type { DeviceHandle, Transport } from '@/platform/serial';
import type { GbflashFirmwareInfo } from '@/protocol/gbflash';
import type { FirmwareProfile } from '@/types/firmware-profile';
import type { SerialPortInfo } from '@/types/serial';

export interface DeviceInfo {
  port: SerialPort | null;
  connection?: null;
  transport?: Transport | null;
  serialHandle?: DeviceHandle | null;
  portInfo?: SerialPortInfo;
  firmwareProfile?: FirmwareProfile;
  gbflashInfo?: GbflashFirmwareInfo;
  connectionGeneration?: number;
  connectionId?: string;
  /** Committed session profile: the device/firmware/transport authority of this connection. */
  session?: SessionProfile;
  /** Diagnostics of the committed session (port match, probe skips, teardown warnings). */
  diagnostics?: readonly DeviceDiagnostic[];
}

// Reader types for utility functions
export type BYOBReader = ReadableStreamBYOBReader;
export type DefaultReader = ReadableStreamDefaultReader<Uint8Array>;
