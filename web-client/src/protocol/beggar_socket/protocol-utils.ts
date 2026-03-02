import { resolveTransport, type Transport } from '@/platform/serial';
import { type DeviceInfo } from '@/types';

import { ProtocolAdapter } from './protocol-adapter';

export type ProtocolTransportInput = DeviceInfo | { transport: Transport };

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

// 使用适配器的统一接口
export async function sendPackage(input: ProtocolTransportInput, payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
  return ProtocolAdapter.sendPackage(resolveTransport(input), payload, timeoutMs);
}

export async function getPackage(
  input: ProtocolTransportInput,
  length: number,
  timeoutMs?: number,
  mode: 'byob' | 'default' = 'byob',
): Promise<{ data: Uint8Array }> {
  return ProtocolAdapter.getPackage(resolveTransport(input), length, timeoutMs, mode);
}

export async function getResult(input: ProtocolTransportInput, timeoutMs?: number): Promise<boolean> {
  return ProtocolAdapter.getResult(resolveTransport(input), timeoutMs);
}

export async function setSignals(input: ProtocolTransportInput, signals: SerialOutputSignals): Promise<void> {
  return ProtocolAdapter.setSignals(resolveTransport(input), signals);
}

// Flash 类型定义和工具函数
type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer U)[] ? U : never;

export interface FlashType<
  TName extends string = string,
  TId extends readonly number[] = readonly number[],
> {
  readonly id: TId;
  readonly name: TName;
}

export const SUPPORTED_FLASH_TYPES = [
  { id: [0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22] as const, name: 'S29GL256' as const },
  { id: [0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22] as const, name: 'JS28F256' as const },
  { id: [0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22] as const, name: 'S29GL01' as const },
  { id: [0x01, 0x00, 0x7e, 0x22, 0x48, 0x22, 0x01, 0x22] as const, name: 'S70GL02' as const },
  { id: [0xc2, 0xc2, 0xcb, 0xcb] as const, name: 'MX29LV640EB' as const },
  { id: [0xc2, 0xc2, 0xc9, 0xc9] as const, name: 'MX29LV640ET' as const },
  { id: [0xc2, 0xc2, 0x7e, 0x7e] as const, name: 'MX29LV640EB_ALT' as const },
  { id: [0x01, 0x01, 0x7e, 0x7e] as const, name: 'S29GL256N' as const },
] as const;

type SupportedFlashConfig = typeof SUPPORTED_FLASH_TYPES;
type FlashEntry = ArrayElement<SupportedFlashConfig>;

type SupportedFlashNames = FlashEntry['name'];
type SupportedFlashIds = FlashEntry['id'];

const flashIdToNameMap = new Map<string, SupportedFlashNames>();
const flashNameToIdMap = new Map<SupportedFlashNames, SupportedFlashIds>();

for (const flashType of SUPPORTED_FLASH_TYPES) {
  const idKey = flashType.id.join(',');
  flashIdToNameMap.set(idKey, flashType.name);
  flashNameToIdMap.set(flashType.name, flashType.id);
}

export function getFlashName(id: readonly number[]): SupportedFlashNames | undefined {
  if (!id || id.length === 0) return undefined;
  const idKey = id.join(',');
  return flashIdToNameMap.get(idKey);
}

export function getFlashId(name: SupportedFlashNames): SupportedFlashIds | undefined {
  if (!name) return undefined;
  return flashNameToIdMap.get(name);
}

export function arraysEqual(
  a: readonly unknown[] | undefined | null,
  b: readonly unknown[] | undefined | null,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
