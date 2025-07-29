import { AdvancedSettings } from '@/settings/advanced-settings';
import { type BYOBReader, type DefaultReader, type DeviceInfo } from '@/types';

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

export async function sendPackage(device: DeviceInfo, payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
  const writer = device.port?.writable?.getWriter();
  if (!writer) throw new Error(INIT_ERROR_MESSAGE);
  const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const writePromise = writer.write(payload);
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        writer.releaseLock();
        reject(new Error(`Send package timeout in ${timeout}ms`));
      }, timeout);
    });
    await Promise.race([writePromise, timeoutPromise]);
    return true;
  } finally {
    if (timer) clearTimeout(timer);
    try { writer.releaseLock(); } catch {}
  }
}

export async function getPackageWithDefaultReader(reader: DefaultReader, length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
  const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
  let offset = 0;
  const accumulatedData = new Uint8Array(length);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const readOperation = (async () => {
      while (offset < length) {
        const { value, done } = await reader.read();
        if (done || !value) {
          break;
        }
        // 将新读取的数据复制到累积缓冲区中
        const bytesToCopy = Math.min(value.byteLength, length - offset);
        accumulatedData.set(value.subarray(0, bytesToCopy), offset);
        offset += bytesToCopy;
      }
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reader.releaseLock();
        reject(new Error(`Read package timeout in ${timeout}ms`));
      }, timeout);
    });

    await Promise.race([readOperation, timeoutPromise]);
    return { data: accumulatedData.slice(0, offset) };
  } catch (e) {
    if (offset === 0) {
      throw e;
    }
    // 超时但有部分数据，返回累积的数据
    return { data: accumulatedData.slice(0, offset) };
  } finally {
    if (timer) clearTimeout(timer);
    try { reader.releaseLock(); } catch {}
  }
}

export async function getPackageWithBYOBReader(reader: BYOBReader, length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
  const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
  let buffer = new Uint8Array(length);
  let offset = 0;
  const accumulatedData = new Uint8Array(length);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
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

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reader.releaseLock();
        reject(new Error(`Read package timeout in ${timeout}ms`));
      }, timeout);
    });

    await Promise.race([readOperation, timeoutPromise]);
    return { data: new Uint8Array(buffer) };
  } catch (e) {
    if (offset === 0) {
      throw e;
    }
    // 超时但有部分数据，返回累积的数据
    return { data: accumulatedData.slice(0, offset) };
  } finally {
    if (timer) clearTimeout(timer);
    try { reader.releaseLock(); } catch {}
  }
}

export async function getPackage(device: DeviceInfo, length: number, timeoutMs?: number, mode: 'byob' | 'default' = 'byob'): Promise<{ data: Uint8Array }> {
  if (!device.port?.readable) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  if (mode === 'byob') {
    const reader = device.port.readable.getReader({ mode: 'byob' });
    return getPackageWithBYOBReader(reader, length, timeoutMs);
  } else {
    const reader = device.port.readable.getReader();
    return getPackageWithDefaultReader(reader, length, timeoutMs);
  }
}

export async function getResult(device: DeviceInfo, timeoutMs?: number): Promise<boolean> {
  const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
  const result = await getPackage(device, 1, timeout);
  return result.data?.byteLength > 0 && result.data[0] === 0xaa;
}

// Flash类型定义
export interface FlashType {
  readonly id: readonly number[];
  readonly name: string;
}

export const SUPPORTED_FLASH_TYPES: readonly FlashType[] = [
  { id: [0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'S29GL256' },
  { id: [0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: 'JS28F256' },
  { id: [0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22], name: 'S29GL01' },
  { id: [0x01, 0x00, 0x7e, 0x22, 0x48, 0x22, 0x01, 0x22], name: 'S70GL02' },
  { id: [0xc2, 0xc2, 0xcb, 0xcb], name: 'MX29LV640EB' },
  { id: [0xc2, 0xc2, 0xc9, 0xc9], name: 'MX29LV640ET' },
  { id: [0xc2, 0xc2, 0x7e, 0x7e], name: 'MX29LV640EB_ALT' },
  { id: [0x01, 0x01, 0x7e, 0x7e], name: 'S29GL256N' },
] as const;

const flashIdToNameMap = new Map<string, string>();
const flashNameToIdMap = new Map<string, readonly number[]>();
for (const flashType of SUPPORTED_FLASH_TYPES) {
  const idKey = flashType.id.join(',');
  flashIdToNameMap.set(idKey, flashType.name);
  flashNameToIdMap.set(flashType.name, flashType.id);
}

export function getFlashName(id: readonly number[]): string | undefined {
  if (!id || id.length === 0) return undefined;
  const idKey = id.join(',');
  return flashIdToNameMap.get(idKey) ?? undefined;
}

export function getFlashId(name: string): readonly number[] | undefined {
  if (!name) return undefined;
  return flashNameToIdMap.get(name) ?? undefined;
}

export function arraysEqual(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
}
