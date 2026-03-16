# 代码审查修复记录

> 修复完成时间：2026-03-16  
> 依据：[summary.md](./summary.md) 建议优先修复顺序（问题 1～7）  
> 构建验证：✅ `vue-tsc && vite build` 通过  
> 测试验证：✅ 312 tests / 29 test files 全部通过

---

## 修复 1 — P0: Electron CSP + stale mainWindow

**文件**：`electron/main.js`、`electron/ipc-handlers.js`

### 问题
- `main.js` 未设置 Content-Security-Policy，XSS 攻击面完全暴露
- macOS 关闭再重开窗口后，IPC handlers 通过闭包持有已销毁的旧 `mainWindow`，串口数据推送静默失败
- `template[4]` 索引越界（macOS `unshift` 后数组只有 4 个元素）
- 生产环境 DevTools 菜单项对用户可见

### 修复方案

**ipc-handlers.js**：
- 新增模块级 `let currentMainWindow = null` 变量，取代闭包捕获的 `mainWindow`
- 新增 `updateMainWindow(win)` 函数（已导出），供 `main.js` 在创建/销毁窗口时更新引用
- `setupIpcHandlers` 仍保留 `ipcHandlersRegistered` 守卫防止重复注册，但每次调用都会更新 `currentMainWindow`
- 所有 `mainWindow` 引用替换为 `currentMainWindow`

**main.js**：
- 导入 `updateMainWindow`
- `mainWindow.on('closed')` 中调用 `updateMainWindow(null)` 清除引用
- `app.whenReady()` 中通过 `session.defaultSession.webRequest.onHeadersReceived()` 配置 CSP：
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:;
  ```
- DevTools 菜单项改为仅在 `isDev` 时展示
- `template[4]` 修正为 `template[3]`

---

## 修复 2 — P0: romBuilder buffer 溢出

**文件**：`src/services/lk/romBuilder.ts`

### 问题
`addRomData()` 中 `compilation.set(rom, offset)` 无越界检查；
`prepareCompilation()` 对无效 `cartridge_type` 无边界校验，直接触发 TypeError。

### 修复方案
- `prepareCompilation()` 入口添加 `cartridge_type` 范围校验：
  ```typescript
  if (cartridge_type < 0 || cartridge_type >= cartridgeTypes.length || !cartridgeTypes[cartridge_type]) {
    throw new Error(`Invalid cartridge type: ${cartridge_type}`);
  }
  ```
- `addRomData()` 中 `compilation.set()` 前计算 `writeOffset` 并校验：
  ```typescript
  const writeOffset = i * sector_size;
  if (writeOffset + rom.length > compilation.length) {
    throw new Error(`ROM "${game.file}" exceeds flash size (...)`);
  }
  compilation.set(rom, writeOffset);
  ```

---

## 修复 3 — P0: PayloadBuilder CRC 占位字节

**文件**：`src/protocol/beggar_socket/payload-builder.ts`

### 问题
`build(withCrc = false)` 默认不计算 CRC，但仍在包尾附加 2 个零字节占位，并把它们计入 `cmdSize`。  
如果固件未来启用 CRC 校验，零值 CRC 将无法通过，导致所有命令被拒绝。

### 修复方案
将默认值从 `withCrc = false` 改为 `withCrc = true`，所有包均发送有效 CRC，为固件启用 CRC 校验做好兼容准备：
```typescript
// 注释更新，明确 CRC 默认启用
build(withCrc = true): Uint8Array {
```

---

## 修复 4 — P1: Electron serial-write 错误吞没

**文件**：`electron/ipc-handlers.js`

### 问题
`port.write()` 返回 `true`（数据已 flush）时立即 `resolve(true)`；若写入回调此后携带错误到来，`reject()` 作用于已 settled 的 Promise，错误被静默丢弃。

### 修复方案
仅在写入回调中 resolve，并链式调用 `port.drain()` 确认数据已传输完成：
```javascript
port.write(buffer, (writeError) => {
  if (writeError) return reject(writeError);
  port.drain((drainError) => {
    if (drainError) return reject(drainError);
    resolve(true);
  });
});
```

---

## 修复 5 — P1: 并发保护

**文件**：`src/features/burner/application/connection-use-case.ts`、`src/services/device-connection-manager.ts`

### 问题
`ConnectionOrchestrationUseCase.prepareConnection()` 和 `DeviceConnectionManager.requestDevice()` 均无并发控制，快速双击连接按钮可导致端口泄漏和状态不一致。

### 修复方案

**connection-use-case.ts**：
- 添加私有字段 `isConnecting = false`
- `prepareConnection()` 和 `prepareConnectionWithSelection()` 在进入时检查并设置标志，`finally` 中重置
- 将原逻辑拆分到私有方法 `_prepareConnection()` 中

**device-connection-manager.ts**：
- 添加私有字段 `isConnecting = false`
- `requestDevice()` 在进入时检查标志（调试模式除外），`finally` 中重置
- 将原逻辑拆分到私有方法 `_requestDevice()` 中

---

## 修复 6 — P1: Flash mode reset on ID failure

**文件**：`src/protocol/beggar_socket/protocol.ts`

### 问题
`rom_get_id()` 和 `gbc_rom_get_id()` 中，若中间步骤（读取 ID）失败抛出异常，退出 Autoselect 模式的 `0xf0` reset 命令将永远不会发送，Flash 芯片停留在异常状态，后续读取返回错误数据。

### 修复方案
将 ID 读取步骤包入 `try` 块，reset 命令移至 `finally`，且 `catch(() => {})` 避免 reset 失败掩盖原始错误：
```typescript
try {
  const idPart1 = await rom_read(input, 4, 0x00);
  const idPart2 = await rom_read(input, 4, 0x1c);
  // ...
  return id;
} finally {
  await rom_write(input, toLittleEndian(0xf0, 2), 0x00).catch(() => {});
}
```
`gbc_rom_get_id()` 同理，使用 `gbc_write` 发送 reset。

---

## 修复 7 — P1: IPC 输入验证

**文件**：`electron/ipc-handlers.js`

### 问题
`serial-open`、`serial-write`、`serial-set-signals` 对渲染进程传入的参数无验证，被入侵的渲染进程（XSS）可打开任意设备路径或发送畸形数据。

### 修复方案

**serial-open**：校验 `portPath` 为非空字符串且匹配合法设备路径格式（`/dev/...`、`COM\d+` 等）

**serial-write**：校验 `data` 类型为 string/Array/ArrayBuffer/TypedArray

**serial-set-signals**：
- 校验 `signals` 为纯对象（非数组）
- 白名单校验 key（`dataTerminalReady`, `requestToSend`, `break`）
- 校验所有 value 为 boolean

---

## 变更摘要

| # | 优先级 | 文件 | 修复类型 |
|---|--------|------|---------|
| 1 | P0 | `electron/main.js` | CSP 配置 + stale mainWindow + template 索引 + DevTools 权限 |
| 1 | P0 | `electron/ipc-handlers.js` | currentMainWindow 模块变量 + updateMainWindow 导出 |
| 2 | P0 | `src/services/lk/romBuilder.ts` | 数组越界校验 + cartridge_type 验证 |
| 3 | P0 | `src/protocol/beggar_socket/payload-builder.ts` | CRC 默认启用 |
| 4 | P1 | `electron/ipc-handlers.js` | serial-write 错误传播修复 |
| 5 | P1 | `src/features/burner/application/connection-use-case.ts` | 并发保护 |
| 5 | P1 | `src/services/device-connection-manager.ts` | 并发保护 |
| 6 | P1 | `src/protocol/beggar_socket/protocol.ts` | rom_get_id / gbc_rom_get_id finally 块 |
| 7 | P1 | `electron/ipc-handlers.js` | serial-open/write/set-signals 输入验证 |
