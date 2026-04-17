# Phase 1 审查报告: 平台传输层

> 日期: 2026-04-15
> 文件数: 9
> 发现: P0(2) / P1(4) / P2(3) / INFO(1)

## 已审查文件

- `src/platform/serial/transports.ts` (WebSerialTransport)
- `src/platform/serial/tauri/device-gateway.ts` (TauriDeviceGateway)
- `src/platform/serial/tauri/tauri-serial-transport.ts` (TauriSerialTransport)
- `src/platform/serial/web/device-gateway.ts` (WebDeviceGateway)
- `src/platform/serial/factory.ts`
- `src/platform/serial/compat.ts`
- `src/platform/serial/types.ts`
- `src/platform/serial/mutex.ts`
- `src/platform/serial/index.ts`

## Findings

### [P0] WebSerialTransport.send() 写锁未释放

- **位置**: `platform/serial/transports.ts` `send()` (L70-85)
- **触发条件**: 任何成功的 `send()` 调用
- **影响**: Writer 在 `acquireWriter()` 获取后永远不会被释放。第一次成功写入后，writer 被缓存并一直持有锁。虽然后续写入可以复用同一个 writer（因为缓存了），但这导致：
  1. `close()` 中 `releaseWriter()` 是唯一释放点，如果 close 未被调用则永久泄漏
  2. 超时时 `writer.abort()` 后设置 `this.writer = null`，但下次 `acquireWriter()` 尝试在已 abort 的 writable stream 上 `getWriter()` 可能失败
  3. `abort()` 是异步的但 onTimeout 回调中未等待完成，新 writer 创建可能与旧 abort 竞态
- **修复方向**: 在 `send()` 的 finally 块中释放 writer，或明确文档化 writer 缓存策略并确保超时恢复路径正确。最小修复是在 onTimeout 中将 abort 结果与 writer 重建绑定。

### [P0] Mutex 双重释放导致队列错乱

- **位置**: `platform/serial/mutex.ts` `acquire()` (L20-33)
- **触发条件**: release 回调被调用两次（编程错误或异常处理中的重入）
- **影响**: 第二次调用 release 时：
  1. `_locked` 被重新设为 false（此时可能已被其他 acquire 设为 true）
  2. 队列 shift 第二次，跳过一个合法等待者
  3. 后续操作可能并发进入临界区，或某个等待者永远不被唤醒（死锁）
- **修复方向**: 在 release 闭包中添加 `released` 标志位，第二次调用时忽略或抛出错误：
  ```typescript
  let released = false;
  resolve(() => {
    if (released) return;
    released = true;
    this._locked = false;
    const next = this._queue.shift();
    if (next) next();
  });
  ```

### [P1] TauriDeviceGateway.connect() 无开端超时

- **位置**: `platform/serial/tauri/device-gateway.ts` `connect()` (L153-164)
- **触发条件**: 硬件卡死或设备无响应时，`tauriPort.open()` 永不返回
- **影响**: UI 完全卡住，用户无法取消操作
- **修复方向**: 添加 `withTimeout(tauriPort.open(), 5000, '...')`

### [P1] TauriDeviceGateway.init() 信号序列半完成无回滚

- **位置**: `platform/serial/tauri/device-gateway.ts` `init()` (L185-207)
- **触发条件**: init 序列中间步骤（DTR/RTS high→low）失败
- **影响**: 硬件可能停留在 DTR/RTS 高电平状态，下次连接时行为异常
- **修复方向**: 在 catch 块中尝试将信号复位到安全状态（DTR=false, RTS=false）

### [P1] WebSerialTransport.close() 资源释放顺序问题

- **位置**: `platform/serial/transports.ts` `close()` (L122-134)
- **触发条件**: pump 正在读取时调用 close
- **影响**: `reader.cancel()` 会唤醒 pump，但 pump 的 finally 块可能在 `close()` 的 `await this.pumpPromise` 之前已经释放了 reader lock，随后 `port.close()` 可能与 pump cleanup 竞态
- **修复方向**: 在 reader.cancel 后给 pumpPromise 加 race timeout 兜底：
  ```typescript
  await Promise.race([this.pumpPromise, new Promise(r => setTimeout(r, 2000))]).catch(() => {});
  ```

### [P1] TauriSerialTransport read 中 close 竞态

- **位置**: `platform/serial/tauri/tauri-serial-transport.ts` `read()` (L65-99)
- **触发条件**: 读操作进行中调用 `close()`
- **影响**: `assertOpen()` 仅在循环开头检查，如果 close 发生在 `readBinary()` 等待期间，返回后下一个 `assertOpen()` 才会抛出。但此时可能已收到一些字节写入 target，调用者拿到不完整结果
- **修复方向**: 在 catch 块中检查 `this.closed`，如果是则抛出 'Transport closed during read' 而非原始错误

### [P2] TauriDeviceGateway.disconnect() 异常未捕获

- **位置**: `platform/serial/tauri/device-gateway.ts` `disconnect()` (L209-214)
- **触发条件**: `transport.close()` 抛出异常
- **影响**: disconnect 失败冒泡到调用者，设备句柄的 port/connection 字段未被清理，后续 `isDeviceConnected()` 返回 true
- **修复方向**: 用 try-catch 包裹 close 调用，确保后续 cleanup 始终执行

### [P2] WebSerialTransport ensurePumpStarted 错误恢复未验证端口状态

- **位置**: `platform/serial/transports.ts` `ensurePumpStarted()` (L142-161)
- **触发条件**: 上次 pump 因流错误退出后，端口实际已关闭
- **影响**: `this.port.readable.getReader()` 在 `readable === null` 时抛出 TypeError，未被捕获
- **修复方向**: 在 `resetPumpState()` 后再次检查 `this.port.readable` 是否可用

### [P2] 清理路径中的静默错误吞没

- **位置**: 多处 `.catch(() => {})` 和 `try { ... } catch {}`
  - `transports.ts` L127, L132 (close 中)
  - `tauri-serial-transport.ts` L157 (flushInput)
  - `tauri/device-gateway.ts` L171 (connect 失败后 close)
- **触发条件**: 清理操作失败
- **影响**: 调试时无法发现清理路径的问题
- **修复方向**: 至少用 `console.debug` 记录清理失败

### [INFO] withTimeout 函数重复定义

- **位置**: `transports.ts` 和 `tauri-serial-transport.ts` 各自定义了 `withTimeout`
- **影响**: 维护负担，两个版本行为略有不同（WebSerial 版有 onTimeout 回调）
- **修复方向**: 提取到共享工具模块

## 漏检复盘

- **默认分支 / 未知输入**: 已检查 — Transport 接口方法有清晰的类型约束，DeviceGateway 的 platform 字段有类型联合限制
- **异步失败 / 前提失效**: 发现多个问题（P0-01 writer 状态、P1-03 close 竞态）
- **半完成状态 / 重建窗口**: 发现 P1-02 init 信号半完成
- **渲染 / 导出 / 编码**: 本层无渲染点
- 本 phase 仍然证据不足的点: WebSerialTransport 在极端情况（如 USB 拔除）下的行为需要实际设备测试验证

## 未覆盖区域

- `platform/serial/web/device-gateway.ts` — 仅 3 行变更，与上次审查对比无新风险
