import { describe, expect, it } from 'vitest';

import { assertBinaryEqual } from './binary-assertion';

describe('exact binary assertion', () => {
  it('compares view contents without comparing bytes outside the view', () => {
    const actual = new Uint8Array([9, 1, 2, 8]).subarray(1, 3);
    expect(() => { assertBinaryEqual(actual, new Uint8Array([1, 2])); }).not.toThrow();
  });

  it('rejects different lengths', () => {
    expect(() => { assertBinaryEqual(new Uint8Array(2), new Uint8Array(3)); }).toThrow('length mismatch');
  });

  it.each([0, 4, 7])('rejects a single differing byte at %i', (offset) => {
    const actual = new Uint8Array(8);
    actual[offset] = 1;
    expect(() => { assertBinaryEqual(actual, new Uint8Array(8)); }).toThrow(`byte ${offset}`);
  });
});
