# WebSerial vs Electron SerialPort 稳定性差异分析

## 问题描述

浏览器版本（WebSerial）串口交互不稳定，常出现无响应（需重试才能恢复），而 Electron 版本（node serialport）成功率和吞吐量明显更好。

## 架构概览

```
[Protocol Layer]
     ↓
[Transport Interface]  ← 统一的 send() / read() 接口
     ├── WebSerialTransport     ← 浏览器：navigator.serial + Streams API
     └── ConnectionTransport    ← Electron：IPC → node SerialPort 库
```

- 协议层（`protocol.ts`）通过 `Transport` 接口发送/接收数据，不感知底层实现
- 两个 Transport 实现共享相同的超时配置（`AdvancedSettings`）
- 区别全部集中在 Transport 实现层和设备网关层

---

## 发现的问题

### 🔴 P0：WebSerial `send()` 每次创建/释放 Writer Lock

**文件**: `src/platform/serial/transports.ts` — `WebSerialTransport.send()`

```typescript
async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = this.port.writable?.getWriter(); // ← 每次 send 都获取新锁
    // ...
    try {
      await Promise.race([writePromise, timeoutPromise]);
      return true;
    } finally {
      try { writer.releaseLock(); } catch {} // ← 每次 send 都释放锁
    }
}
```

**问题**:
- WebSerial 的 `WritableStream.getWriter()` 需要获取独占锁（exclusive lock），`releaseLock()` 释放锁
- 每次 `send()` 都做一次 acquire/release，在高频调用场景下（如 `rom_get_id` 中连续6次 write+read）产生显著开销
- WebSerial 规范要求 writer lock 排他，频繁获取/释放增加了浏览器内部状态切换的开销

**对比 Electron**:
`ConnectionTransport.send()` 直接调用 `this.connection.write(payload)`，通过 IPC 传到主进程的 `port.write(buffer)`，无需管理任何锁。Node.js SerialPort 内部有写入队列，天然串行化。

**影响**: 增加延迟，在快速连续发送时可能导致锁竞争或状态不一致。

---

### 🔴 P0：超时触发时释放锁导致写入状态损坏

**文件**: `src/platform/serial/transports.ts` — `WebSerialTransport.send()`

```typescript
const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
        writer.releaseLock();  // ⚠️ 超时时强制释放锁，但 write 可能仍在进行
        reject(new Error(`Send package timeout in ${timeout}ms`));
    }, timeout);
});
await Promise.race([writePromise, timeoutPromise]);
```

**问题**:
1. 如果超时先触发，`writer.releaseLock()` 在写操作仍在进行时被调用
2. 底层 `WritableStream` 可能进入不确定状态——写操作仍在 pending 但 writer 已经被释放
3. 随后的 `send()` 获取新 writer 时，前一次的写操作可能还没完成
4. 这可能导致两次写操作数据交错发送到设备，破坏协议帧
5. `finally` 块又调用一次 `releaseLock()`，虽然被 try/catch 保护，但说明逻辑上已经有重复释放的可能

**对比 Electron**:
`ConnectionTransport.send()` 使用 `withTimeout()` 包装 `connection.write()`。即使超时，IPC 调用不会被中途取消，Node.js SerialPort 的写入队列保持一致。

**影响**: 这是导致"无响应"的最可能根因——一次超时后，WritableStream 状态被破坏，后续通信全部失败，直到用户重新连接（重试时重建连接才能恢复）。

---

### 🟡 P1：WebSerial 未设置 `bufferSize`，使用默认值 255 字节

**文件**: `src/platform/serial/web/device-gateway.ts`

```typescript
await port.open({
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    // ← 未设置 bufferSize，Chrome 默认 255 字节
});
```

**问题**:
- Chrome WebSerial API 的 `bufferSize` 默认仅 **255 字节**
- 协议中的数据包可能很大（ROM 读取页大小默认 `0x200` = 512 字节，最大可达 `0x4000` = 16384 字节）
- 加上协议头（2字节长度 + 2字节 CRC），实际传输量超过 buffer 大小
- 小 buffer 意味着底层 USB 数据需要更多次地被浏览器读取并传递到 ReadableStream
- 在高吞吐场景下，小 buffer 可能导致数据到达但因 buffer 不够而产生延迟或背压

**对比 Electron**:
Node.js SerialPort 使用操作系统级的串口缓冲区（通常 4096+ 字节），且 `data` 事件的 chunk 大小由 OS 驱动决定，通常远大于 255 字节。

**影响**: 降低吞吐量，增加读取延迟。在大数据传输时尤其明显。

---

### 🟡 P1：`pumpReadable` 中异常处理可能导致 pump 静默停止

**文件**: `src/platform/serial/transports.ts` — `WebSerialTransport.pumpReadable()`

```typescript
private async pumpReadable(): Promise<void> {
    try {
      while (true) {
        const { value, done } = await reader.read();
        // ...
      }
    } catch (error) {
      this.streamError = error;  // 记录错误
      this.notifyReadWaiters();  // 唤醒等待者
    } finally {
      try { reader.releaseLock(); } catch {}
      if (this.reader === reader) {
        this.reader = null;
      }
      this.pumpPromise = null;  // ← pump 结束，后续 ensurePumpStarted() 会重新创建
    }
}
```

**问题**:
- 当 pump 因异常退出时（如 USB 断开瞬间、浏览器内部错误），`pumpPromise` 被设为 `null`
- 下次 `read()` 会调用 `ensurePumpStarted()` 重新创建 pump
- 但重新获取 `this.port.readable.getReader()` 时，如果之前的 readable stream 已被破坏（locked/errored），将抛出异常
- 这个异常会传播给调用者，但不会触发任何恢复机制

**对比 Electron**:
事件驱动模型通过 `port.on('data')` 持续监听，Node.js 的串口 stream 有自动重连/恢复能力。即使一次读取出错，data 事件流不会中断。

**影响**: 一次 pump 错误可能导致后续所有读取操作失败。

---

### 🟢 P2: Electron `serial-write` 不等待 `drain`

**文件**: `electron/ipc-handlers.js`

```javascript
port.write(buffer, (error) => {
    if (error) reject(error);
    else resolve(true);  // ← 写入回调触发并不代表数据已发送到设备
});
```

**说明**: Node.js SerialPort 的 `write()` 回调表示数据已写入内核缓冲区，不一定已发到设备。理想情况下应等 `drain` 事件确保缓冲区已清空。但实际影响较小：
- USB CDC 设备的传输速度很快
- SerialPort 内部有写入队列管理
- 在 9600 波特率下内核缓冲区容量绑绑有余（但 STM32 USB CDC 的实际速率远超 9600）

**影响**: 理论上极端高频写入场景可能丢失数据，但在当前协议模式下（写-等ACK-写）基本不会触发。

---

### 🟢 P2：Electron 数据序列化/反序列化开销

**文件**: `electron/preload.js` + `electron/ipc-handlers.js`

```
发送: Uint8Array → Array.from(data) → IPC → Buffer.from(data)
接收: Buffer(data) → Array.from(data) → IPC → new Uint8Array(data)
```

**说明**: 每次 IPC 传输都经历 Uint8Array ↔ Array ↔ Buffer 转换。虽然有额外 GC 开销，但由于 Electron IPC 在进程间用共享内存，实际延迟很低。

---

## 根因总结

| 严重度 | 问题 | 影响 |
|--------|------|------|
| 🔴 P0 | Writer lock 每次 send 都 acquire/release | 高频通信下增加延迟和锁竞争 |
| 🔴 P0 | 超时触发释放 writer lock 破坏 stream 状态 | **最可能的根因**——导致后续通信无响应 |
| 🟡 P1 | WebSerial bufferSize 默认 255 字节太小 | 大数据包传输延迟增加、吞吐下降 |
| 🟡 P1 | pump 异常后 readable stream 恢复困难 | 一次错误可能导致通信永久中断 |
| 🟢 P2 | Electron write 未等 drain | 极端场景可能丢数据，实际影响小 |
| 🟢 P2 | Electron IPC 数据序列化开销 | 微小延迟，无功能影响 |

---

## 修复建议

### 1. 持久化 Writer（解决 P0 Writer Lock 问题）

将 writer 的生命周期绑定到 transport 实例，而非每次 send：

```typescript
export class WebSerialTransport implements Transport {
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  private getWriter(): WritableStreamDefaultWriter<Uint8Array> {
    if (!this.writer) {
      const writable = this.port.writable;
      if (!writable) throw new Error('Serial port not properly initialized');
      this.writer = writable.getWriter();
    }
    return this.writer;
  }

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = this.getWriter();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
    await withTimeout(
      writer.write(payload),
      timeout,
      `Send package timeout in ${timeout}ms`,
    );
    return true;
  }

  async close(): Promise<void> {
    if (this.writer) {
      try { this.writer.releaseLock(); } catch {}
      this.writer = null;
    }
    // ... rest of close logic
  }
}
```

**关键改动**:
- Writer 在首次 send 时创建，随 transport 生命周期
- 超时不再释放 writer lock，仅抛出错误
- close() 时统一释放

### 2. 增大 WebSerial bufferSize（解决 P1 缓冲区问题）

```typescript
await port.open({
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    bufferSize: 16384,  // 16KB，匹配最大页大小
});
```

### 3. Send 超时改为仅报错不破坏流（强化 P0 修复）

使用 `withTimeout` 统一超时逻辑，不在超时回调中操作 writer 状态：

```typescript
async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = this.getWriter();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
    await withTimeout(
      writer.write(payload),
      timeout,
      `Send package timeout in ${timeout}ms`,
    );
    return true;
}
```

### 4. Electron write 增加 drain 等待（可选优化）

```javascript
ipcMain.handle('serial-write', async (event, portId, data) => {
    const port = activeSerialPorts.get(portId);
    const buffer = Buffer.from(data);
    return new Promise((resolve, reject) => {
        const ok = port.write(buffer, (error) => {
            if (error) reject(error);
        });
        if (ok) {
            resolve(true);
        } else {
            port.once('drain', () => resolve(true));
        }
    });
});
```
