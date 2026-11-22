# Spec Delta

## Purpose

支持 FlashGBX（GBFlash CH340 `1A86:7523` 与 CDC `16C0:27DD`）作为一等可配置设备类型：设备发现、握手、能力探测、波特率策略。读写操作由后续 change 提供。

## ADDED Requirements

### Requirement: FlashGBX firmware profile with probed capabilities
系统 SHALL 支持 `'flashgbx'` 作为可配置固件 profile，并在握手后以探测结果生成运行时 capabilities，而不是使用静态值。

#### Scenario: Capabilities derived from handshake
- **WHEN** 握手返回 `cart_power_ctrl = false`
- **THEN** 运行时 profile 的 `cartPowerControl` 为 `false`

#### Scenario: Audio write-enable capability per device
- **WHEN** 连接 GBFlash 且 `pcb_ver < 13` 并具备 `cart_power_ctrl`
- **THEN** `audioWePin` 为 `false`

#### Scenario: 0483:5740 remains STC
- **WHEN** 连接 `0483:5740`
- **THEN** 系统仍将其识别为 `stc`，不受 `flashgbx` 选项影响

### Requirement: GBFlash handshake
系统 SHALL 按 USB VID/PID 区分 CH340（`1A86:7523`）与 CDC（`16C0:27DD`）并执行 GBFlash 握手，且 SHALL NOT 执行 ChisFlash 的 DTR/RTS 复位脉冲，也 SHALL NOT 回退到 ChisFlash 命令。

#### Scenario: CH340 GBFlash
- **WHEN** 连接 `1A86:7523`
- **THEN** 直接发送 `0xA1` 并解析固件信息（`isCdc = false`）

#### Scenario: CDC GBFlash
- **WHEN** 连接 `16C0:27DD`
- **THEN** 直接发送 `0xA1` 并解析固件信息（`isCdc = true`）

#### Scenario: Unsupported firmware
- **WHEN** 握手返回 `fw_ver == 0` 或 `cfw_id != 'L'`
- **THEN** 以 `unsupported` 失败并说明原因，端口关闭

#### Scenario: Handshake failure reports stage
- **WHEN** 握手任一步无响应或响应非法
- **THEN** 抛出带 `stage` 的错误，关闭端口并清空缓冲，用户可立即重试

### Requirement: Baud rate strategy
`flashgbx` 连接 SHALL 支持 `auto`、`1000000`、`1500000`、`2000000`。`auto` 下 GBFlash（CH340）SHALL 以 2M 打开；CDC 设备忽略波特率。固定速率时 SHALL 只按所选值尝试。

#### Scenario: CH340 GBFlash auto baud
- **WHEN** `auto` 下连接 CH340 GBFlash
- **THEN** 直接以 `2000000` 波特率打开端口

#### Scenario: CDC ignores baud
- **WHEN** 连接 CDC GBFlash
- **THEN** 波特率设置不影响结果

### Requirement: FlashGBX port filtering preset
系统 SHALL 提供覆盖 `1A86:7523` 与 `16C0:27DD` 的端口过滤预设，并在 `flashgbx` 连接时通过 `select()` 透传。

#### Scenario: Discover ports
- **WHEN** 用户在 `flashgbx` 下发起连接
- **THEN** 端口选择器只包含上述两组 VID/PID

### Requirement: Disconnect sequence
断开 SHALL 执行恢复 3.3V / 在支持 `cart_power_ctrl` 时发送 `CART_PWR_OFF` 的收尾，最后关闭端口。

#### Scenario: GBFlash disconnect
- **WHEN** 用户断开 GBFlash
- **THEN** 在支持时发送 `CART_PWR_OFF`（否则发送 `SET_VOLTAGE_3_3V`）后关闭端口

### Requirement: Operations guarded until adapters exist
适配器上线前，`flashgbx` 连接下所有烧录/读写操作 SHALL 返回 `unsupported`；SHALL NOT 路由到 ChisFlash 适配器，SHALL NOT 触发 DTR/RTS 脉冲；ChisFlash 直连的工具与调试入口 SHALL 对 `flashgbx` 禁用。

#### Scenario: Operation on connected FlashGBX device
- **WHEN** 已以 `flashgbx` 连接并触发读 ID 或写 ROM
- **THEN** 返回 `unsupported`，设备不收到任何 ChisFlash 字节，也无 DTR/RTS 变化

#### Scenario: Debug and tool entries disabled
- **WHEN** 当前为 `flashgbx` 连接
- **THEN** 调试弹窗与工具函数入口不可用

#### Scenario: ChisFlash paths unaffected
- **WHEN** 用户使用 `stm` 或 `stc`
- **THEN** 行为、默认设置与现有测试结果保持不变
