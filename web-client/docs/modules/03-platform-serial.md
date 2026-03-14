# 模块：Platform Serial

## 目录
- `src/platform/serial/types.ts`
- `src/platform/serial/transports.ts`
- `src/platform/serial/web/device-gateway.ts`
- `src/platform/serial/electron/device-gateway.ts`
- `src/platform/serial/factory.ts`
- `src/platform/serial/compat.ts`
- `src/platform/serial/index.ts`

**辅助工具（不属于平台层本身，但被平台层使用）：**
- `src/utils/electron.ts`: Electron 环境检测与平台能力工具（`isElectron()`、`getPlatform()`、`getAppVersion()` 等）

## 职责
- 统一 Web/Electron 的设备连接与串口读写抽象。
- 隔离 Web 与 Electron 差异，向上提供统一串口连接/读写能力。

## 核心抽象
- `DeviceGateway`: `list/select/connect/init/disconnect`
- `Transport`: `send/read/setSignals/close`
- `DeviceHandle`: 平台设备句柄

## 运行时选择
- `factory.ts` 通过 `isElectron()` 选择网关实现。

## 模块设计
- `types.ts`: `DeviceGateway`、`Transport`、`DeviceHandle` 抽象
- `web/device-gateway.ts`: Web Serial 实现
- `electron/device-gateway.ts`: Electron IPC + serialport 实现
- `transports.ts`: `WebSerialTransport` 与 `ConnectionTransport`
- `compat.ts`: `DeviceInfo` 与 `DeviceHandle` 兼容转换
- `factory.ts`: 运行时网关选择

## 与 MCU 的 CDC 契约

### 初始化控制线
- `DeviceGateway.init()` 在 Web/Electron 均执行：
  - `setSignals({ dataTerminalReady: false, requestToSend: false })`
  - 延迟约 `200ms`
  - `setSignals({ dataTerminalReady: true, requestToSend: true })`
- MCU 在 CDC `SET_CONTROL_LINE_STATE` 中接收 DTR/RTS，并在上升沿执行：
  - 清空命令缓冲 `cmdBuf`
  - 清空响应缓冲 `responBuf`
  - 清除 `busy` 状态
- 含义：平台层的 `init()` 不只是“串口打开后例行操作”，而是协议会话复位步骤。

### 读写契约
- `Transport.send(payload)` 发送完整协议包，不做语义拆分。
- `Transport.read(length)` 必须按协议期望长度阻塞读取，直到凑齐长度或超时。
- 由于 MCU/USB 侧可能分批发送（512B），`read(length)` 需要处理拆包拼接。
- 协议层依赖该契约：
  - ACK 命令读取 `1` 字节并判定 `0xAA`
  - 数据命令读取 `2 + payloadSize`（前 2 字节为 CRC 占位）

### 超时与错误传播
- 发送/读取超时由 `AdvancedSettings.packageSendTimeout` 与 `packageReceiveTimeout` 控制。
- 平台层只负责抛出 I/O 超时或底层异常，不在该层解释协议成功/失败。
- 协议成功语义（例如 ACK 是否等于 `0xAA`）由 `ProtocolAdapter` 统一判定。
