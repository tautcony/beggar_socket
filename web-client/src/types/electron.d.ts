// Electron API 类型定义
declare global {
  interface Window {
    electronAPI: {
      // 获取平台信息
      getPlatform: () => Promise<string>;

      // 获取应用版本
      getAppVersion: () => Promise<string>;

      // 请求串口权限
      requestSerialPort: () => Promise<{ granted: boolean }>;

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

export {};
