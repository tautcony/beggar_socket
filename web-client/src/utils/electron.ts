/**
 * Electron 环境检测和工具函数
 */

/**
 * 检查是否在 Electron 环境中运行
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && (window.electronAPI?.isElectron ?? false);
}

/**
 * 检查是否在开发模式下运行
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * 获取平台信息
 */
export function getPlatform(): Promise<string> {
  if (isElectron()) {
    return window.electronAPI.getPlatform();
  }
  return Promise.resolve('Web');
}

/**
 * 获取应用版本
 */
export function getAppVersion(): Promise<string> {
  if (isElectron()) {
    return window.electronAPI.getAppVersion();
  }
  return Promise.resolve('Web Version');
}

/**
 * 请求串口权限（Electron 环境）
 */
export async function requestSerialPort(): Promise<{ granted: boolean }> {
  if (isElectron()) {
    return await window.electronAPI.requestSerialPort();
  }
  // Web 环境下使用 Web Serial API
  try {
    if ('serial' in navigator) {
      const nav = navigator as Navigator & { serial: { requestPort: () => Promise<void> } };
      await nav.serial.requestPort();
      return { granted: true };
    }
    throw new Error('Web Serial API not supported');
  } catch (error) {
    console.warn('Serial port request failed:', error);
    return { granted: false };
  }
}

/**
 * 获取运行时版本信息
 */
export function getVersions() {
  if (isElectron()) {
    return window.electronAPI.versions;
  }
  return {
    userAgent: navigator.userAgent,
    platform: 'Web',
  };
}
