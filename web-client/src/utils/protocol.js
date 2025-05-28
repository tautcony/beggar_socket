// CRC16 (Modbus)
export function modbusCRC16(bytes) {
  let crc = 0xFFFF
  for (let b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) {
      let temp = crc & 1
      crc >>= 1
      if (temp) crc ^= 0xA001
      crc &= 0xFFFF
    }
  }
  return crc
}

// 封装数据包
function buildPackage(payload) {
  const size = 2 + payload.length + 2
  let buf = new Uint8Array(size)
  buf[0] = size & 0xFF
  buf[1] = (size >> 8) & 0xFF
  buf.set(payload, 2)
  // CRC16（如需启用，解开注释）
  // let crc = modbusCRC16(buf.slice(0, size - 2))
  // buf[size - 2] = crc & 0xFF
  // buf[size - 1] = (crc >> 8) & 0xFF
  return buf
}

// 发送数据包
async function sendPackage(device, endpointOut, payload) {
  const buf = buildPackage(payload)
  await device.device.transferOut(endpointOut, buf)
}

// 等待1字节ack
async function getRespon(device, endpointIn) {
  let result = await device.device.transferIn(endpointIn, 1)
  return result.status === "ok" && result.data.getUint8(0) === 0xaa
}

// --- GBA Commands ---

// GBA: 读取ID (0xf0)
export async function rom_readID(device) {
  const { endpointOut, endpointIn } = device
  await sendPackage(device, endpointOut, new Uint8Array([0xf0]))
  let result = await device.device.transferIn(endpointIn, 10) // 2字节包头+8字节数据
  if (result.status === "ok" && result.data.byteLength >= 10) {
    let id = []
    for (let i = 2; i < 10; ++i) id.push(result.data.getUint8(i))
    return id
  } else {
    throw new Error('GBA Failed to read ID')
  }
}

// GBA: 擦除芯片 (0xf1)
export async function rom_eraseChip(device) {
  const { endpointOut, endpointIn } = device
  await sendPackage(device, endpointOut, new Uint8Array([0xf1]))
  let ack = await getRespon(device, endpointIn)
  if (!ack) throw new Error('GBA Erase failed')
}

// GBA: ROM Sector Erase (64KB) (0xf3)
export async function rom_sector_erase(device, sectorAddress) {
  const { endpointOut, endpointIn } = device;
  let payload = new Uint8Array(1 + 4);
  payload[0] = 0xf3;
  let addrBytes = new Uint8Array(new Uint32Array([sectorAddress]).buffer);
  payload.set(addrBytes, 1);
  await sendPackage(device, endpointOut, payload);
  let ack = await getRespon(device, endpointIn);
  if (!ack) throw new Error('GBA ROM sector erase failed');
  return ack;
}

// GBA: ROM Program (0xf4)
export async function rom_program(device, fileData, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));
    const chunkBufferSize = chunk.length;

    let payload = new Uint8Array(1 + 4 + 2 + chunkBufferSize);
    payload[0] = 0xf4;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload[5] = chunkBufferSize & 0xFF;
    payload[6] = (chunkBufferSize >> 8) & 0xFF;
    payload.set(chunk, 7);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`GBA ROM programming failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBA: ROM Direct Write (透传) (0xf5)
export async function rom_direct_write(device, fileData, baseByteAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceByteAddress = baseByteAddress + addrOffset;
    const currentDeviceWordAddress = currentDeviceByteAddress / 2;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    if (chunk.length % 2 !== 0) {
        console.warn("rom_direct_write: chunk size is not a multiple of 2. This might be an issue.");
    }

    let payload = new Uint8Array(1 + 4 + chunk.length);
    payload[0] = 0xf5;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceWordAddress]).buffer);
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`GBA ROM direct write failed (Address: 0x${currentDeviceWordAddress.toString(16)} [word address])`);
  }
}

// GBA: ROM 读取 (0xf6)
export async function rom_read(device, size, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;
  let result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    let payload = new Uint8Array(1 + 4 + 2);
    payload[0] = 0xf6;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload[5] = chunkSize & 0xFF;
    payload[6] = (chunkSize >> 8) & 0xFF;

    await sendPackage(device, endpointOut, payload);
    let res = await device.device.transferIn(endpointIn, chunkSize + 2);
    if (res.status === "ok" && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data.getUint8(i + 2);
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBA ROM read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBA: RAM 写入 (0xf7)
export async function ram_write(device, fileData, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;
  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    let payload = new Uint8Array(1 + 4 + chunk.length);
    payload[0] = 0xf7;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`RAM write failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBA: RAM 读取 (0xf8)
export async function ram_read(device, size, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;
  let result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    let payload = new Uint8Array(1 + 4 + 2);
    payload[0] = 0xf8;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload[5] = chunkSize & 0xFF;
    payload[6] = (chunkSize >> 8) & 0xFF;

    await sendPackage(device, endpointOut, payload);
    let res = await device.device.transferIn(endpointIn, chunkSize + 2);
    if (res.status === "ok" && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data.getUint8(i + 2);
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBA RAM read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBA: RAM Write to FLASH (0xf9)
export async function ram_write_to_flash(device, fileData, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    let payload = new Uint8Array(1 + 4 + chunk.length);
    payload[0] = 0xf9;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`GBA RAM write to FLASH failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// --- GBC Commands ---

// GBC: Direct Write (透传) (0xfa)
export async function gbc_direct_write(device, fileData, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));

    let payload = new Uint8Array(1 + 4 + chunk.length);
    payload[0] = 0xfa;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload.set(chunk, 5);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`GBC direct write failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// GBC: Read (0xfb)
export async function gbc_read(device, size, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;
  let result = new Uint8Array(size);
  let bytesFetched = 0;

  for (let addrOffset = 0; bytesFetched < size; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const remainingSize = size - bytesFetched;
    const chunkSize = Math.min(pageSize, remainingSize);
    if (chunkSize <= 0) break;

    let payload = new Uint8Array(1 + 4 + 2);
    payload[0] = 0xfb;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload[5] = chunkSize & 0xFF;
    payload[6] = (chunkSize >> 8) & 0xFF;

    await sendPackage(device, endpointOut, payload);
    let res = await device.device.transferIn(endpointIn, chunkSize + 2);
    if (res.status === "ok" && res.data.byteLength >= chunkSize + 2) {
      for (let i = 0; i < chunkSize; ++i) {
        result[bytesFetched + i] = res.data.getUint8(i + 2);
      }
      bytesFetched += chunkSize;
    } else {
      throw new Error(`GBC read failed (Address: 0x${currentDeviceAddress.toString(16)})`);
    }
  }
  return result;
}

// GBC: ROM Program (0xfc)
export async function gbc_rom_program(device, fileData, baseAddress = 0) {
  const { endpointOut, endpointIn } = device;
  const pageSize = 256;

  for (let addrOffset = 0; addrOffset < fileData.length; addrOffset += pageSize) {
    const currentDeviceAddress = baseAddress + addrOffset;
    const chunk = fileData.slice(addrOffset, Math.min(addrOffset + pageSize, fileData.length));
    const chunkBufferSize = chunk.length;

    let payload = new Uint8Array(1 + 4 + 2 + chunkBufferSize);
    payload[0] = 0xfc;
    let addrBytes = new Uint8Array(new Uint32Array([currentDeviceAddress]).buffer);
    payload.set(addrBytes, 1);
    payload[5] = chunkBufferSize & 0xFF;
    payload[6] = (chunkBufferSize >> 8) & 0xFF;
    payload.set(chunk, 7);

    await sendPackage(device, endpointOut, payload);
    let ack = await getRespon(device, endpointIn);
    if (!ack) throw new Error(`GBC ROM programming failed (Address: 0x${currentDeviceAddress.toString(16)})`);
  }
}

// --- Verification Functions ---

// 校验ROM
export async function rom_verify(device, fileData, baseAddress = 0) {
  const readData = await rom_read(device, fileData.length, baseAddress);
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false
  }
  return true
}

// 校验RAM
export async function ram_verify(device, fileData, baseAddress = 0) {
  const readData = await ram_read(device, fileData.length, baseAddress);
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false
  }
  return true
}
