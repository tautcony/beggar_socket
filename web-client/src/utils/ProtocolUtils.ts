
// CRC16 (Modbus)
export function modbusCRC16(bytes: Uint8Array): number {
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

export function toLittleEndian(value: number, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);

  for (let i = 0; i < byteLength; i++) {
    bytes[i] = (value >> (i * 8)) & 0xFF;
  }

  return bytes;
}

// 封装数据包
export function buildPackage(payload: Uint8Array): Uint8Array {
  const size = 2 + payload.length + 2
  let buf = new Uint8Array(size)
  let sizeBytes = toLittleEndian(size, 2)
  buf.set(sizeBytes, 0)
  buf.set(payload, 2)
  // CRC16
  let crc = toLittleEndian(modbusCRC16(buf.slice(0, size - 2)), 2)
  buf.set(crc, size - 2)
  return buf
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message = '操作超时'): Promise<T> {
  return Promise.race([
    promise,
    timeout(ms, message)
  ]);
}

/**
 * 将数据包格式化为可读的表格形式
 * @param {Uint8Array} buf - 要格式化的数据包
 */
export function formatPackage(buf: Uint8Array): void {
  if (!buf || !buf.length) return;
  
  const size = buf.length;
  if (size < 5) return;

  const header = buf.slice(0, 2);
  const command = buf.slice(2, 3);
  const payload = buf.slice(3, size - 2);
  const crc = buf.slice(size - 2);

  const bytesToHex = (bytes: Uint8Array): string => {
    if (bytes.length <= 128) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }

    const start = Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const end = Array.from(bytes.slice(-64)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    return `${start} ... ${end}`;
  };

  console.log(`数据包总大小: ${size} 字节`);
  console.table([
    { 
      section: 'Package Size', 
      hexValue: bytesToHex(header), 
      decValue: header[0] | (header[1] << 8),
    },
    {
      section: 'Command', 
      hexValue: bytesToHex(command),
      decValue: command[0],
    },
    { 
      section: 'Payload', 
      hexValue: bytesToHex(payload), 
      decValue: '',
    },
    { 
      section: 'CRC', 
      hexValue: bytesToHex(crc), 
      decValue: (crc[0] | (crc[1] << 8)),
    }
  ]);
}

export async function sendPackage(writer: WritableStreamDefaultWriter<Uint8Array>, payload: Uint8Array, timeoutMs = 3000): Promise<boolean> {
  const buf = buildPackage(payload);
  formatPackage(buf)
  
  await withTimeout(
    writer.write(buf),
    timeoutMs,
    `发送数据包超时 (${timeoutMs}ms)`
  );
  return true;
}

export async function getPackage(reader: ReadableStreamDefaultReader<Uint8Array>, length: number = 64, timeoutMs = 3000): Promise<{ data: Uint8Array }> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  
  const readTimeout = withTimeout(
    (async () => {
      while (totalLength < length) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          chunks.push(value);
          totalLength += value.length;
        }
      }
    })(),
    timeoutMs,
    `接收数据包超时 (${timeoutMs}ms)`
  );
  
  await readTimeout;
  
  // 合并所有数据块
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return { data: result.slice(0, length) };
}

export async function getResult(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs = 3000): Promise<boolean> {
  const result = await getPackage(reader, 1, timeoutMs);
  return result.data?.length > 0 && result.data[0] === 0xaa;
}

  export function getFlashId(id: number[]) : string | null {
    const flashTypes = [
      { pattern: [0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: "S29GL256" },
      { pattern: [0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22], name: "JS28F256" },
      { pattern: [0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22], name: "S29GL01GS" }
    ];

    for (const flashType of flashTypes) {
      if (arraysEqual(id, flashType.pattern)) {
        return flashType.name;
      }
    }

    return null;
  }

  export function arraysEqual(a: number[], b: number[]) : boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
  }
