import { formatHex } from '@/utils/formatter-utils';

import { GBACommand, GBCCommand } from './command';
import {
  FLASH_CMD_CHIP_ERASE,
  GBA_FLASH_ADDR_1,
  GBA_FLASH_ADDR_2,
  GBA_RAM_FLASH_ADDR_1,
  GBA_RAM_FLASH_ADDR_2,
  GBC_FLASH_ADDR_1,
  GBC_FLASH_ADDR_2,
} from './constants';
import {
  type FlashCommandSet,
  flashEraseCommand,
  flashEraseSector,
  flashGetId,
  flashPollUntilReady,
} from './flash-command-set';
import { sendAndReadProtocolPayload } from './packet-read';
import { createCommandPayload } from './payload-builder';
import { type ProtocolTransportInput, sendAndExpectAck, sendPackage, toLittleEndian } from './protocol-utils';

const GBA_SECTOR_ERASE_POLL_INTERVAL_MS = 20;
const GBA_SECTOR_ERASE_TIMEOUT_MS = 60_000;

const GBC_SECTOR_ERASE_POLL_INTERVAL_MS = 20;
const GBC_SECTOR_ERASE_TIMEOUT_MS = 15_000;
const GBC_CHIP_ERASE_POLL_INTERVAL_MS = 50;
const GBC_CHIP_ERASE_TIMEOUT_MS = 120_000;

// --- Flash Command Sets ---

export const GBA_ROM_FLASH_CMD_SET: FlashCommandSet = {
  unlockAddr1: GBA_FLASH_ADDR_1,
  unlockAddr2: GBA_FLASH_ADDR_2,
  encodeByte: (value: number) => toLittleEndian(value, 2),
  write: rom_write,
  read: rom_read,
};

export const GBC_FLASH_CMD_SET: FlashCommandSet = {
  unlockAddr1: GBC_FLASH_ADDR_1,
  unlockAddr2: GBC_FLASH_ADDR_2,
  encodeByte: (value: number) => new Uint8Array([value]),
  write: gbc_write,
  read: gbc_read,
};

export const GBA_RAM_FLASH_CMD_SET: FlashCommandSet = {
  unlockAddr1: GBA_RAM_FLASH_ADDR_1,
  unlockAddr2: GBA_RAM_FLASH_ADDR_2,
  encodeByte: (value: number) => new Uint8Array([value]),
  write: ram_write,
  read: ram_read,
};

// --- Internal Helpers ---

async function flashProgramRom(
  input: ProtocolTransportInput,
  command: GBACommand | GBCCommand,
  data: Uint8Array,
  baseAddress: number,
  bufferSize: number,
  errorLabel: string,
): Promise<void> {
  if (data.length > bufferSize) {
    throw new RangeError(`Data length ${data.length} exceeds buffer size ${bufferSize}`);
  }
  const payload = createCommandPayload(command)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();
  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`${errorLabel} failed (Address: ${formatHex(baseAddress, 4)})`);
}

// --- GBA Commands ---

/**
 * GBA: Read ID (0xf0)
 */
export async function rom_get_id(input: ProtocolTransportInput): Promise<Uint8Array> {
  return flashGetId(input, GBA_ROM_FLASH_CMD_SET, [
    { address: 0x00, size: 4 },
    { address: 0x1c, size: 4 },
  ]);
}

/**
 * GBA: Erase chip (0xf1)
 */
export async function rom_erase_chip(input: ProtocolTransportInput): Promise<void> {
  const ack = await sendAndExpectAck(input, createCommandPayload(GBACommand.ERASE_CHIP).build());
  if (!ack) throw new Error('GBA Erase failed');
}

/**
 * GBA: ROM Sector Erase (0xf3)
 */
export async function rom_erase_sector(input: ProtocolTransportInput, sectorAddress: number): Promise<boolean> {
  const alignedSectorAddress = sectorAddress & ~1;
  const sectorWordAddress = alignedSectorAddress >>> 1;
  const errorPrefix = `GBA ROM sector erase failed (Address: ${formatHex(sectorAddress, 4)})`;
  try {
    return await flashEraseSector(input, GBA_ROM_FLASH_CMD_SET, sectorWordAddress, alignedSectorAddress, {
      pollBytes: 2,
      pollIntervalMs: GBA_SECTOR_ERASE_POLL_INTERVAL_MS,
      timeoutMs: GBA_SECTOR_ERASE_TIMEOUT_MS,
    });
  } catch (error) {
    throw new Error(`${errorPrefix}, Reason: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function rom_erase_sector_direct(input: ProtocolTransportInput, sectorAddress: number): Promise<boolean> {
  const payload = createCommandPayload(GBACommand.SECTOR_ERASE).addAddress(sectorAddress).build();
  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

/**
 * GBA: ROM Program (0xf4)
 */
export async function rom_program(input: ProtocolTransportInput, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {
  return flashProgramRom(input, GBACommand.PROGRAM, data, baseAddress, bufferSize, 'GBA ROM programming');
}

/**
 * GBA: ROM Direct Write (0xf5)
 */
export async function rom_write(input: ProtocolTransportInput, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBACommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBA ROM direct write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: ROM Read (0xf6)
 */
export async function rom_read(input: ProtocolTransportInput, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBACommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();
  return sendAndReadProtocolPayload(input, payload, 'GBA ROM read', size, baseAddress);
}

/**
 * GBA: RAM Write (0xf7)
 */
export async function ram_write(input: ProtocolTransportInput, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBACommand.RAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`RAM write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: RAM Read (0xf8)
 */
export async function ram_read(input: ProtocolTransportInput, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBACommand.RAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  return sendAndReadProtocolPayload(input, payload, 'GBA RAM read', size, baseAddress);
}

/**
 * GBA: RAM Write to FLASH (0xf9)
 */
export async function ram_program_flash(input: ProtocolTransportInput, data: Uint8Array, baseAddress = 0): Promise<void> {
  const payload = createCommandPayload(GBACommand.RAM_WRITE_TO_FLASH)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 */
export async function ram_erase_flash(input: ProtocolTransportInput): Promise<void> {
  await flashEraseCommand(input, GBA_RAM_FLASH_CMD_SET, GBA_RAM_FLASH_ADDR_1, FLASH_CMD_CHIP_ERASE);
}

/**
 * CART: 控制供电 (0xa0)
 */
export type CartPowerMode = 0 | 1 | 2;

export async function cart_power(input: ProtocolTransportInput, mode: CartPowerMode): Promise<void> {
  const payload = createCommandPayload(GBCCommand.CART_POWER)
    .addBytes(new Uint8Array([mode]))
    .build();

  await sendPackage(input, payload);
}

/**
 * GBC: FRAM Write with latency (0xea)
 */
export async function gbc_write_fram(input: ProtocolTransportInput, data: Uint8Array, baseAddress = 0, latency = 25): Promise<void> {
  const payload = createCommandPayload(GBCCommand.FRAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(new Uint8Array([latency]))
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBC FRAM write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBC: FRAM Read with latency (0xeb)
 */
export async function gbc_read_fram(input: ProtocolTransportInput, size: number, baseAddress = 0, latency = 25): Promise<Uint8Array> {
  const payload = createCommandPayload(GBCCommand.FRAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .addBytes(new Uint8Array([latency]))
    .build();

  return sendAndReadProtocolPayload(input, payload, 'GBC FRAM read', size, baseAddress);
}

/**
 * GBA: FRAM Write with latency (0xe7)
 */
export async function ram_write_fram(input: ProtocolTransportInput, data: Uint8Array, baseAddress = 0, latency = 25): Promise<void> {
  const payload = createCommandPayload(GBACommand.FRAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(new Uint8Array([latency]))
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBA FRAM write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: FRAM Read with latency (0xe8)
 */
export async function ram_read_fram(input: ProtocolTransportInput, size: number, baseAddress = 0, latency = 25): Promise<Uint8Array> {
  const payload = createCommandPayload(GBACommand.FRAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .addBytes(new Uint8Array([latency]))
    .build();

  return sendAndReadProtocolPayload(input, payload, 'GBA FRAM read', size, baseAddress);
}

// --- GBC Commands ---

/**
 * GBC: Direct Write (0xfa)
 */
export async function gbc_write(input: ProtocolTransportInput, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBC direct write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 *  GBC: Read (0xfb)
 */
export async function gbc_read(input: ProtocolTransportInput, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBCCommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  return sendAndReadProtocolPayload(input, payload, 'GBC read', size, baseAddress);
}

/**
 * GBC: ROM Program (0xfc)
 */
export async function gbc_rom_program(input: ProtocolTransportInput, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {
  return flashProgramRom(input, GBCCommand.ROM_PROGRAM, data, baseAddress, bufferSize, 'GBC ROM programming');
}

/**
 * GBC: Read ID
 */
export async function gbc_rom_get_id(input: ProtocolTransportInput): Promise<Uint8Array> {
  return flashGetId(input, GBC_FLASH_CMD_SET, [
    { address: 0x00, size: 4 },
  ]);
}

/**
 */
export async function gbc_rom_erase_chip(input: ProtocolTransportInput) {
  await flashEraseCommand(input, GBC_FLASH_CMD_SET, GBC_FLASH_ADDR_1, FLASH_CMD_CHIP_ERASE);
  await flashPollUntilReady(input, GBC_FLASH_CMD_SET, 0x00, {
    pollBytes: 1,
    pollIntervalMs: GBC_CHIP_ERASE_POLL_INTERVAL_MS,
    timeoutMs: GBC_CHIP_ERASE_TIMEOUT_MS,
  });
}

/**
 * GBC: Erase single ROM sector
 */
export async function gbc_rom_erase_sector(input: ProtocolTransportInput, sectorAddress: number) {
  try {
    return await flashEraseSector(input, GBC_FLASH_CMD_SET, sectorAddress, sectorAddress, {
      pollBytes: 1,
      pollIntervalMs: GBC_SECTOR_ERASE_POLL_INTERVAL_MS,
      timeoutMs: GBC_SECTOR_ERASE_TIMEOUT_MS,
    });
  } catch (error) {
    throw new Error(`GBC ROM single sector erase failed (Address: ${formatHex(sectorAddress, 4)})`);
  }
}
