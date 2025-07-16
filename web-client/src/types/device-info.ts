export interface DeviceInfo<TReaderMode extends 'byob' | undefined = 'byob' | undefined> {
  port: SerialPort | null;
  reader: TReaderMode extends 'byob'
    ? ReadableStreamBYOBReader | null
    : TReaderMode extends undefined
      ? ReadableStreamDefaultReader<Uint8Array> | null
      : ReadableStreamBYOBReader | ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
}
