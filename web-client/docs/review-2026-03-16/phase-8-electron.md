# Phase 8 审查报告：Electron 运行时层

> 审查时间：2026-03-16
> 审查文件数：5
> 发现问题数：P0(0) / P1(3) / P2(4) / INFO(0)

## 已审查文件

1. web-client/electron/main.js
2. web-client/electron/preload.js
3. web-client/electron/ipc-handlers.js
4. web-client/electron/security-utils.js
5. web-client/electron/package.json

## 问题清单

### 🟡 P1 — [C10] CSP 配置不够严格

**文件**：`web-client/electron/main.js`

**问题**：`style-src 'unsafe-inline'` 允许内联 CSS，削弱 XSS 防护。`img-src data: blob:` 和 `font-src data:` 扩大攻击面。

**修复建议**：移除 `'unsafe-inline'`，改用外部样式表；限制 `img-src` 和 `font-src`。

---

### 🟡 P1 — [C10] Buffer 对象暴露增加攻击面

**文件**：`web-client/electron/preload.js`

**问题**：`contextBridge.exposeInMainWorld('Buffer', Buffer)` 将 Node.js Buffer 暴露到渲染进程全局作用域，可能被恶意脚本利用。

**修复建议**：移除全局 Buffer 暴露，通过 IPC 按需请求缓冲区操作。

---

### 🟡 P1 — [C10] 开发模式禁用 webSecurity

**文件**：`web-client/electron/main.js`

**问题**：`webSecurity: isDev ? false : true` 在开发模式完全禁用 CORS 检查。若 `isDev` 误判，生产包继承不安全配置。

**修复建议**：始终启用 `webSecurity: true`，通过代理解决开发时跨域。

---

### 🟢 P2 — [C4] 串口路径验证不完善

**文件**：`web-client/electron/ipc-handlers.js`

**问题**：路径正则 `/^\/dev\/[\w.-]+$|^COM\d+$|\.\d+$/` 不匹配所有 macOS/Linux 串口路径格式。

**修复建议**：扩展正则或验证路径是否在 `SerialPort.list()` 返回的列表中。

---

### 🟢 P2 — [C10] 进程版本信息泄露

**文件**：`web-client/electron/preload.js`

**问题**：暴露 `process.versions.node/chrome/electron` 精确版本号，便于攻击者识别已知漏洞。

**修复建议**：仅暴露必要的版本信息。

---

### 🟢 P2 — [C2] IPC handlers 缺乏超时保护

**文件**：`web-client/electron/ipc-handlers.js`

**问题**：`serial-open`, `serial-write` 等操作无超时设置，硬件无响应时 Promise 永远 pending。

**修复建议**：添加 `withTimeout` 包装。

---

### 🟢 P2 — [C10] security-utils.js 硬编码 localhost:5173

**文件**：`web-client/electron/security-utils.js`

**问题**：开发模式 URL 验证硬编码 `http://localhost:5173`，端口变更时失效。

---

## 未覆盖区域

- Electron 自动更新机制（未发现实现）
- 原生菜单配置的安全性
