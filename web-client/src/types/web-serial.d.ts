/**
 * Web Serial API 类型定义
 */
declare global {
  type ParityType = 'none' | 'even' | 'odd';
  type FlowControlType = 'none' | 'hardware';

  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: ParityType;
    bufferSize?: number;
    flowControl?: FlowControlType;
  }

  interface SerialOutputSignals {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
    break?: boolean;
  }

  interface SerialInputSignals {
    dataCarrierDetect: boolean;
    clearToSend: boolean;
    ringIndicator: boolean;
    dataSetReady: boolean;
  }

  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
    bluetoothServiceClassId?: number | string;
  }

  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
    bluetoothServiceClassId?: number | string;
  }

  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
    allowedBluetoothServiceClassIds?: (number | string)[];
  }

  interface SerialPort extends EventTarget {
    readonly connected: boolean;
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;

    open(options: SerialOptions): Promise<void>;
    setSignals(signals: SerialOutputSignals): Promise<void>;
    getSignals(): Promise<SerialInputSignals>;
    getInfo(): SerialPortInfo;
    close(): Promise<void>;
    forget(): Promise<void>;
  }

  interface Navigator {
    serial?: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }

  interface WorkerNavigator {
    serial?: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }
}

export {};
