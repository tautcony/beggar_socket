import { GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, getResult, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import { DeviceInfo } from '@/types/device-info';

const INIT_ERROR_MESSAGE = 'Serial port not properly initialized';
// --- GBA Commands ---

// GBA: 读取ID (0xf0)
export async function rom_readID(device: DeviceInfo): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  await sendPackage(writer, createCommandPayload(GBACommand.READ_ID).build());
  const result = await getPackage(reader, 10);
  if (result.data?.byteLength && result.data.byteLength >= 10) {
    return result.data.slice(2);
  } else {
    throw new Error('GBA Failed to read ID');
  }
}

// GBA: 擦除芯片 (0xf1)
export async function rom_eraseChip(device: DeviceInfo): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  await sendPackage(writer, createCommandPayload(GBACommand.ERASE_CHIP).build());
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA Erase failed');
}

// GBA: ROM Sector Erase (64KB) (0xf3)
export async function rom_sector_erase(device: DeviceInfo, sectorAddress: number): Promise<boolean> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.SECTOR_ERASE).addAddress(sectorAddress).build();
  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

// GBA: ROM Program (0xf4)
export async function rom_program(device: DeviceInfo, data: Uint8Array, baseAddress = 0, bufferSize = 512): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM programming failed (Address: 0x${baseAddress.toString(16)})`);
}

// GBA: ROM Direct Write (透传) (0xf5)
export async function rom_direct_write(device: DeviceInfo, fileData: Uint8Array, baseByteAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.DIRECT_WRITE)
    .addAddress(baseByteAddress)
    .addBytes(fileData)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM direct write failed (Address: 0x${baseByteAddress.toString(16)} [word address])`);
}

// GBA: ROM 读取 (0xf6)
export async function rom_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();
  await sendPackage(writer, payload);
  const res = await getPackage(reader, size + 2);
  if (res.data && res.data.byteLength >= size + 2) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBA ROM read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

// GBA: RAM 写入 (0xf7)
export async function ram_write(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.RAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(fileData)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`RAM write failed (Address: 0x${baseAddress.toString(16)})`);

}

// GBA: RAM 读取 (0xf8)
export async function ram_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.RAM_READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(writer, payload);
  const res = await getPackage(reader, size + 2);
  if (res.data && res.data.byteLength >= size + 2) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBA RAM read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

// GBA: RAM Write to FLASH (0xf9)
export async function ram_write_to_flash(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBACommand.RAM_WRITE_TO_FLASH)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: 0x${baseAddress.toString(16)})`);

}

// --- GBC Commands ---

// GBC: Direct Write (透传) (0xfa)
export async function gbc_direct_write(device: DeviceInfo, data: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBC direct write failed (Address: 0x${baseAddress.toString(16)})`);
}

// GBC: Read (0xfb)
export async function gbc_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }
  const payload = createCommandPayload(GBCCommand.READ)
    .addAddress(baseAddress)
    .addLength(size)
    .build();

  await sendPackage(writer, payload);
  const res = await getPackage(reader, size + 2);
  if (res.data && res.data.byteLength >= size + 2) {
    return res.data.slice(2);
  } else {
    throw new Error(`GBC read failed (Address: 0x${baseAddress.toString(16)})`);
  }
}

// GBC: ROM Program (0xfc)
export async function gbc_rom_program(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0, bufferSize = 512): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error(INIT_ERROR_MESSAGE);
  }

  const payload = createCommandPayload(GBCCommand.ROM_PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(fileData)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBC ROM programming failed (Address: 0x${baseAddress.toString(16)})`);
}

// --- Verification Functions ---

// 校验ROM
export async function rom_verify(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<boolean> {
  const readData = await rom_read(device, fileData.length, baseAddress);
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false;
  }
  return true;
}

// 校验RAM
export async function ram_verify(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<boolean> {
  const readData = await ram_read(device, fileData.length, baseAddress);
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false;
  }
  return true;
}
