const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取平台信息
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 请求串口权限
  requestSerialPort: () => ipcRenderer.invoke('request-serial-port'),

  // 选择串口
  selectSerialPort: () => ipcRenderer.invoke('select-serial-port'),

  // 原生串口 API
  serial: {
    // 列出可用串口
    listPorts: () => ipcRenderer.invoke('serial-list-ports'),

    // 打开串口
    open: (portPath, options) => ipcRenderer.invoke('serial-open', portPath, options),

    // 写入数据
    write: (portId, data) => ipcRenderer.invoke('serial-write', portId, data),

    // 关闭串口
    close: (portId) => ipcRenderer.invoke('serial-close', portId),

    // 检查串口是否打开
    isOpen: (portId) => ipcRenderer.invoke('serial-is-open', portId),

    // 设置串口信号
    setSignals: (portId, signals) => ipcRenderer.invoke('serial-set-signals', portId, signals),

    // 监听串口数据
    onData: (callback) => {
      ipcRenderer.on('serial-data', (event, portId, data) => {
        callback(portId, new Uint8Array(data));
      });
    },

    // 监听串口错误
    onError: (callback) => {
      ipcRenderer.on('serial-error', (event, portId, error) => {
        callback(portId, error);
      });
    },

    // 监听串口关闭
    onClose: (callback) => {
      ipcRenderer.on('serial-closed', (event, portId) => {
        callback(portId);
      });
    },

    // 移除监听器
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('serial-data');
      ipcRenderer.removeAllListeners('serial-error');
      ipcRenderer.removeAllListeners('serial-closed');
    }
  },

  // 检查是否在 Electron 环境中
  isElectron: true,

  // 节点版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

delete window.require;
delete window.exports;
delete window.module;
