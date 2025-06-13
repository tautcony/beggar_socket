
import { AdvancedSettings } from '@/settings/advanced-settings';
import { withTimeout } from '@/utils/async-utils';
import { PerformanceTracker } from '@/utils/sentry';

const INIT_ERROR_MESSAGE = 'Serial port not properly initialized';

export function toLittleEndian(value: number, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);

  for (let i = 0; i < byteLength; i++) {
    bytes[i] = (value >> (i * 8)) & 0xFF;
  }

  return bytes;
}

export function fromLittleEndian(bytes: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value |= (bytes[i] & 0xFF) << (i * 8);
  }
  return value;
}

export async function sendPackage(writer: WritableStreamDefaultWriter<Uint8Array> | null, payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
  if (!writer) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  return PerformanceTracker.trackAsyncOperation(
    'protocol.sendPackage',
    async () => {
      const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

      await withTimeout(
        writer.write(payload),
        timeout,
        `发送数据包超时 (${timeout}ms)`,
      );
      return true;
    },
    {
      operation_type: 'send',
      timeout: String(timeoutMs ?? AdvancedSettings.packageSendTimeout),
    },
    {
      payloadSize: payload.length,
      packageSize: payload.length + 4, // 2 bytes size + 2 bytes CRC
    },
  );
}

export async function getPackage(reader: ReadableStreamDefaultReader<Uint8Array> | null, length: number = 64, timeoutMs?: number): Promise<{ data: Uint8Array }> {
  if (!reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  return PerformanceTracker.trackAsyncOperation(
    'protocol.getPackage',
    async () => {
      const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      const readTimeout = withTimeout(
        (async () => {
          while (totalLength < length) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            if (value) {
              chunks.push(value);
              totalLength += value.length;
            }
          }
        })(),
        timeout,
        `接收数据包超时 (${timeout}ms)`,
      );

      await readTimeout;

      // 合并所有数据块
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return { data: result.slice(0, length) };
    },
    {
      operation_type: 'receive',
      timeout: String(timeoutMs ?? AdvancedSettings.packageReceiveTimeout),
    },
    {
      expectedLength: length,
      actualLength: 0, // Will be updated in transaction data
    },
  );
}

export async function getResult(reader: ReadableStreamDefaultReader<Uint8Array> | null, timeoutMs?: number): Promise<boolean> {
  if (!reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  return PerformanceTracker.trackAsyncOperation(
    'protocol.getResult',
    async () => {
      const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
      const result = await getPackage(reader, 1, timeout);
      return result.data?.length > 0 && result.data[0] === 0xaa;
    },
    {
      operation_type: 'receive_result',
      timeout: String(timeoutMs ?? AdvancedSettings.packageReceiveTimeout),
    },
  );
}

export function getFlashId(id: number[]) : string | null {
  const flashTypes = [
    { pattern: [0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'S29GL256' },
    { pattern: [0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'JS28F256' },
    { pattern: [0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22], name: 'S29GL01GS' },
    { pattern: [0xc2, 0xc2, 0xcb, 0xcb], name: 'MX29LV640EB' },
    { pattern: [0xc2, 0xc2, 0xc9, 0xc9], name: 'MX29LV640ET' },
    { pattern: [0x01, 0x01, 0x7e, 0x7e], name: 'S29GL256N' },
  ];

  for (const flashType of flashTypes) {
    if (arraysEqual(id, flashType.pattern)) {
      return flashType.name;
    }
  }

  return null;
}

export function arraysEqual(a: number[], b: number[]) : boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
