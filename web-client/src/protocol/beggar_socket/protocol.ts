import { timeout } from '@/utils/async-utils';
import { formatHex } from '@/utils/formatter-utils';

import { GBACommand, GBCCommand } from './command';
import { sendAndReadProtocolPayload } from './packet-read';
import { createCommandPayload } from './payload-builder';
import { sendAndExpectAck, type ProtocolTransportInput, sendPackage, toLittleEndian } from './protocol-utils';

const GBA_SECTOR_ERASE_POLL_INTERVAL_MS = 20;
const GBA_SECTOR_ERASE_TIMEOUT_MS = 60_000;

const GBC_SECTOR_ERASE_POLL_INTERVAL_MS = 20;
const GBC_SECTOR_ERASE_TIMEOUT_MS = 15_000;
const GBC_CHIP_ERASE_POLL_INTERVAL_MS = 50;
const GBC_CHIP_ERASE_TIMEOUT_MS = 120_000;

// --- GBA Commands ---

/**
 * GBA: Read ID (0xf0)
 */
export async function rom_get_id(input: ProtocolTransportInput): Promise<Uint8Array> {
  // Flash ID读取序列：写入解锁命令
  await rom_write(input, toLittleEndian(0xaa, 2), 0x555);
  await rom_write(input, toLittleEndian(0x55, 2), 0x2aa);
  await rom_write(input, toLittleEndian(0x90, 2), 0x555);

  try {
    // 读取地址0x00-0x01的制造商ID和设备ID (4字节)
    const idPart1 = await rom_read(input, 4, 0x00);
    // 读取地址0x0e-0x0f的设备ID (4字节)
    const idPart2 = await rom_read(input, 4, 0x1c);

    // 组装完整的8字节ID数据
    const id = new Uint8Array(8);
    id.set(idPart1, 0); // 前4字节：制造商ID + 设备ID
    id.set(idPart2, 4); // 后4字节：设备ID
    return id;
  } finally {
    // 无论读取成功还是失败，始终尝试退出 Autoselect 模式，避免 Flash 停在异常状态
    await rom_write(input, toLittleEndian(0xf0, 2), 0x00).catch(() => {});
  }
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
  // Align to word boundary before shifting; matches firmware masking in rom_erase_sector_direct()
  const alignedSectorAddress = sectorAddress & ~1;
  const sectorWordAddress = alignedSectorAddress >>> 1;
  const errorPrefix = `GBA ROM sector erase failed (Address: ${formatHex(sectorAddress, 4)})`;
  const deadline = Date.now() + GBA_SECTOR_ERASE_TIMEOUT_MS;

  try {
    await rom_write(input, toLittleEndian(0xaa, 2), 0x555);
    await rom_write(input, toLittleEndian(0x55, 2), 0x2aa);
    await rom_write(input, toLittleEndian(0x80, 2), 0x555);
    await rom_write(input, toLittleEndian(0xaa, 2), 0x555);
    await rom_write(input, toLittleEndian(0x55, 2), 0x2aa);
    await rom_write(input, toLittleEndian(0x30, 2), sectorWordAddress);

    while (Date.now() < deadline) {
      await timeout(GBA_SECTOR_ERASE_POLL_INTERVAL_MS);
      const status = await rom_read(input, 2, alignedSectorAddress);
      if (status[0] === 0xff && status[1] === 0xff) {
        return true;
      }
    }

    throw new Error(`erase timeout after ${GBA_SECTOR_ERASE_TIMEOUT_MS}ms`);
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
  if (data.length > bufferSize) {
    throw new RangeError(`Data length ${data.length} exceeds buffer size ${bufferSize}`);
  }
  const payload = createCommandPayload(GBACommand.PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBA ROM programming failed (Address: ${formatHex(baseAddress, 4)})`);
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

export async function ram_erase_flash(input: ProtocolTransportInput): Promise<void> {
  await ram_write(input, new Uint8Array([0xaa]), 0x5555);
  await ram_write(input, new Uint8Array([0x55]), 0x2aaa);
  await ram_write(input, new Uint8Array([0x80]), 0x5555);
  await ram_write(input, new Uint8Array([0xaa]), 0x5555);
  await ram_write(input, new Uint8Array([0x55]), 0x2aaa);
  await ram_write(input, new Uint8Array([0x10]), 0x5555); // Chip-Erase
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
  if (data.length > bufferSize) {
    throw new RangeError(`Data length ${data.length} exceeds buffer size ${bufferSize}`);
  }

  const payload = createCommandPayload(GBCCommand.ROM_PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  const ack = await sendAndExpectAck(input, payload);
  if (!ack) throw new Error(`GBC ROM programming failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBC: Read ID
 */
export async function gbc_rom_get_id(input: ProtocolTransportInput): Promise<Uint8Array> {
  await gbc_write(input, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(input, new Uint8Array([0x55]), 0x555);
  await gbc_write(input, new Uint8Array([0x90]), 0xaaa);
  try {
    const id = await gbc_read(input, 4, 0);
    return id;
  } finally {
    // 无论读取成功还是失败，始终尝试退出 Autoselect 模式
    await gbc_write(input, new Uint8Array([0xf0]), 0x00).catch(() => {});
  }
}

export async function gbc_rom_erase_chip(input: ProtocolTransportInput) {
  await gbc_write(input, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(input, new Uint8Array([0x55]), 0x555);
  await gbc_write(input, new Uint8Array([0x80]), 0xaaa);
  await gbc_write(input, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(input, new Uint8Array([0x55]), 0x555);
  await gbc_write(input, new Uint8Array([0x10]), 0xaaa);

  // Poll address 0x00 until erased (0xff); chip erase can take up to 2 minutes
  const deadline = Date.now() + GBC_CHIP_ERASE_TIMEOUT_MS;
  let status: Uint8Array;
  do {
    if (Date.now() > deadline) {
      throw new Error(`GBC chip erase timeout after ${GBC_CHIP_ERASE_TIMEOUT_MS}ms`);
    }
    await timeout(GBC_CHIP_ERASE_POLL_INTERVAL_MS);
    status = await gbc_read(input, 1, 0x00);
  } while (status[0] !== 0xff);
}

/**
 * GBC: Erase single ROM sector
 * @param input - Device information
 * @param sectorAddress - Address of the sector to erase
 * @returns Promise indicating success
 */
export async function gbc_rom_erase_sector(input: ProtocolTransportInput, sectorAddress: number) {
  try {
    // Sector Erase sequence (AMD/SST Flash command sequence)
    await gbc_write(input, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle
    await gbc_write(input, new Uint8Array([0x55]), 0x555); // Second unlock cycle
    await gbc_write(input, new Uint8Array([0x80]), 0xaaa); // Erase setup command
    await gbc_write(input, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle (erase)
    await gbc_write(input, new Uint8Array([0x55]), 0x555); // Second unlock cycle (erase)
    await gbc_write(input, new Uint8Array([0x30]), sectorAddress); // Sector Erase command

    // Poll until erased (0xff) or timeout
    const deadline = Date.now() + GBC_SECTOR_ERASE_TIMEOUT_MS;
    let temp: Uint8Array;
    do {
      if (Date.now() > deadline) {
        throw new Error(`erase timeout after ${GBC_SECTOR_ERASE_TIMEOUT_MS}ms`);
      }
      await timeout(GBC_SECTOR_ERASE_POLL_INTERVAL_MS);
      temp = await gbc_read(input, 1, sectorAddress);
    } while (temp[0] !== 0xff);

    return true;
  } catch (error) {
    throw new Error(`GBC ROM single sector erase failed (Address: ${formatHex(sectorAddress, 4)})`);
  }
}
