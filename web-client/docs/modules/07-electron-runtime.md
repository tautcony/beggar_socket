# 模块：Electron Runtime

## 目录

### Electron 主进程
- `electron/main.js`: BrowserWindow、安全导航、生命周期
- `electron/preload.js`: `electronAPI` 桥接（contextBridge 暴露给渲染进程）
- `electron/ipc-handlers.js`: serialport IPC handler（list/open/write/close/signals/read）
- `electron/security-utils.js`: URL 安全校验（防止导航到外部 URL）

### 渲染进程桥接
- `src/types/electron.d.ts`: `window.electronAPI` 的 TypeScript 类型声明（包括 `serial.*`、`getPlatform`、`getAppVersion`、`requestSerialPort` 等）
- `src/platform/serial/electron/device-gateway.ts`: 渲染进程侧 Electron 串口网关（通过 `window.electronAPI.serial.*` 调用 IPC）

## 职责
- 启动桌面窗口与安全策略。
- 暴露 `electronAPI` 给渲染进程（通过 contextBridge）。
- 通过 IPC 管理 `serialport` 的 list/open/write/close/signals。

## 数据桥接
- Renderer → `window.electronAPI.serial.*` → IPC Main → `serialport`（Node.js）

## 模块设计
- `electron/main.js`: BrowserWindow、安全导航、生命周期
- `electron/preload.js`: `electronAPI` 桥接
- `electron/ipc-handlers.js`: serialport IPC handler（list/open/write/close/signals）
- `electron/security-utils.js`: URL 安全校验

## 与平台层的关系
- `src/platform/serial/electron/device-gateway.ts` 通过 `window.electronAPI.serial.*` 调用 IPC，是渲染进程侧的 Electron 串口实现。
- `src/utils/electron.ts` 提供 `isElectron()` 检测，供 `factory.ts` 在运行时选择正确的网关实现。
- `src/types/electron.d.ts` 为 `window.electronAPI` 提供完整的类型定义，确保渲染进程调用类型安全。
