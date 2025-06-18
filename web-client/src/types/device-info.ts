export interface DeviceInfo {
  port: SerialPort;
  reader: ReadableStreamBYOBReader | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
}
