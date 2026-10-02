# 模块：Platform Serial

`src/platform/serial/types.ts` 定义 DeviceGateway（list/select/connect/init/disconnect）、DeviceHandle 与 Transport（send/read/sendAndReceive/setSignals/close）。DeviceInfo 的 transport/handle 由连接 manager 投影给上层。

`src/platform/serial/factory.ts` 通过 `src/platform/runtime.ts` 选择 Web/Tauri，DebugSettings 开启时选择 simulated；init/disconnect 按 handle.platform 路由，避免运行时设置变化清理错平台。

- `src/platform/serial/web/device-gateway.ts` 与 `src/platform/serial/transports.ts`：navigator.serial 与 WebSerialTransport。
- `src/platform/serial/tauri/device-gateway.ts` 与 `src/platform/serial/tauri/tauri-serial-transport.ts`：native invoke；迟到 open 成功立即回收，close 仅成功后标 closed，失败可重试。
- `src/platform/serial/simulated/device-gateway.ts`、`src/platform/serial/simulated/transport.ts` 与 `src/platform/serial/simulated/runtime.ts`：校验协议帧并执行模拟卡带命令。

`src/platform/serial/device-signals.ts` 的 init 顺序为 DTR/RTS 低 → 等 10 ms → 高 → 等 10 ms → 低 → 等 200 ms；高电平上升沿触发设备命令缓冲复位，最终保持低电平。read 必须累计到目标长度；ACK 读 1 byte，payload 响应读 2 + size bytes，拆包不能当成短包成功。

Web read 沿用分片之间的 idle timeout；Tauri/native 沿用完整读取的 total deadline。慢设备持续分片可能在两种模式得到不同结果，默认兼容策略不通过统一较短 deadline 改写。包发送/读取 timeout 与整个操作预算是独立边界。

取消不能强行解除真实 I/O 所有权。Web writer abort 和 native OS flush 若不能完成，恢复仍需等待；native close 的协作检查不等于 JS 用户取消即时中断。Native 细节见 [Tauri runtime](07-tauri-runtime.md)。

`src/platform/serial/transport-errors.ts` 的 createReadTimeoutError 保留旧 message，并携带稳定 TRANSPORT_TIMEOUT code；碎片/零字节/期限等合同见 `tests/platform/serial/timeout-contracts.test.ts`。Transport 不新增可选能力字段，运行时默认 timeout 行为沿用。
