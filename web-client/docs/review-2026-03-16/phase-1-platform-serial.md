# Phase 1 审查报告：平台传输层 (platform/serial)

> 审查时间：2026-03-16
> 审查文件数：7
> 发现问题数：P0(3) / P1(3) / P2(4) / INFO(3)

## 已审查文件
1. web-client/src/platform/serial/index.ts
2. web-client/src/platform/serial/types.ts
3. web-client/src/platform/serial/transports.ts
4. web-client/src/platform/serial/factory.ts
5. web-client/src/platform/serial/compat.ts
6. web-client/src/platform/serial/web/device-gateway.ts
7. web-client/src/platform/serial/electron/device-gateway.ts

## 问题清单

---

### 🔴 P0 — [C1] 并发读取竞态导致数据损坏

**文件**：`web-client/src/platform/serial/transports.ts` — `WebSerialTransport.ensurePumpStarted()`

**现象**：
```typescript
private ensurePumpStarted(): void {
  if (this.pumpPromise) {
    return;
  }
  this.reader = this.port.readable.getReader();
  this.pumpPromise = this.pumpReadable();
}
```

**问题**：若两个 `read()` 调用并发执行，都可能通过 `if (this.pumpPromise)` 检查后各自创建一个 reader 并启动独立的 pump 循环。根据 WebSerial API 规范，多个 reader 竞争同一个 readable stream 会导致未定义行为和数据丢失。

**影响**：读取数据完整性受损，协议解析失败，间歇性通信故障。

**修复建议**：使用互斥标记或 Promise-based lock 确保只有一个 pump 启动。

---

### 🔴 P0 — [C1] ConnectionTransport 并发读取导致监听器冲突与数据丢失

**文件**：`web-client/src/platform/serial/transports.ts` — `ConnectionTransport.read()`

**现象**：
```typescript
async read(length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
  return new Promise((resolve, reject) => {
    function handleData(data: Uint8Array) {
      offset += bytesToCopy;
      if (data.byteLength > bytesToCopy) {
        overflow.push(data.subarray(bytesToCopy));
      }
    }
    connection.onData(handleData);
  });
}
```

**问题**：若两个 `read()` 并发调用，两个 `handleData` 闭包都会被调用，各自修改各自的本地 overflow → 数据竞争。

**影响**：数据被复制、丢失或乱序；某个 read 可能收不到足够字节而超时。

**修复建议**：在 Transport 级别实现读取互斥（Promise chain 串行化）。

---

### 🔴 P0 — [C2] WebSerialTransport 流错误后无法恢复

**文件**：`web-client/src/platform/serial/transports.ts` — `ensurePumpStarted()` + `pumpReadable()`

**现象**：
```typescript
private ensurePumpStarted(): void {
  if (this.pumpPromise) return;
  if (this.streamError !== null) {
    throw this.streamError instanceof Error ? this.streamError : new Error('Serial read pump failed');
  }
  // ...
}

private async pumpReadable(): Promise<void> {
  try { /* ... */ } catch (error) {
    this.streamError = error;
  } finally {
    this.pumpPromise = null;
  }
}
```

**问题**：Pump 异常后 `streamError` 被设置，`pumpPromise` 被清空。下次 `read()` 检查 `streamError !== null` → 直接 throw，永不尝试重启 pump。

**影响**：连接在任何流错误后变为完全不可用，必须重新创建 Transport 实例。暂时性 USB 中断等场景无法自动恢复。

**修复建议**：清空旧错误后允许重新创建 pump，或提供显式的 `resetStream()` 方法。

---

### 🟡 P1 — [C1] ElectronDeviceGateway 监听器可能重复注册

**文件**：`web-client/src/platform/serial/electron/device-gateway.ts` — `setupListeners()`

**问题**：`listenersBound` 是实例变量而非静态变量，若创建多个 gateway 实例（尽管 factory 应防止），每个实例都会向 Electron IPC 注册监听器，导致事件被重复处理。

**影响**：重构时失去 factory 缓存保护即暴露问题。

**修复建议**：将 `listenersBound` 改为 static 变量，或确保单例模式。

---

### 🟡 P1 — [C1] ElectronDeviceGateway 连接泄漏

**文件**：`web-client/src/platform/serial/electron/device-gateway.ts` — `connect()`

**问题**：若 `new ConnectionTransport(connection)` 抛出异常，connection 已被加入内部 map 但不会被清理。MCU 端端口保持打开状态。

**影响**：串口资源枯竭，MCU 通常只支持 1-2 个并发连接。

**修复建议**：在 catch 块中调用 `serial.close(portId)` 并从 map 中删除。

---

### 🟡 P1 — [C1] WebDeviceGateway 端口打开失败泄漏

**文件**：`web-client/src/platform/serial/web/device-gateway.ts` — `connect()`

**问题**：若 `port.open()` 成功但后续操作异常，端口处于 open 状态但未包装，用户无法访问原始 port 对象来 close 它。

**影响**：浏览器端口被占用，用户无法重新连接。

**修复建议**：在 catch 块中 `port.close()`。

---

### 🟢 P2 — [C2] ConnectionTransport 未处理监听器移除异常

**文件**：`web-client/src/platform/serial/transports.ts` — `ConnectionTransport.read()`

**问题**：`connection.removeDataListener(handleData)` 若抛出异常（如连接已断开），会触发未捕获的 Promise rejection。

**修复建议**：用 try/catch 包裹 removeDataListener 调用。

---

### 🟢 P2 — [C2] ConnectionTransport 超时后监听器悬挂

**文件**：`web-client/src/platform/serial/transports.ts` — `ConnectionTransport.read()`

**问题**：超时触发但 Promise 因外部原因已被 settle 时，`handleData` 监听器可能保留在 connection 中不被移除。

**影响**：长时间多次超时后监听器队列膨胀。

**修复建议**：添加统一的 cleanup 函数确保所有路径均移除监听器。

---

### 🟢 P2 — [C5] WebSerialTransport close() 可能遗留 waiter

**文件**：`web-client/src/platform/serial/transports.ts` — `close()`

**问题**：close() 执行时若仍有待处理的 `waitForData()` 调用，那些 waiter 会永久挂起，因为 `notifyReadWaiters()` 不会再被调用。

**修复建议**：在 close() 开头调用 `notifyReadWaiters()` 或 reject 所有 pending waiter。

---

### 🟢 P2 — [C4] send() 方法跨平台超时处理不一致

**文件**：`web-client/src/platform/serial/transports.ts`

**问题**：WebSerial 超时时调用 `writer.abort()` 销毁 writer，而 Electron 超时时不调用任何中止操作，行为不对称。

**修复建议**：在 Electron 端也实现超时中止或统一处理策略。

---

### ℹ️ INFO — [C8] factory.ts 使用模块级缓存而非框架级管理

**文件**：`web-client/src/platform/serial/factory.ts`

**现象**：使用模块级 `let cachedGateway` 缓存 gateway 实例。

**建议**：当前实现功能正确，但若需要测试隔离或热替换，考虑使用依赖注入容器。

---

### ℹ️ INFO — [C8] compat.ts 缺少 WebSerial API 版本检测

**文件**：`web-client/src/platform/serial/compat.ts`

**建议**：可考虑检测 WebSerial API 的具体特性（如 `SerialPort.prototype.forget`）以便在旧版浏览器上提供更好的降级提示。

---

### ℹ️ INFO — [C6] WebSerialTransport 硬编码的缓冲策略

**文件**：`web-client/src/platform/serial/transports.ts`

**建议**：读取缓冲区使用的 chunk 策略是固定的，对于不同 ROM 大小可能不是最优的。可考虑提供可配置的缓冲策略。

---

## 未覆盖区域

无
