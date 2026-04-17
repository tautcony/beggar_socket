import { timeout } from '@/utils/async-utils';

import {
  FLASH_CMD_AUTOSELECT,
  FLASH_CMD_ERASE_SETUP,
  FLASH_CMD_RESET,
  FLASH_CMD_SECTOR_ERASE,
  FLASH_CMD_UNLOCK_1,
  FLASH_CMD_UNLOCK_2,
} from './constants';
import type { ProtocolTransportInput } from './protocol-utils';

export interface FlashCommandSet {
  readonly unlockAddr1: number;
  readonly unlockAddr2: number;
  encodeByte(value: number): Uint8Array;
  write(input: ProtocolTransportInput, data: Uint8Array, address: number): Promise<void>;
  read(input: ProtocolTransportInput, size: number, address: number): Promise<Uint8Array>;
}

/**
 * 3-write unlock sequence: UNLOCK_1 → addr1, UNLOCK_2 → addr2, command → addr1
 */
export async function flashUnlockSequence(
  input: ProtocolTransportInput,
  cmdSet: FlashCommandSet,
  command: number,
): Promise<void> {
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_1), cmdSet.unlockAddr1);
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_2), cmdSet.unlockAddr2);
  await cmdSet.write(input, cmdSet.encodeByte(command), cmdSet.unlockAddr1);
}

/**
 * 6-write erase command sequence:
 * UNLOCK_1→addr1, UNLOCK_2→addr2, ERASE_SETUP→addr1,
 * UNLOCK_1→addr1, UNLOCK_2→addr2, targetCommand→targetAddress
 */
export async function flashEraseCommand(
  input: ProtocolTransportInput,
  cmdSet: FlashCommandSet,
  targetAddress: number,
  targetCommand: number,
): Promise<void> {
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_1), cmdSet.unlockAddr1);
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_2), cmdSet.unlockAddr2);
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_ERASE_SETUP), cmdSet.unlockAddr1);
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_1), cmdSet.unlockAddr1);
  await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_UNLOCK_2), cmdSet.unlockAddr2);
  await cmdSet.write(input, cmdSet.encodeByte(targetCommand), targetAddress);
}

/**
 * Poll a flash address until all read bytes are 0xFF or timeout.
 */
export async function flashPollUntilReady(
  input: ProtocolTransportInput,
  cmdSet: FlashCommandSet,
  pollAddress: number,
  opts: { pollBytes: number; pollIntervalMs: number; timeoutMs: number },
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  do {
    if (Date.now() > deadline) {
      throw new Error(`erase timeout after ${opts.timeoutMs}ms`);
    }
    await timeout(opts.pollIntervalMs);
    const status = await cmdSet.read(input, opts.pollBytes, pollAddress);
    if (status.every(b => b === 0xff)) return;
  } while (true);
}

/**
 * Read flash ID: unlock → autoselect → read → reset.
 */
export async function flashGetId(
  input: ProtocolTransportInput,
  cmdSet: FlashCommandSet,
  reads: readonly { address: number; size: number }[],
): Promise<Uint8Array> {
  await flashUnlockSequence(input, cmdSet, FLASH_CMD_AUTOSELECT);
  try {
    const totalSize = reads.reduce((sum, r) => sum + r.size, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const { address, size } of reads) {
      const data = await cmdSet.read(input, size, address);
      result.set(data, offset);
      offset += size;
    }
    return result;
  } finally {
    await cmdSet.write(input, cmdSet.encodeByte(FLASH_CMD_RESET), 0x00).catch(() => {});
  }
}

/**
 * Erase a flash sector: 6-write erase sequence + poll until ready.
 */
export async function flashEraseSector(
  input: ProtocolTransportInput,
  cmdSet: FlashCommandSet,
  eraseAddress: number,
  pollAddress: number,
  opts: { pollBytes: number; pollIntervalMs: number; timeoutMs: number },
): Promise<boolean> {
  await flashEraseCommand(input, cmdSet, eraseAddress, FLASH_CMD_SECTOR_ERASE);
  await flashPollUntilReady(input, cmdSet, pollAddress, opts);
  return true;
}
