## MODIFIED Requirements

### Requirement: Configurable serial baud rate on device connection
`DeviceSelection` SHALL 支持可选 `baudRate`；Web Serial、Tauri 原生与 Simulated gateway SHALL 以该值打开端口，缺省使用 `DEFAULT_SERIAL_CONFIG.baudRate`。Tauri 原生命令 SHALL 校验取值属于 `{9600, 1000000, 1500000, 2000000}`，否则返回明确错误。连接层 SHALL 只把解析后的 binding 默认值与设置值作为该参数来源：显式传入的 `baudRate` 优先，缺省时由 binding 的 `defaultBaudRate` 派生，不再由调用方按固件身份临时决定。

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

#### Scenario: Binding supplies the session baud
- **WHEN** 会话按 GBFlash binding 建立且设置为 `auto`
- **THEN** 连接层把 `auto` 展开为 `2000000` 后作为 `baudRate` 传入，gateway 不再按固件身份推断

### Requirement: Optional skip of ChisFlash signal initialization
`DeviceHandle` SHALL 携带 `skipSignalInit`（由 `DeviceSelection` 设置）；各 gateway 的 `init()` 在其为真时 SHALL NOT 调用 `initDeviceSignals()`，缺省行为不变。重置/重试路径 SHALL 保留该标志。连接层 SHALL 只依据 binding 的 `signalInit` 派生该标志（`signalInit: 'none'` → `skipSignalInit = true`），gateway 契约与字段名保持不变。

#### Scenario: Skip on connect
- **WHEN** `connect()` 收到 `skipSignalInit: true` 并随后 `init()`
- **THEN** 不产生任何 DTR/RTS 变化

#### Scenario: Skip preserved on reset button
- **WHEN** 用户点击重置/重试按钮（只传 `DeviceHandle`）
- **THEN** 仍不产生 DTR/RTS 变化

#### Scenario: Default behavior
- **WHEN** 未指定 `skipSignalInit`
- **THEN** 仍执行现有 DTR/RTS 脉冲序列

## ADDED Requirements

### Requirement: Settings-directed serial port discovery
系统 SHALL 在打开串口前从 core `SelectionProvider` 读取单一 `variantId`，按其 binding 确定协议、波特率和信号初始化方式。发现过滤仅使用宿主支持的 VID/PID 字段；manufacturer/product 等 identity matcher 仅用于诊断。自动选择 SHALL 只接受 match；mismatch 仅在用户显式选择端口后才可按已保存 variant 继续。`0483:5740` 仅作为碳酸丐的 match 规则与其他 Beggar 端口的手动列表线索，不改变其它 variant 的 match 判定。

#### Scenario: User-selected Web port outside preferred filters
- **WHEN** 用户在 Web 使用完整端口选项并选择与偏好过滤器不匹配的串口
- **THEN** 系统记录实际 VID/PID 和所选配置，并按该配置连接

#### Scenario: Tauri finds one matching port
- **WHEN** Tauri 端口列表恰有一个符合所选设备的端口
- **THEN** 系统可直接选择该端口，按已保存的固件配置打开

#### Scenario: Tauri finds multiple matching ports
- **WHEN** Tauri 端口列表存在多个符合所选设备的端口
- **THEN** 系统请求用户选择串口，并在获得选择前保持串口关闭

#### Scenario: Tauri finds no matching port
- **WHEN** Tauri 找不到匹配端口
- **THEN** 系统提供完整端口列表但不得自动打开 mismatch 端口，用户显式选中后才按已保存 variant 连接

#### Scenario: Port metadata is incomplete
- **WHEN** 已选串口缺少匹配所需的 USB 信息
- **THEN** 自动发现不得据此视为 match；只有用户显式选择该端口后才记录信息不足并按已保存 variant 连接

#### Scenario: Automatic selection never opens mismatch
- **WHEN** 自动发现只得到 mismatch 端口
- **THEN** 系统保持端口关闭并请求用户明确选择

#### Scenario: User-selected mismatch port records diagnostic
- **WHEN** 用户显式选择 mismatch 端口
- **THEN** 系统把 mismatch 写入 `DeviceDiagnostic(stage='transport')` 并按所选 variant 继续连接
