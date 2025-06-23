import { GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, getResult, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import { DeviceInfo } from '@/types/device-info';

// --- GBA Commands ---

/**
 * GBA: Read ID (0xf0)
 */
export async function rom_get_id(device: DeviceInfo): Promise<Uint8Array> {
  const { writer, reader } = device;

  await sendPackage(writer, createCommandPayload(GBACommand.READ_ID).build());
  const result = await getPackage(reader, 2 + 8);
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
  const { writer, reader } = device;

  await sendPackage(writer, createCommandPayload(GBACommand.ERASE_CHIP).build());
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA Erase failed');
}

/**
 * GBA: ROM Sector Erase (0xf3)
 */
export async function rom_erase_sector(device: DeviceInfo, sectorAddress: number): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.SECTOR_ERASE).addAddress(sectorAddress).build();
  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

/**
 * GBA: ROM Program (0xf4)
 */
export async function rom_program(device: DeviceInfo, data: Uint8Array, baseAddress = 0, bufferSize = 512): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM programming failed (Address: 0x${baseAddress.toString(16)})`);
}

/**
 * GBA: ROM Direct Write (0xf5)
 */
export async function rom_write(device: DeviceInfo, data: Uint8Array, baseByteAddress = 0): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.DIRECT_WRITE)
    .addAddress(baseByteAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM direct write failed (Address: 0x${baseByteAddress.toString(16)})`);
}

/**
 * GBA: ROM Read (0xf6)
 */
export async function rom_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();
  await sendPackage(writer, payload);
  const res = await getPackage(reader, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBA ROM read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

/**
 * GBA: RAM Write (0xf7)
 */
export async function ram_write(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.RAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`RAM write failed (Address: 0x${baseAddress.toString(16)})`);
}

/**
 * GBA: RAM Read (0xf8)
 */
export async function ram_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.RAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(writer, payload);
  const res = await getPackage(reader, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBA RAM read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

/**
 * GBA: RAM Write to FLASH (0xf9)
 */
export async function ram_program_flash(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.RAM_WRITE_TO_FLASH)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: 0x${baseAddress.toString(16)})`);
}

// --- GBC Commands ---

/**
 * GBC: Direct Write (0xfa)
 */
export async function gbc_write(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBC direct write failed (Address: 0x${baseAddress.toString(16)})`);
}

/**
 *  GBC: Read (0xfb)
 */
export async function gbc_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBCCommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(writer, payload);
  const res = await getPackage(reader, 2 + size);
  if (res.data && res.data.byteLength >= 2 + size) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBC read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

/**
 * GBC: ROM Program (0xfc)
 */
export async function gbc_rom_program(device: DeviceInfo, data: Uint8Array, baseAddress = 0, bufferSize = 512): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBCCommand.ROM_PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBC ROM programming failed (Address: 0x${baseAddress.toString(16)})`);
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

/**
 * GBC: Erase single ROM sector
 * @param device - Device information
 * @param sectorAddress - Address of the sector to erase
 * @returns Promise indicating success
 */
export async function gbc_rom_erase_sector(device: DeviceInfo, sectorAddress: number) {
  const bank = sectorAddress >> 14; // Calculate bank from address (assuming 16KB banks)
  let targetAddr: number;
  if (bank === 0) {
    targetAddr = 0x0000 + (sectorAddress & 0x3fff);
  } else {
    targetAddr = 0x4000 + (sectorAddress & 0x3fff);
  }

  try {
    // Sector Erase sequence (AMD/SST Flash command sequence)
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle
    await gbc_write(device, new Uint8Array([0x55]), 0x555); // Second unlock cycle
    await gbc_write(device, new Uint8Array([0x80]), 0xaaa); // Erase setup command
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa); // First unlock cycle (erase)
    await gbc_write(device, new Uint8Array([0x55]), 0x555); // Second unlock cycle (erase)
    await gbc_write(device, new Uint8Array([0x30]), targetAddr); // Sector Erase command

    // Wait for completion by polling the target address
    let temp: Uint8Array;
    do {
      await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
      temp = await gbc_read(device, 1, targetAddr);
    } while (temp[0] !== 0xff); // Wait until the byte reads as 0xff (erased)

    return true;
  } catch (error) {
    throw new Error(`GBC ROM single sector erase failed (Address: 0x${sectorAddress.toString(16)})`);
  }
}
