import { describe, expect, it } from 'vitest';

import {
  CHIP_OPERATION_EVENTS,
  RAM_OPERATION_EVENTS,
  ROM_OPERATION_EVENTS,
} from '@/components/operaiton/contracts';

describe('Operation panel contracts', () => {
  it('chip panel events remain stable', () => {
    expect(CHIP_OPERATION_EVENTS).toEqual([
      'read-id',
      'erase-chip',
      'read-rom-info',
      'mbc-type-change',
      'mbc-power-change',
    ]);
  });

  it('rom panel events remain stable', () => {
    expect(ROM_OPERATION_EVENTS).toEqual([
      'file-selected',
      'file-cleared',
      'mode-switch-required',
      'rom-size-change',
      'base-address-change',
      'write-rom',
      'read-rom',
      'verify-rom',
      'verify-blank',
    ]);
  });

  it('ram panel events remain stable', () => {
    expect(RAM_OPERATION_EVENTS).toEqual([
      'file-selected',
      'file-cleared',
      'write-ram',
      'read-ram',
      'verify-ram',
      'verify-blank',
      'ram-size-change',
      'ram-type-change',
      'base-address-change',
    ]);
  });
});
