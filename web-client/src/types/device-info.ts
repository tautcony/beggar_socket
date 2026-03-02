import type { DeviceHandle, Transport } from '@/platform/serial';
import type { SerialConnection, SerialPortInfo } from '@/types/serial';

export interface DeviceInfo {
  port: SerialPort | null;
  connection?: SerialConnection | null; // 新增：统一的串口连接对象
  transport?: Transport | null;
  serialHandle?: DeviceHandle | null;
  portInfo?: SerialPortInfo;
}

// Reader types for utility functions
export type BYOBReader = ReadableStreamBYOBReader;
export type DefaultReader = ReadableStreamDefaultReader<Uint8Array>;
