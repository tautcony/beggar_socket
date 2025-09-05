// utils.ts - 工具函数

import { cartridgeTypes } from './types';

export function formatFileSize(size: number): string {
  if (size === 1) return `${size} Byte`;
  if (size < 1024) return `${size} Bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function updateSectorMap(sector_map: string[], start: number, length: number, c: string): void {
  sector_map.fill(c, start + 1, start + length);
  sector_map[start] = c.toUpperCase();
}

// 浏览器兼容的路径解析
export function parsePath(filePath: string): { name: string; ext: string } {
  const lastDot = filePath.lastIndexOf('.');
  const name = lastDot > 0 ? filePath.slice(0, lastDot) : filePath;
  const ext = lastDot > 0 ? filePath.slice(lastDot) : '';
  return { name, ext };
}

// 浏览器兼容的SHA1哈希
export async function sha1(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 浏览器兼容的Buffer操作
export function arrayBufferToUint8Array(ab: ArrayBuffer): Uint8Array {
  return new Uint8Array(ab);
}

export function uint8ArrayToArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

// 比较两个字节数组是否相等
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
