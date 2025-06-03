
/**
 * 计算Modbus CRC16校验和
 * @param bytes - 要计算CRC的字节数组
 * @description 计算Modbus CRC16校验和
 * @returns - 计算得到的CRC16值
 */
export function modbusCRC16(bytes: Uint8Array): number {
  let crc = 0xFFFF;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      const temp = crc & 1;
      crc >>= 1;
      if (temp) crc ^= 0xA001;
      crc &= 0xFFFF;
    }
  }
  return crc;
}

const CRC_TABLE = new Uint16Array(256);
(function initCRCTable() {
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xA001;
      } else {
        crc >>>= 1;
      }
    }
    CRC_TABLE[i] = crc;
  }
})();

/**
 * 计算Modbus CRC16校验和
 * @param bytes - 要计算CRC的字节数组
 * @description 使用预计算的查找表计算Modbus CRC16
 * @returns - 计算得到的CRC16值
 */
export function modbusCRC16_lut(bytes: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++) {
    const tableIndex = (crc ^ bytes[i]) & 0xFF;
    crc = (crc >>> 8) ^ CRC_TABLE[tableIndex];
  }
  return crc;
}