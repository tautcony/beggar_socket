const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取平台信息
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 请求串口权限
  requestSerialPort: () => ipcRenderer.invoke('request-serial-port'),
  
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
