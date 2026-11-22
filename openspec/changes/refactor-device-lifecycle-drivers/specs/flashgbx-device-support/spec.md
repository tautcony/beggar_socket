## MODIFIED Requirements

### Requirement: Disconnect sequence
GBFlash teardown SHALL use one normative sequence: when handshake confirms `cart_power_ctrl=true`, send `CART_PWR_OFF` then `SET_VOLTAGE_3_3V`; otherwise send only `SET_VOLTAGE_3_3V`. The transport SHALL then close even if a safety command fails, while preserving the command and close errors in diagnostics.

#### Scenario: GBFlash disconnect
- **WHEN** 用户断开已完成握手且 `cart_power_ctrl=true` 的 GBFlash 会话
- **THEN** 依次发送 `CART_PWR_OFF` 与 `SET_VOLTAGE_3_3V`，随后关闭端口

#### Scenario: GBFlash without power control disconnects
- **WHEN** an active GBFlash session has no power control and disconnects
- **THEN** send `SET_VOLTAGE_3_3V`, then close the transport

#### Scenario: Teardown command fails
- **WHEN** a safety command fails during disconnect
- **THEN** continue remaining safety actions and close transport, reporting cleanup failures

### Requirement: FlashGBX firmware profile with probed capabilities
系统 SHALL 提供 GBFlash 与 `flashgbx.cfw` 配置，并将握手事实解析为会话能力。端口 VID/PID SHALL 只作为串口定位和诊断线索。

#### Scenario: Capabilities derived from handshake
- **WHEN** 握手返回 `cart_power_ctrl = false`
- **THEN** 会话的电源控制能力为不可用

#### Scenario: Audio write-enable capability per device
- **WHEN** 连接 GBFlash 且 `pcb_ver < 13` 并具备 `cart_power_ctrl`
- **THEN** AUDIO/VIN 写使能不可用

#### Scenario: 0483:5740 remains STC
- **WHEN** 用户选择 VID/PID 为 `0483:5740` 的串口
- **THEN** 系统将其作为 STC 端口线索记录，实际运行的协议由已保存的选项决定

### Requirement: GBFlash handshake
仅当选择的 variant 为 GBFlash 时，系统 SHALL 执行 GBFlash 握手。该路径 SHALL 按 VID/PID 区分 CH340（`1A86:7523`）和 CDC（`16C0:27DD`），禁止 ChisFlash DTR/RTS 复位脉冲及跨协议回退。

#### Scenario: CH340 GBFlash
- **WHEN** 设置选择 GBFlash 且打开 `1A86:7523` 串口
- **THEN** 发送 `0xA1` 并以 `isCdc = false` 解析固件信息

#### Scenario: CDC GBFlash
- **WHEN** 设置选择 GBFlash 且打开 `16C0:27DD` 串口
- **THEN** 发送 `0xA1` 并以 `isCdc = true` 解析固件信息

#### Scenario: Shared USB identity with another selected device
- **WHEN** 设置选择 Beggar 设备且所选串口的 VID/PID 匹配 GBFlash 端口线索
- **THEN** 记录不匹配，执行所选 Beggar 路径，且禁止发送 FlashGBX 握手

#### Scenario: Unsupported firmware
- **WHEN** 握手返回版本低于 `DEVICE_MIN_FW`，或 `cfw_id != 'L'`
- **THEN** 以 `unsupported` 失败并说明原因，端口关闭

#### Scenario: Handshake failure reports stage
- **WHEN** 握手任一步无响应或响应非法
- **THEN** 保留失败阶段，尽力清空缓冲并关闭端口，用户可立即重试

### Requirement: FlashGBX port filtering preset
系统 SHALL 使用 `1A86:7523` 和 `16C0:27DD` 优先定位 GBFlash 候选串口，并提供选择其他串口的路径。

#### Scenario: Discover ports
- **WHEN** 用户在 GBFlash 配置下发起连接
- **THEN** 系统向串口选择流程传递这两组 VID/PID 作为优先过滤条件

#### Scenario: User selects a port outside the preferred filter
- **WHEN** 用户在 GBFlash 配置下手动选用过滤范围之外的串口
- **THEN** 系统记录不匹配，并仅在用户明确选择该端口后按 GBFlash 配置尝试连接
