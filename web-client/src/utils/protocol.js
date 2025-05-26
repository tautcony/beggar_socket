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

// 文件分包写入
export async function sendFileToDevice(device, fileData) {
  const { endpointOut, endpointIn } = device
  const pageSize = 256 // 可根据协议调整
  for (let addr = 0; addr < fileData.length; addr += pageSize) {
    const chunk = fileData.slice(addr, addr + pageSize)
    // 组包，仿照C# rom_write
    let payload = new Uint8Array(1 + 4 + chunk.length)
    payload[0] = 0xf5
    let addrBytes = new Uint8Array(new Uint32Array([addr / 2]).buffer) // wordAddr
    payload.set(addrBytes, 1)
    payload.set(chunk, 5)
    await sendPackage(device, endpointOut, payload)
    let ack = await getRespon(device, endpointIn)
    if (!ack) throw new Error('设备未响应')
  }
}

// 读取ID
export async function rom_readID(device) {
  const { endpointOut, endpointIn } = device
  await sendPackage(device, endpointOut, new Uint8Array([0xf0]))
  let result = await device.device.transferIn(endpointIn, 10) // 2字节包头+8字节数据
  if (result.status === "ok" && result.data.byteLength >= 10) {
    let id = []
    for (let i = 2; i < 10; ++i) id.push(result.data.getUint8(i))
    return id
  } else {
    throw new Error('读取ID失败')
  }
}

// 擦除芯片
export async function rom_eraseChip(device) {
  const { endpointOut, endpointIn } = device
  await sendPackage(device, endpointOut, new Uint8Array([0xf1]))
  let ack = await getRespon(device, endpointIn)
  if (!ack) throw new Error('擦除失败')
}

// 导出ROM
export async function rom_read(device, size) {
  const { endpointOut, endpointIn } = device
  const pageSize = 256
  let result = new Uint8Array(size)
  for (let addr = 0; addr < size; addr += pageSize) {
    let chunkSize = Math.min(pageSize, size - addr)
    let payload = new Uint8Array(1 + 4 + 2)
    payload[0] = 0xf6
    let addrBytes = new Uint8Array(new Uint32Array([addr]).buffer)
    payload.set(addrBytes, 1)
    payload[5] = chunkSize & 0xFF
    payload[6] = (chunkSize >> 8) & 0xFF
    await sendPackage(device, endpointOut, payload)
    let res = await device.device.transferIn(endpointIn, chunkSize + 2)
    if (res.status === "ok" && res.data.byteLength >= chunkSize + 2) {
      for (let i = 2; i < chunkSize + 2; ++i) {
        result[addr + i - 2] = res.data.getUint8(i)
      }
    } else {
      throw new Error('读取ROM失败')
    }
  }
  return result
}

// 校验ROM
export async function rom_verify(device, fileData) {
  const readData = await rom_read(device, fileData.length)
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false
  }
  return true
}

// 写入RAM
export async function ram_write(device, fileData) {
  const { endpointOut, endpointIn } = device
  const pageSize = 256
  for (let addr = 0; addr < fileData.length; addr += pageSize) {
    const chunk = fileData.slice(addr, addr + pageSize)
    let payload = new Uint8Array(1 + 4 + chunk.length)
    payload[0] = 0xf7
    let addrBytes = new Uint8Array(new Uint32Array([addr]).buffer)
    payload.set(addrBytes, 1)
    payload.set(chunk, 5)
    await sendPackage(device, endpointOut, payload)
    let ack = await getRespon(device, endpointIn)
    if (!ack) throw new Error('RAM写入失败')
  }
}

// 导出RAM
export async function ram_read(device, size) {
  const { endpointOut, endpointIn } = device
  const pageSize = 256
  let result = new Uint8Array(size)
  for (let addr = 0; addr < size; addr += pageSize) {
    let chunkSize = Math.min(pageSize, size - addr)
    let payload = new Uint8Array(1 + 4 + 2)
    payload[0] = 0xf8
    let addrBytes = new Uint8Array(new Uint32Array([addr]).buffer)
    payload.set(addrBytes, 1)
    payload[5] = chunkSize & 0xFF
    payload[6] = (chunkSize >> 8) & 0xFF
    await sendPackage(device, endpointOut, payload)
    let res = await device.device.transferIn(endpointIn, chunkSize + 2)
    if (res.status === "ok" && res.data.byteLength >= chunkSize + 2) {
      for (let i = 2; i < chunkSize + 2; ++i) {
        result[addr + i - 2] = res.data.getUint8(i)
      }
    } else {
      throw new Error('读取RAM失败')
    }
  }
  return result
}

// 校验RAM
export async function ram_verify(device, fileData) {
  const readData = await ram_read(device, fileData.length)
  for (let i = 0; i < fileData.length; ++i) {
    if (fileData[i] !== readData[i]) return false
  }
  return true
}
