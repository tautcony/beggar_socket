// 导入串口连接类型
import { SerialConnection } from '@/services/serial-service';

export interface DeviceInfo {
  port: SerialPort | null;
  connection?: SerialConnection | null; // 新增：统一的串口连接对象
}

// Reader types for utility functions
export type BYOBReader = ReadableStreamBYOBReader;
export type DefaultReader = ReadableStreamDefaultReader<Uint8Array>;
