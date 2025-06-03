import { toLittleEndian, sendPackage, getPackage, getResult } from '@/utils/ProtocolUtils.ts';
import { DeviceInfo } from '@/types/DeviceInfo.ts';
import { AdvancedSettings } from '@/utils/AdvancedSettings.ts';

// --- GBA Commands ---

// GBA: 读取ID (0xf0)
export async function rom_readID(device: DeviceInfo): Promise<number[]> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  await sendPackage(writer, new Uint8Array([0xf0]));
  const result = await getPackage(reader, 10);
  if (result.data?.byteLength && result.data.byteLength >= 10) {
    const id: number[] = [];
    for (let i = 2; i < 10; ++i) {
      id.push(result.data[i]);
    }
    return id;
  } else {
    throw new Error('GBA Failed to read ID');
  }
}

// GBA: 擦除芯片 (0xf1)
export async function rom_eraseChip(device: DeviceInfo): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  await sendPackage(writer, new Uint8Array([0xf1]));
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA Erase failed');
}

// GBA: ROM Sector Erase (64KB) (0xf3)
export async function rom_sector_erase(device: DeviceInfo, sectorAddress: number): Promise<boolean> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const payload = new Uint8Array(1 + 4);
  const sectorAddressBytes = toLittleEndian(sectorAddress, 4);
  payload[0] = 0xf3;
  payload.set(sectorAddressBytes, 1);

  await sendPackage(writer, payload);
  const ack = await getResult(reader);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

// GBA: ROM Program (0xf4)
export async function rom_program(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.romPageSize;
  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));
    const chunkBufferSize = chunk.length;

    const payload = new Uint8Array(1 + 4 + 2 + chunkBufferSize);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    const chunkSizeBytes = toLittleEndian(chunkBufferSize, 2);
    payload[0] = 0xf4;
    payload.set(addrBytes, 1);
    payload.set(chunkSizeBytes, 5);
    payload.set(chunk, 7);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`GBA ROM programming failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBA: ROM Direct Write (透传) (0xf5)
export async function rom_direct_write(device: DeviceInfo, fileData: Uint8Array, baseByteAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.romPageSize;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceByteAddress = baseByteAddress + addrOffset;
    const currentDeviceWordAddress = currentDeviceByteAddress / 2;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    if (chunk.length % 2 !== 0) {
      console.warn('rom_direct_write: chunk size is not a multiple of 2. This might be an issue.');
    }

    const payload = new Uint8Array(1 + 4 + chunk.length);
    const addrBytes = toLittleEndian(currentDeviceWordAddress, 4);
    payload[0] = 0xf5;
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`GBA ROM direct write failed (Address: 0x${currentDeviceWordAddress.toString(16)} [word address])`);
  }
}

// GBA: ROM 读取 (0xf6)
export async function rom_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.romPageSize;
  const result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    const payload = new Uint8Array(1 + 4 + 2);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    const chunkSizeBytes = toLittleEndian(chunkSize, 2);
    payload[0] = 0xf6;
    payload.set(addrBytes, 1);
    payload.set(chunkSizeBytes, 5);

    await sendPackage(writer, payload);
    const res = await getPackage(reader, chunkSize + 2);
    if (res.data && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data[i + 2];
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBA ROM read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBA: RAM 写入 (0xf7)
export async function ram_write(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;
  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    const payload = new Uint8Array(1 + 4 + chunk.length);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    payload[0] = 0xf7;
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`RAM write failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBA: RAM 读取 (0xf8)
export async function ram_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;
  const result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    const payload = new Uint8Array(1 + 4 + 2);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    const chunkSizeBytes = toLittleEndian(chunkSize, 2);
    payload[0] = 0xf8;
    payload.set(addrBytes, 1);
    payload.set(chunkSizeBytes, 5);

    await sendPackage(writer, payload);
    const res = await getPackage(reader, chunkSize + 2);
    if (res.data && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data[i + 2];
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBA RAM read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBA: RAM Write to FLASH (0xf9)
export async function ram_write_to_flash(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;
  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    const payload = new Uint8Array(1 + 4 + chunk.length);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    payload[0] = 0xf9;
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// --- GBC Commands ---

// GBC: Direct Write (透传) (0xfa)
export async function gbc_direct_write(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    const payload = new Uint8Array(1 + 4 + chunk.length);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    payload[0] = 0xfa;
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`GBC direct write failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBC: Read (0xfb)
export async function gbc_read(device: DeviceInfo, size: number, baseAddress = 0): Promise<Uint8Array> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;
  const result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    const payload = new Uint8Array(1 + 4 + 2);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    const chunkSizeBytes = toLittleEndian(chunkSize, 2);
    payload[0] = 0xfb;
    payload.set(addrBytes, 1);
    payload.set(chunkSizeBytes, 5);

    await sendPackage(writer, payload);
    const res = await getPackage(reader, chunkSize + 2);
    if (res.data && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data[i + 2];
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBC read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBC: ROM Program (0xfc)
export async function gbc_rom_program(device: DeviceInfo, fileData: Uint8Array, baseAddress = 0): Promise<void> {
  const { writer, reader } = device;
  if (!writer || !reader) {
    throw new Error('Serial port not properly initialized');
  }

  const pageSize = AdvancedSettings.ramPageSize;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));
    const chunkBufferSize = chunk.length;

    const payload = new Uint8Array(1 + 4 + 2 + chunkBufferSize);
    const addrBytes = toLittleEndian(currentDeviceAddress, 4);
    const chunkSizeBytes = toLittleEndian(chunkBufferSize, 2);
    payload[0] = 0xfc;
    payload.set(addrBytes, 1);
    payload.set(chunkSizeBytes, 5);
    payload.set(chunk, 7);

    await sendPackage(writer, payload);
    const ack = await getResult(reader);
    if (!ack) throw new Error(`GBC ROM programming failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
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
