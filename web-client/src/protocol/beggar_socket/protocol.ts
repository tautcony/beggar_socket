import { GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, getResult, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import { DeviceInfo } from '@/types/device-info';
import { formatHex } from '@/utils/formatter-utils';

// --- GBA Commands ---

/**
 * GBA: Read ID (0xf0)
 */
export async function rom_get_id(device: DeviceInfo): Promise<Uint8Array> {
  await sendPackage(device, createCommandPayload(GBACommand.READ_ID).build());
  const result = await getPackage(device, 2 + 8);
  if (result.data?.byteLength && result.data.byteLength >= 10) {
    return result.data.slice(2);
  } else {
    throw new Error('GBA Failed to read ID');
  }
}

/**
 * GBA: Erase chip (0xf1)
 */
export async function rom_erase_chip(device: DeviceInfo): Promise<void> {
  await sendPackage(device, createCommandPayload(GBACommand.ERASE_CHIP).build());
  const ack = await getResult(device);
  if (!ack) throw new Error('GBA Erase failed');
}

/**
 * GBA: ROM Sector Erase (0xf3)
 */
export async function rom_erase_sector(device: DeviceInfo, sectorAddress: number): Promise<boolean> {
  const payload = createCommandPayload(GBACommand.SECTOR_ERASE).addAddress(sectorAddress).build();
  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

/**
 * GBA: ROM Program (0xf4)
 */
export async function rom_program(device: DeviceInfo, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {
  const payload = createCommandPayload(GBACommand.PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`GBA ROM programming failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: ROM Direct Write (0xf5)
 */
export async function rom_write(device: DeviceInfo, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBACommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`GBA ROM direct write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: ROM Read (0xf6)
 */
export async function rom_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBACommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();
  await sendPackage(device, payload);
  const res = await getPackage(device, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    const message = `GBA ROM read failed (Address: ${formatHex(baseAddress, 4)}, Excepted size: ${size}, Actual size: ${res.data?.byteLength})`;
    console.error(message, res.data);
    throw new Error(message);
  }
}

/**
 * GBA: RAM Write (0xf7)
 */
export async function ram_write(device: DeviceInfo, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBACommand.RAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`RAM write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: RAM Read (0xf8)
 */
export async function ram_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBACommand.RAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(device, payload);
  const res = await getPackage(device, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    const message = `GBA RAM read failed (Address: ${formatHex(baseAddress, 4)}, Excepted size: ${size}, Actual size: ${res.data?.byteLength})`;
    console.error(message, res.data);
    throw new Error(message);
  }
}

/**
 * GBA: RAM Write to FLASH (0xf9)
 */
export async function ram_program_flash(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const payload = createCommandPayload(GBACommand.RAM_WRITE_TO_FLASH)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: ${formatHex(baseAddress, 4)})`);
}

export async function ram_erase_flash(device: DeviceInfo): Promise<void> {
  await ram_write(device, new Uint8Array([0xaa]), 0x5555);
  await ram_write(device, new Uint8Array([0x55]), 0x2aaa);
  await ram_write(device, new Uint8Array([0x80]), 0x5555);
  await ram_write(device, new Uint8Array([0xaa]), 0x5555);
  await ram_write(device, new Uint8Array([0x55]), 0x2aaa);
  await ram_write(device, new Uint8Array([0x10]), 0x5555); // Chip-Erase
}

// --- GBC Commands ---

/**
 * GBC: Direct Write (0xfa)
 */
export async function gbc_write(device: DeviceInfo, data: Uint8Array, baseAddress: number): Promise<void> {
  const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`GBC direct write failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 *  GBC: Read (0xfb)
 */
export async function gbc_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const payload = createCommandPayload(GBCCommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(device, payload);
  const res = await getPackage(device, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    const message = `GBC read failed (Address: ${formatHex(baseAddress, 4)}, Excepted size: ${size}, Actual size: ${res.data?.byteLength})`;
    console.error(message, res.data);
    throw new Error(message);
  }
}

/**
 * GBC: ROM Program (0xfc)
 */
export async function gbc_rom_program(device: DeviceInfo, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {

  const payload = createCommandPayload(GBCCommand.ROM_PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(device, payload);
  const ack = await getResult(device);
  if (!ack) throw new Error(`GBC ROM programming failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBC: Read ID
 */
export async function gbc_rom_get_id(device: DeviceInfo): Promise<Uint8Array> {
  await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(device, new Uint8Array([0x55]), 0x555);
  await gbc_write(device, new Uint8Array([0x90]), 0xaaa);
  const id = await gbc_read(device, 4, 0);
  await gbc_write(device, new Uint8Array([0xf0]), 0x00);
  return id;
}

export async function gbc_rom_erase_chip(device: DeviceInfo) {
  await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(device, new Uint8Array([0x55]), 0x555);
  await gbc_write(device, new Uint8Array([0x80]), 0xaaa);
  await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
  await gbc_write(device, new Uint8Array([0x55]), 0x555);
  await gbc_write(device, new Uint8Array([0x10]), 0xaaa);
}

/**
 * GBC: Erase single ROM sector
 * @param device - Device information
 * @param sectorAddress - Address of the sector to erase
 * @returns Promise indicating success
 */
export async function gbc_rom_erase_sector(device: DeviceInfo, sectorAddress: number) {
  try {
    // Sector Erase sequence (AMD/SST Flash command sequence)
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle
    await gbc_write(device, new Uint8Array([0x55]), 0x555); // Second unlock cycle
    await gbc_write(device, new Uint8Array([0x80]), 0xaaa); // Erase setup command
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle (erase)
    await gbc_write(device, new Uint8Array([0x55]), 0x555); // Second unlock cycle (erase)
    await gbc_write(device, new Uint8Array([0x30]), sectorAddress); // Sector Erase command

    // Wait for completion by polling the target address
    let temp: Uint8Array;
    do {
      await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
      temp = await gbc_read(device, 1, sectorAddress);
    } while (temp[0] !== 0xff); // Wait until the byte reads as 0xff (erased)

    return true;
  } catch (error) {
    throw new Error(`GBC ROM single sector erase failed (Address: ${formatHex(sectorAddress, 4)})`);
  }
}
