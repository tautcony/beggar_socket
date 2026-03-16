# Phase 1 审查报告：platform/serial — 传输层

> 审查时间：2026-03-16  
> 审查文件数：8  
> 发现问题数：P0(0) / P1(3) / P2(5) / INFO(2)

## 已审查文件

- `src/platform/serial/types.ts`
- `src/platform/serial/transports.ts`
- `src/platform/serial/web/device-gateway.ts`
- `src/platform/serial/electron/device-gateway.ts`
- `src/platform/serial/factory.ts`
- `src/platform/serial/compat.ts`
- `src/platform/serial/index.ts`
- `src/utils/electron.ts`

## 问题清单

### 🟡 P1 — [C2] `withTimeout` 超时后原始 Promise 仍 pending，可能泄漏副作用

**文件**：`src/platform/serial/transports.ts` — `withTimeout()`

**现象**：  
```typescript
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) { clearTimeout(timer); }
  }
}
```

`withTimeout` 在超时后通过 `Promise.race` reject，但原始 `operation` Promise 仍在 pending——它最终会 resolve/reject，但结果被丢弃。对于 `writer.write(payload)` 和 `reader.read()` 这类操作，底层 I/O 操作仍在进行中。

**问题**：  
在 `send()` 超时后，底层 `writer.write()` 仍可能在后台完成写入。如果调用方紧接着发送下一个数据包，可能出现数据交错。虽然当前实现使用持久化 writer（已修复分析文档中的 P0 问题），不再在超时时释放锁，但超时后的"幽灵写入"仍可能导致协议帧错位。

**影响**：  
在超时恢复场景下，后续通信可能收到前一个操作的残余数据，影响可靠性。

**修复建议**：  
考虑在超时后使用 `AbortController` 或标记 transport 为 errored 状态，强制调用方在继续前重置连接。或者在超时后追踪 pending 操作，确保后续 `send()` 等待前一个操作完成。

---

### 🟡 P1 — [C1] `pumpReadable` 异常后重启 pump 时无法确认 `readable` stream 状态

**文件**：`src/platform/serial/transports.ts` — `ensurePumpStarted()`

**现象**：  
```typescript
private ensurePumpStarted(): void {
  if (!this.port.readable) {
    throw new Error('Port readable stream is not available');
  }
  if (this.pumpPromise) { return; }

  this.bufferedChunks.length = 0;
  this.bufferedLength = 0;
  this.streamDone = false;
  this.streamError = null;
  this.reader = this.port.readable.getReader();  // ← 可能抛出 if stream is errored/locked
  this.pumpPromise = this.pumpReadable();
}
```

**问题**：  
当 `pumpReadable` 因异常退出后（如 USB 断开瞬间），`pumpPromise` 被设为 `null`。下次 `read()` 调用 `ensurePumpStarted()` 时尝试重新获取 reader，但此时 `port.readable` 可能处于 errored 状态。`getReader()` 会抛异常，这个异常会传播给调用者，但无恢复机制——此后所有 `read()` 调用都会持续失败，直到用户重新连接。

**影响**：  
一次 pump 错误可能导致后续所有读取操作失败而无法自愈。

**修复建议**：  
在 `ensurePumpStarted()` 中检查 `port.readable` 的状态（是否 locked 或 errored），若无法恢复则抛出带有明确指引的错误（如"请重新连接设备"），而不是让底层 `getReader()` 错误直接传播。

---

### 🟡 P1 — [C4] `WebDeviceGateway.init()` 与 `ElectronDeviceGateway.init()` 的信号序列不一致

**文件**：`src/platform/serial/web/device-gateway.ts` 和 `src/platform/serial/electron/device-gateway.ts` — `init()`

**现象**：  
Web 版 `init()`:
```typescript
await device.transport.setSignals({ dataTerminalReady: true, requestToSend: true });
await timeout(10);
await device.transport.setSignals({ dataTerminalReady: false, requestToSend: false });
await timeout(200);
```

Electron 版 `init()`:
```typescript
await device.transport.setSignals({ dataTerminalReady: true, requestToSend: true });
await timeout(10);
await device.transport.setSignals({ dataTerminalReady: false, requestToSend: false });
await timeout(200);
```

**对比 `docs/modules/03-platform-serial.md` 中记录的 MCU 契约**：
文档记录 init 步骤为：
1. `setSignals({ dataTerminalReady: false, requestToSend: false })`
2. 延迟 200ms
3. `setSignals({ dataTerminalReady: true, requestToSend: true })`

但实际代码先设置 `true`，再设置 `false`——与文档描述**完全相反**。

**问题**：  
MCU 在 `SET_CONTROL_LINE_STATE` 中于 DTR/RTS **上升沿**执行缓冲清空和状态复位。当前代码先拉高再拉低，意味着 MCU 在第一步（true）时就触发了复位，然后代码又将线拉低。这在功能上可能仍然可以工作（因为 MCU 确实收到了上升沿），但：
- 最终状态是 DTR=false/RTS=false（不活跃），而非 DTR=true/RTS=true
- 与文档描述不一致，可能导致后续维护者误解

**影响**：  
当前功能可能正常（因为上升沿确实发生了），但代码意图与文档不一致，且最终信号状态可能影响某些硬件行为。

**修复建议**：  
确认 MCU 实际行为：是依赖上升沿触发还是依赖最终电平？如果依赖上升沿，当前代码可工作但应更新文档；如果依赖最终电平为高，应调换顺序（先 false → delay → true）。

---

### 🟢 P2 — [C7] `ConnectionTransport.read()` 中 `handleData` 回调的竞态条件

**文件**：`src/platform/serial/transports.ts` — `ConnectionTransport.read()`

**现象**：  
```typescript
function handleData(data: Uint8Array) {
  if (settled) return;
  const bytesToCopy = Math.min(data.byteLength, length - offset);
  accumulatedData.set(data.subarray(0, bytesToCopy), offset);
  offset += bytesToCopy;
  // ...
}
```

**问题**：  
虽然 JavaScript 是单线程的，`handleData` 不存在真正的并发竞态，但当收到的 `data` 长度超过剩余需要的字节数时（`data.byteLength > length - offset`），超出的字节会被静默丢弃。在协议层面，这些丢弃的字节实际上是下一个消息的前缀。

**影响**：  
如果设备在一次事件回调中返回了跨越两个协议消息的数据（虽然在当前 9600 波特率 + USB CDC 模式下概率极低），后续读取可能会丢失开头的字节。

**修复建议**：  
保留超出部分到内部缓冲区，供下一次 `read()` 使用，类似 `WebSerialTransport` 的 `bufferedChunks` 设计。

---

### 🟢 P2 — [C5] `ElectronDeviceGateway` listener 注册为全局单例，但可能管理多个端口

**文件**：`src/platform/serial/electron/device-gateway.ts` — `setupListeners()`

**现象**：  
```typescript
private setupListeners(): void {
  if (this.listenersBound) return;
  this.listenersBound = true;
  window.electronAPI.serial.onData((portId: string, data: Uint8Array) => {
    const listener = this.dataListeners.get(portId);
    if (listener) listener(data);
  });
  // ...
}
```

**问题**：  
`listenersBound` flag 确保 `onData`/`onError`/`onClose` 只注册一次。但这些监听器的生命周期绑定到 `ElectronDeviceGateway` 实例，而不是单个端口连接。如果 gateway 被销毁并重建（虽然 `factory.ts` 使用了缓存），这些 IPC listener 不会被移除，可能导致旧 listener 继续接收事件。

此外，`removeDataListener` / `removeErrorListener` / `removeCloseListener` 使用 `delete` 从 Map 移除 callback，但不检查传入的 `_callback` 参数是否与已注册的一致——参数被完全忽略：
```typescript
removeDataListener: (_callback: DataListener) => {
  this.dataListeners.delete(portId);
},
```

**影响**：  
在当前使用模式下（单端口、缓存 gateway）影响较小。但如果将来支持多端口并发，或 gateway 重建，可能出现事件路由错误。

**修复建议**：  
- `removeXxxListener` 应验证传入的 callback 与注册的 callback 一致
- 考虑在 gateway 销毁时移除 IPC listener（如果 Electron API 支持 `off`）

---

### 🟢 P2 — [C11] `WebSerialTransport.close()` 中 reader cancel 与 pump 的交互

**文件**：`src/platform/serial/transports.ts` — `WebSerialTransport.close()`

**现象**：  
```typescript
async close(): Promise<void> {
  this.releaseWriter();
  if (this.reader) {
    try { await this.reader.cancel(); } catch {}
  }
  if (this.pumpPromise) {
    try { await this.pumpPromise; } catch {}
  }
  await this.port.close();
}
```

**问题**：  
`reader.cancel()` 被正确调用以终止 pump 循环，然后 `await this.pumpPromise` 等待 pump 完成。但 `cancel()` 的异常被静默吞掉（空 catch），如果 `cancel()` 失败（如 reader 已处于 errored 状态），`pumpPromise` 可能永远不会 resolve（因为 pump 仍在等待 `reader.read()`）。

**影响**：  
极端情况下 `close()` 可能挂起。

**修复建议**：  
为 `await this.pumpPromise` 添加超时保护，避免 `close()` 永远挂起。

---

### 🟢 P2 — [C8] `compat.ts` 中 `resolveTransport` 在无 transport 时创建新实例

**文件**：`src/platform/serial/compat.ts` — `resolveTransport()`

**现象**：  
```typescript
export function resolveTransport(device: DeviceInfo | { transport: Transport }): Transport {
  if ('transport' in device && device.transport) { return device.transport; }
  if ('connection' in device && device.connection) { return new ConnectionTransport(device.connection); }
  if ('port' in device && device.port) { return new WebSerialTransport(device.port); }
  throw new Error('Serial port not properly initialized');
}
```

**问题**：  
每次在无 `transport` 的 `DeviceInfo` 上调用 `resolveTransport()` 都会创建新的 Transport 实例。对于 `WebSerialTransport`，这意味着每次调用会获得一个全新的 writer/reader/pump 状态，旧的不会被清理。如果多处代码独立调用此函数，可能产生多个 Transport 实例竞争同一个 `SerialPort`。

**影响**：  
多个 `WebSerialTransport` 实例争用同一个 `port.writable.getWriter()` 将导致锁冲突异常。但在当前代码中，`resolveTransport` 通常只在 compat 层使用，且 `DeviceInfo` 通常已有 `transport`，实际触发概率较低。

**修复建议**：  
将创建的 Transport 回写到 `device.transport` 以避免重复创建，或改为仅抛出错误要求调用方提供 transport。

---

### 🟢 P2 — [C5] `WebDeviceGateway.disconnect()` 不清理 transport 的内部状态

**文件**：`src/platform/serial/web/device-gateway.ts` — `disconnect()`

**现象**：  
```typescript
async disconnect(device: DeviceHandle): Promise<void> {
  if (device.transport.close) {
    await device.transport.close();
  }
  device.port = null;
  device.connection = null;
}
```

**问题**：  
`transport.close()` 通过可选链调用（`close` 在 `Transport` 接口中是可选的），如果某个 transport 实现没有 `close` 方法，disconnect 会直接设置 `device.port = null` 而不关闭底层端口。此外，`device.transport` 本身不被置空，可能导致后续代码尝试使用已关闭的 transport。

对比 Electron 版的 `disconnect()`，它通过 `device.connection.close()` 关闭并清理连接，逻辑更完整。

**影响**：  
语义上的不对称——Web 版依赖 `transport.close?.()` 的可选性，Electron 版直接关闭 connection。如果 Transport 接口的 `close` 变为 required，这个不对称会被类型系统捕获。

**修复建议**：  
将 `Transport.close` 从可选改为必选方法，确保所有实现都提供关闭逻辑。

---

### ℹ️ INFO — [C6] `bufferSize` 已从默认 255 提升到 4096

**文件**：`src/platform/serial/web/device-gateway.ts` — `connect()`

**现象**：  
```typescript
await port.open({
  // ...
  bufferSize: 4096,
});
```

**说明**：  
分析文档（`webserial-vs-electron-serial-analysis.md`）中记录的 P1 问题（`bufferSize` 默认 255 字节太小）已被部分修复——当前设置为 4096 字节。分析文档建议设为 16384（16KB，匹配最大页大小），但 4096 对大多数场景已足够。如果 ROM 页大小使用 `0x4000`（16KB），在极端情况下仍可能产生额外背压。

---

### ℹ️ INFO — [C6] `requestSerialPort()` 在 `utils/electron.ts` 中未使用 port filter

**文件**：`src/utils/electron.ts` — `requestSerialPort()`

**现象**：  
```typescript
export async function requestSerialPort(): Promise<{ granted: boolean }> {
  if (isElectron()) {
    return await window.electronAPI.requestSerialPort();
  }
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
```

**说明**：  
`requestPort()` 调用时未传入任何 filter（如 VID/PID 过滤），这导致用户会看到所有串口设备而非仅限 ChisFlash 设备。不过此函数可能仅作为通用权限请求使用（实际连接逻辑在 `DeviceGateway.select()` 中已使用 filter），所以不构成实际问题。

---

## 未覆盖区域

无
