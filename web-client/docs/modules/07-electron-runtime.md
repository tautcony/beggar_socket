# 模块：Electron Runtime

## 目录
- `electron/main.js`
- `electron/preload.js`
- `electron/ipc-handlers.js`
- `electron/security-utils.js`

## 职责
- 启动桌面窗口与安全策略。
- 暴露 `electronAPI` 给渲染进程。
- 通过 IPC 管理 `serialport` 的 list/open/write/close/signals。

## 数据桥接
- Renderer -> `window.electronAPI.serial.*` -> IPC Main -> `serialport`。

## 模块设计
- `electron/main.js`: BrowserWindow、安全导航、生命周期
- `electron/preload.js`: `electronAPI` 桥接
- `electron/ipc-handlers.js`: serialport IPC handler（list/open/write/close/signals）
- `electron/security-utils.js`: URL 安全校验
