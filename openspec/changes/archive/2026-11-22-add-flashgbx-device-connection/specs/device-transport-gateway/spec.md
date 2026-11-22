# Spec Delta

## ADDED Requirements

### Requirement: Configurable serial baud rate on device connection
`DeviceSelection` SHALL 支持可选 `baudRate`；Web Serial、Tauri 原生与 Simulated gateway SHALL 以该值打开端口，缺省使用 `DEFAULT_SERIAL_CONFIG.baudRate`。Tauri 原生命令 SHALL 校验取值属于 `{9600, 1000000, 1500000, 2000000}`，否则返回明确错误。

#### Scenario: Web runtime explicit baud
- **WHEN** `WebDeviceGateway.connect()` 收到 `baudRate: 1000000`
- **THEN** `port.open()` 以 `1000000` 调用

#### Scenario: Tauri runtime explicit baud
- **WHEN** `TauriDeviceGateway.connect()` 收到 `baudRate: 1000000`
- **THEN** `native_open_serial_port` 以 `1000000` 打开

#### Scenario: Invalid baud in Tauri
- **WHEN** 传入不在允许集合内的 `baud_rate`
- **THEN** 命令返回错误且不打开端口

#### Scenario: Default preserved
- **WHEN** 未指定 `baudRate`
- **THEN** 各 gateway 使用 `DEFAULT_SERIAL_CONFIG.baudRate`

### Requirement: Optional skip of ChisFlash signal initialization
`DeviceHandle` SHALL 携带 `skipSignalInit`（由 `DeviceSelection` 设置）；各 gateway 的 `init()` 在其为真时 SHALL NOT 调用 `initDeviceSignals()`，缺省行为不变。重置/重试路径 SHALL 保留该标志。

#### Scenario: Skip on connect
- **WHEN** `connect()` 收到 `skipSignalInit: true` 并随后 `init()`
- **THEN** 不产生任何 DTR/RTS 变化

#### Scenario: Skip preserved on reset button
- **WHEN** 用户点击重置/重试按钮（只传 `DeviceHandle`）
- **THEN** 仍不产生 DTR/RTS 变化

#### Scenario: Default behavior
- **WHEN** 未指定 `skipSignalInit`
- **THEN** 仍执行现有 DTR/RTS 脉冲序列

### Requirement: Variable-length read and output flush on Transport
`Transport` SHALL 提供 `readAvailable(timeoutMs)`（返回当前可用的全部字节，不因长度不足丢弃）与 `flushOutput()`；Web、Tauri、Simulated 三端 SHALL 实现。

#### Scenario: Read all available bytes
- **WHEN** 设备在等待窗口内返回 N 个字节
- **THEN** `readAvailable` 返回这 N 个字节，不抛长度错误

#### Scenario: Flush output
- **WHEN** 调用 `flushOutput()`
- **THEN** 待发送缓冲被清空（Tauri 调用串口输出清理）

### Requirement: Connection retry preserves selection
连接失败回滚后重试 SHALL 复用已授权的 Web 端口，并向 `select()` 透传端口过滤器。

#### Scenario: Web retry without new user gesture
- **WHEN** Web 连接握手失败后用户重试
- **THEN** 复用已授权 `webPort`，不触发新的权限弹窗，也不因缺少用户手势报错
