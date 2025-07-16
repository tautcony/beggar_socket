
import { AdvancedSettings } from '@/settings/advanced-settings';
import { sleep, withTimeout } from '@/utils/async-utils';

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
  const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

  await withTimeout(
    writer.write(payload),
    timeout,
    `Send package tiemout in ${timeout}ms`,
  );
  return true;
}

export async function getPackage(reader: ReadableStreamBYOBReader | null, length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
  if (!reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
  let buffer = new Uint8Array(length);

  let offset = 0;
  const accumulatedData = new Uint8Array(length);

  const TIMEOUT = Symbol('timeout');
  const readTimeout = sleep(timeout).then(() => TIMEOUT);

  const readOperation = (async () => {
    while (offset < length) {
      const { value, done } = await reader.read(
        new Uint8Array(buffer, offset),
      );
      if (done) {
        break;
      }
      // 将新读取的数据复制到累积缓冲区中
      accumulatedData.set(value, offset);
      buffer = value.buffer;
      offset += value.byteLength;
    }
  })();

  const resolved = await Promise.race([readTimeout, readOperation]);
  if (resolved === TIMEOUT) {
    if (offset === 0) {
      throw new Error(`Read package timeout in ${timeout}ms`);
    }
    // 超时但有部分数据，返回累积的数据
    return { data: accumulatedData.slice(0, offset) };
  }

  return { data: new Uint8Array(buffer) };
}

export async function getResult(reader: ReadableStreamBYOBReader | null, timeoutMs?: number): Promise<boolean> {
  if (!reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
  const result = await getPackage(reader, 1, timeout);
  return result.data?.byteLength > 0 && result.data[0] === 0xaa;
}

export function getFlashId(id: number[]) : string | null {
  const flashTypes = [
    { pattern: [0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'S29GL256' },
    { pattern: [0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'JS28F256' },
    { pattern: [0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22], name: 'S29GL01' },
    { pattern: [0x01, 0x00, 0x7e, 0x22, 0x48, 0x22, 0x01, 0x22], name: 'S70GL02' },
    { pattern: [0xc2, 0xc2, 0xcb, 0xcb], name: 'MX29LV640EB' },
    { pattern: [0xc2, 0xc2, 0xc9, 0xc9], name: 'MX29LV640ET' },
    { pattern: [0xc2, 0xc2, 0x7e, 0x7e], name: 'MX29LV640EB' },
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
