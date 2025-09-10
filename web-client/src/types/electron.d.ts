// Electron API 类型定义
declare global {
  interface Window {
    electronAPI: {
      // 获取平台信息
      getPlatform: () => Promise<string>;

      // 获取应用版本
      getAppVersion: () => Promise<string>;

      // 请求串口权限/选择串口
      requestSerialPort: () => Promise<{ granted: boolean; selectedPort?: SerialPortInfo }>;

      // 选择串口（显示选择对话框）
      selectSerialPort: () => Promise<SerialPortInfo | { needsSelection: true; ports: SerialPortInfo[] } | null>;

      // 原生串口 API
      serial: {
        // 列出可用串口
        listPorts: () => Promise<SerialPortInfo[]>;

        // 打开串口
        open: (portPath: string, options?: {
          baudRate?: number;
          dataBits?: 5 | 6 | 7 | 8;
          stopBits?: 1 | 2;
          parity?: 'none' | 'even' | 'odd';
          rtscts?: boolean;
          xon?: boolean;
          xoff?: boolean;
          xany?: boolean;
        }) => Promise<string>;

        // 写入数据
        write: (portId: string, data: number[] | Uint8Array) => Promise<boolean>;

        // 关闭串口
        close: (portId: string) => Promise<boolean>;

        // 检查串口是否打开
        isOpen: (portId: string) => Promise<boolean>;

        // 设置串口信号
        setSignals: (portId: string, signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) => Promise<boolean>;

        // 监听串口数据
        onData: (callback: (portId: string, data: Uint8Array) => void) => void;

        // 监听串口错误
        onError: (callback: (portId: string, error: string) => void) => void;

        // 监听串口关闭
        onClose: (callback: (portId: string) => void) => void;

        // 移除所有监听器
        removeAllListeners: () => void;
      };

      // 检查是否在 Electron 环境中
      isElectron: boolean;

      // 版本信息
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
    };
  }
}

// 串口相关类型定义
interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

interface SerialPortOptions {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
  xany?: boolean;
}

export {};
