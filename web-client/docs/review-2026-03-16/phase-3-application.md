# Phase 3 审查报告：应用/功能层 (features/burner)

> 审查时间：2026-03-16
> 审查文件数：15
> 发现问题数：P0(2) / P1(6) / P2(4) / INFO(3)

## 已审查文件

1. web-client/src/features/burner/application/burner-session.ts
2. web-client/src/features/burner/application/burner-use-case.ts
3. web-client/src/features/burner/application/connection-use-case.ts
4. web-client/src/features/burner/application/factory.ts
5. web-client/src/features/burner/application/flow-template.ts
6. web-client/src/features/burner/application/types.ts
7. web-client/src/features/burner/application/index.ts
8. web-client/src/features/burner/application/domain/connection.ts
9. web-client/src/features/burner/application/domain/error-mapping.ts
10. web-client/src/features/burner/application/domain/ports.ts
11. web-client/src/features/burner/application/domain/result.ts
12. web-client/src/features/burner/adapters/cartridge-protocol-port.ts
13. web-client/src/features/burner/adapters/connection-orchestration-factory.ts
14. web-client/src/features/burner/adapters/device-gateway-connection-port.ts
15. web-client/src/features/burner/adapters/index.ts

## 问题清单

### 🔴 P0 — [C7] Promise.race() 竞态条件导致悬挂操作

**文件**：`web-client/src/features/burner/application/burner-session.ts` — `runWithTimeout()`

**问题**：当 timeoutPromise 胜出时，`operation()` Promise 仍在后台执行并继续修改共享状态 (`this.state`)。没有机制中止 operation() 的执行。

**影响**：超时后的操作继续修改会话状态，与新操作竞争。

**修复建议**：传递 AbortSignal 给 operation，确保超时时可以中止操作。

---

### 🔴 P0 — [C5] AbortController 覆盖导致状态泄漏

**文件**：`web-client/src/features/burner/application/burner-session.ts` — `startOperation()`

**问题**：`startOperation()` 在任何时候都设置 `busy = true` 并强制 abort 之前的操作。若在 finally 块执行期间调用，会导致双重清理和旧 promise 泄漏。

**影响**：状态不一致，可能导致操作不可恢复。

**修复建议**：检查 `busy` 标志，若已 busy 则拒绝新操作或抛出异常。

---

### 🟡 P1 — [C7] 多卡扫描操作无法中止

**文件**：`web-client/src/features/burner/application/burner-use-case.ts` — `readGBAMultiCartRoms()`, `readMBC5MultiCartRoms()`

**问题**：循环中执行 I/O 操作但不接受 signal 参数，无法响应用户取消。

**修复建议**：添加 AbortSignal 参数，在每次迭代检查 `signal?.throwIfAborted()`。

---

### 🟡 P1 — [C8] AbortSignal 参数设计不一致

**文件**：`web-client/src/features/burner/application/domain/ports.ts` — `BurnerProtocolPort`

**问题**：`verifyRom()` 的 signal 是必需的，`writeRam/readRam/verifyRam` 无 signal，其他方法是可选的。设计不一致导致调用方难以推理。

**修复建议**：统一所有操作方法的 signal 为 `signal?: AbortSignal`。

---

### 🟡 P1 — [C8] 不安全的类型转换（as DeviceHandle）

**文件**：`web-client/src/features/burner/adapters/device-gateway-connection-port.ts` — `unwrapHandle()`, `unwrapSelection()`

**问题**：`handle.context as DeviceHandle` 无运行时验证，若业务逻辑错误创建 handle，会导致难以诊断的故障。

**修复建议**：添加运行时类型守卫检查。

---

### 🟡 P1 — [C1/C5] 连接状态并发修改

**文件**：`web-client/src/features/burner/application/connection-use-case.ts` — `prepareConnection()` vs `disconnect()`

**问题**：`isConnecting` 只保护连接流程，`disconnect()` 无并发检查，可与 `prepareConnection()` 竞争修改 `snapshotState`。

**修复建议**：使用统一的互斥机制保护所有状态修改操作。

---

### 🟡 P1 — [C2] 错误代码推断依赖脆弱的字符串匹配

**文件**：`web-client/src/features/burner/application/domain/error-mapping.ts` — `inferErrorCode()`

**问题**：通过 `message.includes('timeout')` 等字符串匹配推断错误类型，消息文本会随 i18n/文案调整而变化。

**修复建议**：使用自定义错误类（如 `TimeoutError`, `NotConnectedError`）替代字符串匹配。

---

### 🟡 P1 — [C8] verifyRom 运行时类型检查应在编译时强制

**文件**：`web-client/src/features/burner/application/burner-use-case.ts` — `verifyRom()`

**问题**：`BurnerOperationContext` 定义 `signal?: AbortSignal`（可选），但 verifyRom 运行时检查 `!context.signal` 并抛出。

**修复建议**：定义 `VerifyRomContext` 接口，将 signal 设为必需。

---

### 🟢 P2 — [C2] onSuccess/onError 回调中的异常无处捕获

**文件**：`web-client/src/features/burner/application/flow-template.ts` — `runBurnerFlow()`

**问题**：`onSuccess` 和 `onError` 回调若抛出异常，不会被 flow-template 捕获。

**修复建议**：用 try/catch 包裹回调执行。

---

### 🟢 P2 — [C5] 状态重置不完整 — 旧进度信息泄漏到新操作

**文件**：`web-client/src/features/burner/application/burner-session.ts` — `completeOperation()`

**问题**：`completeOperation()` 不重置 progress 和 logs，下一个操作可能显示旧的进度和日志。

**修复建议**：在 `completeOperation()` 中自动重置 progress 和 logs。

---

### 🟢 P2 — [C11] 日志缓冲区溢出无通知

**文件**：`web-client/src/features/burner/application/burner-session.ts` — `appendLog()`

**问题**：日志超过 500 条时静默丢弃最旧日志，用户无法察觉。

**修复建议**：首次溢出时插入警告日志。

---

### 🟢 P2 — [C8] 复杂的状态转换模式重复代码

**文件**：`web-client/src/features/burner/application/connection-use-case.ts`

**问题**：`markFailure() + toFailure()` 模式重复 5+ 次，容易引入遗漏。

**修复建议**：提取统一的失败处理方法。

---

### ℹ️ INFO — factory.ts 中的依赖注入可配置化

建议允许注入 `protocolPort` 用于测试。

---

### ℹ️ INFO — BurnerSession 可配置日志缓冲区大小

建议将 `MAX_LOGS = 500` 参数化。

---

### ℹ️ INFO — ensureSessionActive 的逻辑可改进

`session.isActive && !session.isActive()` 看起来可读性较差，建议简化。

---

## 未覆盖区域

无
