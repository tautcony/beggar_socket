# Spec Delta

## Purpose

支持 FlashGBX（`LK_Device` 家族：GBxCart RW、GBFlash、Joey Jr）作为一等可配置设备类型：设备发现、按家族握手、能力探测、波特率策略。读写操作由后续 change 提供。

## ADDED Requirements

### Requirement: FlashGBX firmware profile with probed capabilities
系统 SHALL 支持 `'flashgbx'` 作为可配置固件 profile，并在握手后以探测结果生成运行时 capabilities，而不是使用静态值。

#### Scenario: Capabilities derived from handshake
- **WHEN** 握手返回 `cart_power_ctrl = false`
- **THEN** 运行时 profile 的 `cartPowerControl` 为 `false`

#### Scenario: Audio write-enable capability per device
- **WHEN** 连接 GBFlash 且 `pcb_ver < 13` 并具备 `cart_power_ctrl`
- **THEN** `audioWePin` 为 `false`

#### Scenario: Joey Jr VID/PID is not treated as STC
- **WHEN** 用户选择 `flashgbx` 并连接 `0483:5740`
- **THEN** 系统按 FlashGBX 流程处理，而不是识别为 `stc`

### Requirement: Family-specific handshake
系统 SHALL 按 USB VID/PID 对应家族执行握手，且 SHALL NOT 执行 ChisFlash 的 DTR/RTS 复位脉冲，也 SHALL NOT 回退到 ChisFlash 命令。

#### Scenario: GBxCart RW
- **WHEN** 连接 `1A86:7523` 且设备为 GBxCart RW
- **THEN** 依次发送 `0x68`、`0x56`、`0xA1`，解析固件信息

#### Scenario: CH340 GBFlash falls back
- **WHEN** 连接 `1A86:7523` 且 `0x68` 无响应或判为不匹配
- **THEN** 回退为 GBFlash 流程，直接发送 `0xA1`（不发 `0x68`/`0x56`）

#### Scenario: CDC GBFlash
- **WHEN** 连接 `16C0:27DD`
- **THEN** 直接发送 `0xA1`

#### Scenario: Joey Jr
- **WHEN** 连接 `0483:5740`
- **THEN** 发送 `0x55 0xAA`，等待后读取全部可用字节，校验含 `"Joey"` 与 `"FW L"`，必要时发送 `"LK"` 并期待 `0xFF`，再发送 `0xA1`

#### Scenario: Unsupported firmware
- **WHEN** 设备为原版 GBxCart 固件（`pcb < 5 && ofw > 0`）或 JoeyGUI
- **THEN** 以 `unsupported` 失败并说明原因，端口关闭

#### Scenario: Handshake failure reports stage
- **WHEN** 握手任一步无响应或响应非法
- **THEN** 抛出带 `stage` 的错误，关闭端口并清空缓冲，用户可立即重试

### Requirement: Baud rate strategy
`flashgbx` 连接 SHALL 支持 `auto`、`1000000`、`1500000`、`2000000`。`auto` 下 GBxCart RW SHALL 以 1M 打开，识别为 `pcb ∈ {5,6,101}` 时发送 `0x3E` 并以 1.5M 重开；GBFlash（CH340）SHALL 以 2M 打开；CDC 设备忽略波特率。固定速率时 SHALL 只按所选值尝试。

#### Scenario: GBxCart auto upgrade
- **WHEN** `auto` 下 GBxCart RW（`pcb=5`）以 1M 握手成功
- **THEN** 发送 `0x3E`，关闭并以 1.5M 重开，用 `0x56` 复验后继续

#### Scenario: Upgrade failure keeps working link
- **WHEN** 升速后复验失败
- **THEN** 回到 1M 并继续使用，且封包大小保持保守值

#### Scenario: CDC ignores baud
- **WHEN** 连接 Joey Jr 或 CDC GBFlash
- **THEN** 波特率设置不影响结果

### Requirement: FlashGBX port filtering preset
系统 SHALL 提供覆盖 `1A86:7523`、`16C0:27DD`、`0483:5740` 的端口过滤预设，并在 `flashgbx` 连接时通过 `select()` 透传。

#### Scenario: Discover ports
- **WHEN** 用户在 `flashgbx` 下发起连接
- **THEN** 端口选择器只包含上述三组 VID/PID

### Requirement: Disconnect sequence
断开 SHALL 按设备家族执行参考 `Close()` 的收尾（Joey Jr 发 `KL` 并读 1 字节；恢复 3.3V / 在支持时断电），最后关闭端口。

#### Scenario: Joey Jr disconnect
- **WHEN** 用户断开 Joey Jr
- **THEN** 发送 `KL` 后关闭端口

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
