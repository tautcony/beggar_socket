/**
 * Web Serial API 类型定义
 */
declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPort>;
      getPorts: () => Promise<SerialPort[]>;
    };
  }
}

interface SerialPort {
  open: (options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
  }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  getInfo: () => {
    usbProductId?: number;
    usbVendorId?: number;
  };
}

export {};
