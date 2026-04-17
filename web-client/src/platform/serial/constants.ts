/**
 * 串口配置共享常量
 */
export const DEFAULT_SERIAL_CONFIG = {
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  bufferSize: 4096,
} as const;
