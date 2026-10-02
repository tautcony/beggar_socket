import { Buffer } from 'node:buffer';

export function assertBinaryEqual(actual: Uint8Array, expected: Uint8Array): void {
  if (actual.byteLength !== expected.byteLength) {
    throw new Error(`Binary length mismatch: ${actual.byteLength} !== ${expected.byteLength}`);
  }
  const actualBuffer = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
  const expectedBuffer = Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength);
  if (actualBuffer.equals(expectedBuffer)) return;

  const offset = actual.findIndex((byte, index) => byte !== expected[index]);
  throw new Error(`Binary mismatch at byte ${offset}: ${actual[offset]} !== ${expected[offset]}`);
}
