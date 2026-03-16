# Phase 8 审查报告：electron — 运行时

> 审查时间：2026-03-16  
> 审查文件数：6 + 辅助文件  
> 发现问题数：P0(2) / P1(4) / P2(4) / INFO(4)

## 已审查文件

- `electron/main.js`
- `electron/preload.js`
- `electron/ipc-handlers.js`
- `electron/security-utils.js`
- `electron/package.json`
- `electron/entitlements.mac.plist`
- `build/entitlements.mac.plist`（对比检查）
- `index.html`（CSP 检查）
- `src/types/electron.d.ts`（类型对照）

## 问题清单

### 🔴 P0 — [C10] 未配置 Content-Security-Policy

**文件**：`electron/main.js` — `createWindow()`

**现象**：未通过以下任何方式设置 CSP：
- `session.webRequest.onHeadersReceived()` 在主进程中
- `<meta>` 标签在 `index.html` 中
- `webPreferences` 配置

**影响**：如果存在任何 XSS 向量（如畸形 ROM 名称渲染、被入侵的依赖），攻击者可执行任意脚本、加载外部资源、窃取数据。这是最关键的 Electron 安全缺口。

**修复建议**：通过 `session.defaultSession.webRequest.onHeadersReceived()` 设置 CSP：
```javascript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:;"
      ],
    },
  });
});
```
如需 Sentry 上报则调整 `connect-src`。

---

### 🔴 P0 — [C1] macOS 重新打开窗口后 IPC handlers 引用旧的已销毁 mainWindow

**文件**：`electron/main.js` — `createWindow()` + `electron/ipc-handlers.js` — `setupIpcHandlers()`

**现象**：`setupIpcHandlers(mainWindow)` 使用 `ipcHandlersRegistered` 守卫。macOS 上用户关闭窗口后通过 dock 图标重新打开时：
1. `window-all-closed` → `cleanupSerialPorts()`，但 app 不退出
2. `activate` → `createWindow()` → 新 BrowserWindow
3. `setupIpcHandlers(newMainWindow)` 立即返回（守卫为 `true`）
4. 所有 IPC handlers 仍闭包引用**旧的已销毁** `mainWindow`
5. `serial-data` 事件检查 `mainWindow.isDestroyed()` → **所有数据传递静默失败**

**影响**：在 macOS 上关闭再重新打开窗口后，串口通信完全中断。用户看到正常 UI 但收不到任何串口数据。

**修复建议**：将 mainWindow 引用存储在可变变量中供 handlers 访问，或在窗口关闭时重置 `ipcHandlersRegistered = false` 并对新窗口重新注册：
```javascript
let currentWindow = null;
function updateMainWindow(win) { currentWindow = win; }
// 在所有 handler 中使用 currentWindow 而非闭包捕获的 mainWindow
```

---

### 🟡 P1 — [C10] 开发模式下 `webSecurity` 被禁用

**文件**：`electron/main.js` — `createWindow()`

**现象**：`webSecurity: isDev ? false : true`

**问题**：开发模式下禁用同源策略，屏蔽 CORS 限制。生产环境中出现的 CORS 问题在开发时不会暴露。被入侵的 dev server 可利用此漏洞。

**影响**：开发时无法发现 CORS 相关 bug；安全性降低。

**修复建议**：始终保持 `webSecurity: true`。如需跨域请求，使用 Vite dev server 代理。

---

### 🟡 P1 — [C10] 生产构建中 DevTools 可访问

**文件**：`electron/main.js` — `createMenu()`

**现象**：View 菜单始终包含 `{ role: 'toggleDevTools' }`，不区分 `isDev`。

**影响**：生产用户可打开 DevTools 检查/修改渲染进程、访问 `window.electronAPI`、直接调用 IPC。增加攻击面。

**修复建议**：
```javascript
submenu: [
  { role: 'reload' },
  { role: 'forceReload' },
  ...(isDev ? [{ role: 'toggleDevTools' }] : []),
]
```

---

### 🟡 P1 — [C2] `serial-write` 在数据已 flush 时静默吞掉写入错误

**文件**：`electron/ipc-handlers.js` — `serial-write` handler

**现象**：
```javascript
const flushed = port.write(buffer, (error) => {
  if (error) reject(error);
});
if (flushed) {
  resolve(true);  // 立即 resolve
}
```

当 `port.write()` 返回 `true`（数据已 flush）时，Promise 立即 resolve。如果写入回调之后带错误触发，`reject()` 作用于已 resolve 的 Promise，错误被静默忽略。

**影响**：已 flush 端口的写入错误丢失。调用者认为写入成功但实际可能失败。对烧录器这意味着可能写入损坏的 flash 数据。

**修复建议**：只在写入回调中 resolve：
```javascript
return new Promise((resolve, reject) => {
  port.write(buffer, (error) => {
    if (error) return reject(error);
    port.drain((drainErr) => {
      if (drainErr) return reject(drainErr);
      resolve(true);
    });
  });
});
```

---

### 🟡 P1 — [C8] IPC handlers 不验证渲染进程输入

**文件**：`electron/ipc-handlers.js` — `serial-open`, `serial-write`, `serial-set-signals`

**现象**：
- `serial-open`：`portPath` 直接传给 `new SerialPort({ path: portPath })`，无验证。Linux 上可打开任意 `/dev/*` 路径
- `serial-write`：`data` 传给 `Buffer.from(data)` 无类型检查
- `serial-set-signals`：`signals` 对象未校验

**影响**：被入侵的渲染进程（XSS）可打开任意设备路径或发送畸形数据。

**修复建议**：在每个 handler 入口添加验证：
```javascript
if (typeof portPath !== 'string' || !portPath.match(/^\/(dev\/|COM\d+$)/)) {
  throw new Error('Invalid port path');
}
```

---

### 🟢 P2 — [C6] macOS 菜单 `template[4]` 索引越界

**文件**：`electron/main.js` — `createMenu()`

**现象**：`template.unshift(...)` 后数组有 4 个元素（索引 0-3），代码访问 `template[4].submenu` 为 `undefined`，导致 TypeError。

**影响**：macOS 上菜单创建崩溃。

**修复建议**：改为 `template[3].submenu = [...]`。

---

### 🟢 P2 — [C10] `build/entitlements.mac.plist` 包含危险的未使用权限

**文件**：`build/entitlements.mac.plist`

**现象**：包含 `com.apple.security.cs.debugger` 和 `com.apple.security.cs.disable-executable-page-protection`。该文件未被 electron-builder 配置引用（使用的是 `electron/entitlements.mac.plist`），但存在于 `buildResources` 目录。

**影响**：如果有人修改配置引用此文件，app 将获得调试器附加和可执行页面保护绕过权限。

**修复建议**：删除此文件或去除危险权限。

---

### 🟢 P2 — [C11] Preload `onData`/`onError`/`onClose` 可累积监听器

**文件**：`electron/preload.js`

**现象**：每次调用 `onData(callback)` 都通过 `ipcRenderer.on()` **添加**监听器。多次调用会累积重复监听。

**影响**：内存泄漏和重复回调调用。当前 `ElectronDeviceGateway` 通过 `listenersBound` 守卫缓解，但原始 preload API 存在泄漏风险。

**修复建议**：在添加前先移除旧监听：
```javascript
onData: (callback) => {
  ipcRenderer.removeAllListeners('serial-data');
  ipcRenderer.on('serial-data', (event, portId, data) => { ... });
},
```

---

### 🟢 P2 — [C2] `serial-close` 回调忽略 error 参数

**文件**：`electron/ipc-handlers.js` — `serial-close` handler

**现象**：
```javascript
port.close(() => {
  activeSerialPorts.delete(portId);
  resolve(true);
});
```

`SerialPort.close()` 回调的 `error` 参数被忽略。

**影响**：端口关闭失败时（如已被 OS 关闭），Promise 仍 resolve 为 `true`，端口引用被错误移除。

**修复建议**：
```javascript
port.close((error) => {
  activeSerialPorts.delete(portId);
  if (error) reject(error);
  else resolve(true);
});
```

---

### ℹ️ INFO — [C10] Buffer 通过 contextBridge 暴露给渲染进程

**文件**：`electron/preload.js`

`contextBridge.exposeInMainWorld('Buffer', Buffer)` 暴露了 Node.js Buffer API。虽然 Buffer 本身不危险，但增加了 XSS 攻击者可用的 API 面。Web 客户端已使用 `buffer` npm 包（polyfill），可考虑是否仍需此暴露。

---

### ℹ️ INFO — [C10] Preload 删除 `window.require/exports/module`

**文件**：`electron/preload.js`

`delete window.require; delete window.exports; delete window.module;` 是良好的安全实践。不过在 `contextIsolation: true` 下，这些属性不会存在于渲染上下文中，属于无害的防御性代码。

---

### ℹ️ INFO — [C6] `electron/package.json` 无依赖项

仅包含 `name`、`version`、`main`、`type: "commonjs"`。`serialport` 依赖由根 `package.json` 管理。对当前构建可行但值得在文档中说明。

---

### ℹ️ INFO — [C4] `request-serial-port` 始终返回 `granted: true`

对 Electron 来说正确（无需 WebSerial 权限提示），但渲染端类型定义包含 `selectedPort?` 字段而实际从未填充，存在轻微类型不匹配。

---

## Electron 安全检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `nodeIntegration: false` | ✅ PASS | 显式设为 `false` |
| `contextIsolation: true` | ✅ PASS | 显式设为 `true` |
| `webSecurity` 启用 | ⚠️ PARTIAL | 生产环境安全；开发模式禁用 |
| CSP 配置 | ❌ FAIL | 无任何 CSP 配置 |
| 无 remote module | ✅ PASS | `enableRemoteModule: false` 显式设置 |
| Preload 使用 contextBridge | ✅ PASS | 所有 API 通过 `contextBridge.exposeInMainWorld()` 暴露 |
| IPC 输入验证 | ❌ FAIL | portPath、data buffer、signals 均未验证 |
| 无不安全 shell/exec | ✅ PASS | 无 `child_process`；`shell.openExternal()` 受 `isSafeExternalUrl()` 保护 |
| 串口权限 | ✅ PASS | 串口访问通过 IPC 中介，渲染进程无直接访问 |

## 未覆盖区域

无
