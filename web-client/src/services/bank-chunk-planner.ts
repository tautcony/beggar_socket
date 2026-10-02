import type { MbcType } from '@/types/command-options';

export type BankWindowPolicy =
  | { platform: 'gba'; memory: 'rom' | 'ram' }
  | { platform: 'mbc'; memory: 'rom' | 'ram'; mbcType: MbcType };

/** Addresses and lengths are bytes; GBA ROM uses a word bus; protocol APIs retain byte addresses. */
export function planBankChunk(address: number, remaining: number, pageSize: number, policy: BankWindowPolicy) {
  if (!Number.isSafeInteger(address) || address < 0) {
    throw new RangeError('Logical address must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    throw new RangeError('Remaining length must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('Page size must be a positive safe integer');
  }
  const windowSize = policy.platform === 'gba'
    ? (policy.memory === 'rom' ? 1 << 25 : 1 << 16)
    : (policy.memory === 'rom' ? 1 << 14 : 1 << 13);
  const bank = Math.floor(address / windowSize);
  const offset = address % windowSize;
  const windowRemaining = windowSize - offset;
  let cartAddress: number;
  if (policy.platform === 'gba') {
    cartAddress = policy.memory === 'rom' ? address : offset;
  } else if (policy.memory === 'ram') {
    cartAddress = 0xa000 + offset;
  } else {
    cartAddress = (policy.mbcType === 'MBC3' && bank === 0 ? 0 : 0x4000) + offset;
  }
  return {
    bank, cartAddress, windowRemaining,
    addressUnitBytes: policy.platform === 'gba' && policy.memory === 'rom' ? 2 : 1,
    chunkSize: Math.min(pageSize, remaining, windowRemaining),
  };
}
