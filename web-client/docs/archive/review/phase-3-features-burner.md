# Phase 3 审查报告：features/burner — 应用层

> 审查时间：2026-03-16  
> 审查文件数：14  
> 发现问题数：P0(0) / P1(2) / P2(3) / INFO(1)

## 已审查文件

- `src/features/burner/application/domain/ports.ts`
- `src/features/burner/application/domain/result.ts`
- `src/features/burner/application/domain/connection.ts`
- `src/features/burner/application/domain/error-mapping.ts`
- `src/features/burner/application/burner-session.ts`
- `src/features/burner/application/burner-use-case.ts`
- `src/features/burner/application/connection-use-case.ts`
- `src/features/burner/application/flow-template.ts`
- `src/features/burner/application/factory.ts`
- `src/features/burner/application/index.ts`
- `src/features/burner/application/types.ts`
- `src/features/burner/adapters/cartridge-protocol-port.ts`
- `src/features/burner/adapters/connection-orchestration-factory.ts`
- `src/features/burner/adapters/device-gateway-connection-port.ts`
- `src/features/burner/adapters/index.ts`

## 问题清单

### 🟡 P1 — [C5] `BurnerSession.runWithTimeout()` 超时后 timer 未清理，可能导致内存泄漏

**文件**：`src/features/burner/application/burner-session.ts` — `runWithTimeout()`

**现象**：  
```typescript
async runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  this.state.busy = true;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timeout in ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    this.completeOperation();
  }
}
```

**问题**：  
1. `setTimeout` 创建的 timer 在操作正常完成后不会被 `clearTimeout`。如果操作在超时之前完成，timer 仍然会在超时后触发 `reject`，但此时 Promise 已被 settled——这个 rejection 会成为未处理的 rejection（在某些环境中可能触发 `unhandledrejection` 事件）
2. 如果操作超时，`operation()` 返回的 Promise 仍在执行中，但 `completeOperation()` 已将 `busy` 设为 `false`。后续代码可能认为操作已完成并开始新操作，而旧操作仍在后台执行

**影响**：  
timer 泄漏和潜在的 unhandledrejection；超时场景下状态标记不一致。

**修复建议**：  
使用与 `transports.ts` 中相同的 `withTimeout` 模式，确保 timer 在 finally 中被清理。

---

### 🟡 P1 — [C7] `ConnectionOrchestrationUseCase` 无并发保护

**文件**：`src/features/burner/application/connection-use-case.ts`

**现象**：  
```typescript
async prepareConnection(): Promise<ConnectionCommandResult> {
  const listResult = await this.connectionPort.list();
  // ...
  this.setState('selecting');
  const selectResult = await this.connectionPort.select();
  // ...
  return this.connectAndInit(selectResult.data);
}
```

**问题**：  
如果用户快速点击两次"连接"按钮，两次 `prepareConnection()` 调用会并发执行，都修改 `snapshotState`。由于没有锁或互斥机制：
1. 两次调用可能各自创建一个连接，但只有后完成的那个会被记录在 `snapshotState` 中
2. 先完成的连接会成为"孤儿连接"——已建立但未被跟踪，无法被 `disconnect()` 关闭
3. `setState()` 不是原子的，两次调用的状态转换可能交错

**影响**：  
并发连接尝试可能导致端口泄漏和状态不一致。

**修复建议**：  
添加互斥保护（如 `connecting` 状态时拒绝新的连接请求），或使用 `generation` 计数器在操作结束时检查是否过期。

---

### 🟢 P2 — [C2] `error-mapping.ts` 中 `inferErrorCode` 基于字符串匹配，可能误分类

**文件**：`src/features/burner/application/domain/error-mapping.ts` — `inferErrorCode()`

**现象**：  
```typescript
function inferErrorCode(error: unknown): BurnerErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (error.name === 'AbortError') return 'aborted';
    if (error.name === 'PortSelectionRequiredError') return 'selection_required';
    if (message.includes('selection')) return 'selection_required';
    if (message.includes('not connected') || message.includes('not properly initialized')) return 'not_connected';
    if (message.includes('timeout')) return 'timeout';
    return 'runtime_error';
  }
  return 'unknown';
}
```

**问题**：  
字符串匹配缺乏精确性。例如，一个包含 "selection" 的错误消息（如 "Invalid sector selection range"）会被错误分类为 `selection_required`。同理，任何包含 "timeout" 的消息都被归为 `timeout`，即使它可能是提示信息而非实际超时错误。

另外，`mapConnectionStageError` 函数中，`mapDomainError` 先推断一个 code，然后 `codeMap[lifecycleStage]` 又用另一个 code 覆盖它——除了 `select` 阶段保留了 `selection_required`，其他阶段的推断结果被完全忽略。

**影响**：  
错误分类不精确可能导致 UI 显示错误的恢复建议或执行错误的恢复逻辑。

**修复建议**：  
考虑为不同错误类型定义自定义 Error 子类（如 `TimeoutError`、`SelectionRequiredError`），通过 `instanceof` 判断而非字符串匹配。

---

### 🟢 P2 — [C5] `flow-template.ts` 中 abort 后不重置进度

**文件**：`src/features/burner/application/flow-template.ts` — `runBurnerFlow()`

**现象**：  
```typescript
} finally {
  options.session.completeOperation();
  const aborted = signal?.aborted === true;
  if (options.resetProgressOnFinish && !aborted) {
    options.session.resetProgress();
  }
  options.syncState(options.session.snapshot);
  await options.onFinally?.();
}
```

**问题**：  
当操作被取消（abort）时，进度不会被重置（`resetProgressOnFinish && !aborted` 为 false）。这意味着 UI 上可能仍然显示上一次操作的进度数据（如 "擦除中 45%"），直到下一次操作覆盖它。

`completeOperation()` 会将 `busy` 设为 `false` 并清空 `abortController`，但不处理 progress。如果调用方没有在 `onFinally` 中手动重置进度，UI 可能显示过期的进度状态。

**影响**：  
取消操作后 UI 可能显示残留的进度信息。

**修复建议**：  
在 abort 路径上也重置或明确标记进度为 "cancelled" 状态，让 UI 能正确反映操作已取消。

---

### 🟢 P2 — [C8] `BurnerConnectionHandle.context` 使用 `unknown` 类型

**文件**：`src/features/burner/application/domain/ports.ts`

**现象**：  
```typescript
export interface BurnerConnectionHandle {
  id: string;
  platform: 'web' | 'electron';
  portInfo?: { ... };
  context: unknown;  // ← unknown 类型
}
```

在 `device-gateway-connection-port.ts` 中：
```typescript
function unwrapHandle(handle: BurnerConnectionHandle): DeviceHandle {
  return handle.context as DeviceHandle;  // ← as 断言
}
```

**问题**：  
`context` 字段使用 `unknown` 类型，在使用时通过 `as DeviceHandle` 强制转换。这是有意为之的设计（domain 层不应依赖 infrastructure 类型），但在 adapter 层缺少运行时类型验证。如果传入了错误的 `handle`（如不同 adapter 创建的 handle），`unwrapHandle` 会返回一个不兼容的对象。

**影响**：  
类型安全问题。在当前单一 adapter 实现下不会触发，但会在多 adapter 场景下产生难以调试的运行时错误。

**修复建议**：  
考虑使用 branded type 或在 `unwrapHandle` 中添加运行时断言（如检查 `context` 是否包含预期的属性）。

---

### ℹ️ INFO — [C9] factory 正确通过运行时环境选择实现

**文件**：`src/features/burner/adapters/connection-orchestration-factory.ts`、`src/features/burner/application/factory.ts`

**说明**：  
`createConnectionOrchestrationUseCase()` 通过 `getDeviceGateway()` → `isElectron()` 正确选择 Web/Electron 网关实现。`createBurnerFacade()` 通过依赖注入 `translate` 和 `formatHex` 函数，避免了直接导入 i18n 的耦合。设计良好。

---

## 未覆盖区域

无
