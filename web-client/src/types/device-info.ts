export interface DeviceInfo {
  port: SerialPort | null;
}

// Reader types for utility functions
export type BYOBReader = ReadableStreamBYOBReader;
export type DefaultReader = ReadableStreamDefaultReader<Uint8Array>;
