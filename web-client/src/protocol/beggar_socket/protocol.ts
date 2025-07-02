import { BootloaderSubCommand, GBACommand, GBCCommand, IAPCommand, IAPSubCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, getResult, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import { DeviceInfo } from '@/types/device-info';
import { DeviceVersionInfo } from '@/types/device-version';
import { formatHex } from '@/utils/formatter-utils';

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
export async function rom_program(device: DeviceInfo, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM programming failed (Address: ${formatHex(baseAddress, 4)})`);
}

/**
 * GBA: ROM Direct Write (0xf5)
 */
export async function rom_write(device: DeviceInfo, data: Uint8Array, baseAddress: number): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBA ROM direct write failed (Address: ${formatHex(baseAddress, 4)})`);
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
    throw new Error(`GBA ROM read failed (Address: ${formatHex(baseAddress, 4)})`);
  }
}

/**
 * GBA: RAM Write (0xf7)
 */
export async function ram_write(device: DeviceInfo, data: Uint8Array, baseAddress: number): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBACommand.RAM_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`RAM write failed (Address: ${formatHex(baseAddress, 4)})`);
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
    throw new Error(`GBA RAM read failed (Address: ${formatHex(baseAddress, 4)})`);
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
  const { writer, reader } = device;

  const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
    .addAddress(baseAddress)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error(`GBC direct write failed (Address: ${formatHex(baseAddress, 4)})`);
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
    throw new Error(`GBC read failed (Address: ${formatHex(baseAddress, 4)})`);
  }
}

/**
 * GBC: ROM Program (0xfc)
 */
export async function gbc_rom_program(device: DeviceInfo, data: Uint8Array, baseAddress: number, bufferSize: number): Promise<void> {
  const { writer, reader } = device;

  const payload = createCommandPayload(GBCCommand.ROM_PROGRAM)
    .addAddress(baseAddress)
    .addLength(bufferSize)
    .addBytes(data)
    .build();

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
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

// --- IAP Commands ---

/**
 * IAP: Get Version Info (0xff 0x00)
 */
export async function iap_get_version_info(device: DeviceInfo): Promise<DeviceVersionInfo> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(IAPSubCommand.GET_VERSION_INFO)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);

  // 返回格式: CRC(2) + 主版本(1) + 次版本(1) + 补丁号(1) + 构建号(2) + 时间戳(4) + 版本类型(1) + 字符串长度(1) + 版本字符串(n)
  const header = await getPackage(reader, 13); // 最少13字节
  if (!header.data || header.data.byteLength < 13) {
    throw new Error('Invalid version info response');
  }

  const dataView = new DataView(header.data.buffer, header.data.byteOffset + 2); // 跳过CRC
  const majorVersion = dataView.getUint8(0);
  const minorVersion = dataView.getUint8(1);
  const patchVersion = dataView.getUint8(2);
  const buildNumber = dataView.getUint16(3, true); // little-endian
  const timestamp = dataView.getUint32(5, true); // little-endian
  const versionType = dataView.getUint8(9);
  const stringLength = dataView.getUint8(10);

  let versionString = '';
  if (stringLength > 0) {
    // 如果有版本字符串，需要读取额外的字节
    if (header.data.byteLength < 13 + stringLength) {
      const remaining = await getPackage(reader, stringLength);
      if (remaining.data) {
        versionString = new TextDecoder().decode(remaining.data);
      }
    } else {
      versionString = new TextDecoder().decode(header.data.slice(13, 13 + stringLength));
    }
  }

  return {
    majorVersion,
    minorVersion,
    patchVersion,
    buildNumber,
    timestamp,
    versionType,
    versionString,
  };
}

/**
 * IAP: Restart to Bootloader (0xff 0xff)
 */
export async function iap_restart_to_bootloader(device: DeviceInfo): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(IAPSubCommand.RESTART_TO_BOOTLOADER)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Get Version Info (0xff 0x00)
 */
export async function bootloader_get_version_info(device: DeviceInfo): Promise<DeviceVersionInfo> {
  // Bootloader模式下的版本信息获取和应用程序模式相同
  return await iap_get_version_info(device);
}

/**
 * Bootloader: Erase Flash (0xff 0x01)
 */
export async function bootloader_erase_flash(device: DeviceInfo, startAddress: number, eraseSize: number): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.ERASE_FLASH)
    .addAddress(startAddress)
    .addLittleEndian(eraseSize, 4)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Program Flash (0xff 0x02)
 */
export async function bootloader_program_flash(device: DeviceInfo, startAddress: number, data: Uint8Array): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.PROGRAM_FLASH)
    .addAddress(startAddress)
    .addBytes(data)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Start Upgrade (0xff 0x10)
 */
export async function bootloader_start_upgrade(device: DeviceInfo, appSize: number, appCrc: number): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.START_UPGRADE)
    .addLittleEndian(appSize, 4)
    .addLittleEndian(appCrc, 4)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Upgrade Data (0xff 0x11)
 */
export async function bootloader_upgrade_data(device: DeviceInfo, packetNum: number, data: Uint8Array): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.UPGRADE_DATA)
    .addLittleEndian(packetNum, 4)
    .addBytes(data)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Finish Upgrade (0xff 0x12)
 */
export async function bootloader_finish_upgrade(device: DeviceInfo): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.FINISH_UPGRADE)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}

/**
 * Bootloader: Jump to Application (0xff 0xff)
 */
export async function bootloader_jump_to_app(device: DeviceInfo): Promise<boolean> {
  const { writer, reader } = device;

  const payload = createCommandPayload(IAPCommand.IAP_CMD)
    .addByte(BootloaderSubCommand.JUMP_TO_APP)
    .build(); // 使用默认的CRC

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  return ack;
}
