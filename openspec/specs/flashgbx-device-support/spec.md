# flashgbx-device-support Specification

## Purpose

支持 FlashGBX（GBFlash CH340 `1A86:7523` 与 CDC `16C0:27DD`）作为一等可配置设备类型：设备发现、握手、能力探测、波特率策略。读写操作由后续 change 提供。

## Requirements

### Requirement: FlashGBX firmware profile with probed capabilities
系统 SHALL 提供 GBFlash 与 `gbflash.cfw` 配置，并将握手事实解析为会话能力。端口 VID/PID SHALL 只作为串口定位和诊断线索。

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

### Requirement: Baud rate strategy
`flashgbx` 连接 SHALL 支持 `auto`、`1000000`、`1500000`、`2000000`。`auto` 下 GBFlash（CH340）SHALL 以 2M 打开；CDC 设备忽略波特率。固定速率时 SHALL 只按所选值尝试。

#### Scenario: CH340 GBFlash auto baud
- **WHEN** `auto` 下连接 CH340 GBFlash
- **THEN** 直接以 `2000000` 波特率打开端口

#### Scenario: CDC ignores baud
- **WHEN** 连接 CDC GBFlash
- **THEN** 波特率设置不影响结果

### Requirement: FlashGBX port filtering preset
系统 SHALL 使用 `1A86:7523` 和 `16C0:27DD` 优先定位 GBFlash 候选串口，并提供选择其他串口的路径。

#### Scenario: Discover ports
- **WHEN** 用户在 GBFlash 配置下发起连接
- **THEN** 系统向串口选择流程传递这两组 VID/PID 作为优先过滤条件

#### Scenario: User selects a port outside the preferred filter
- **WHEN** 用户在 GBFlash 配置下手动选用过滤范围之外的串口
- **THEN** 系统记录不匹配，并仅在用户明确选择该端口后按 GBFlash 配置尝试连接

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

### Requirement: Command channel without ChisFlash signalling
FlashGBX 适配器 SHALL 覆写通道复位逻辑，在任何操作前后 SHALL NOT 脉冲 DTR/RTS。

#### Scenario: Operation start
- **WHEN** 在 `flashgbx` 设备上开始任意读写操作
- **THEN** 仅进行输入/输出缓冲清理，不产生 DTR/RTS 变化

### Requirement: Frame layer buffer limits
系统 SHALL 按 GBFlash 传输模式调整读写上限：CH340 模式读上限 `0x1000`、写上限 `0x80`；CDC 模式读上限 `0x1000`、写上限 `0x400`。

#### Scenario: CH340 GBFlash limits
- **WHEN** 连接 CH340 GBFlash（`isCdc = false`）
- **THEN** 读上限 `0x1000`、写上限 `0x80`

#### Scenario: CDC GBFlash limits
- **WHEN** 连接 CDC GBFlash（`isCdc = true`）
- **THEN** 读上限 `0x1000`、写上限 `0x400`

### Requirement: Voltage and cartridge power control
系统 SHALL 在 `cartPowerControl` 为真的设备上支持 3.3V/5V 电压与电源开关/查询，并 SHALL 在操作结束或失败时恢复进入前的电压与电源状态。

#### Scenario: 5V DMG operation
- **WHEN** MBC/DMG 操作需要 5V 且设备支持电源控制
- **THEN** 设置 5V 并循环电源后访问卡带，结束（含失败/取消）后恢复

#### Scenario: No power control
- **WHEN** 设备 `cartPowerControl = false`
- **THEN** 不发送电源命令，需要电源循环的操作给出明确提示

### Requirement: Auto power-off keep-alive
长操作期间系统 SHALL 续期 `AUTO_POWEROFF_TIME`，并 SHALL 在操作结束或断开时清零。

#### Scenario: Long write
- **WHEN** 写入耗时超过设备自动断电间隔
- **THEN** 续期使设备持续供电

### Requirement: GBA and DMG ROM/save operations
系统 SHALL 提供满足 `BurnerProtocolSession` 的 `FlashgbxGbaAdapter` 与 `FlashgbxMbcAdapter`，支持 ID/CFI 读取、扇区/整片擦除、ROM 读/写/校验（含 `CALC_CRC32 0xD5`，按 `0x20000` 分块）及存档（SRAM、FRAM、Flash、EEPROM、GBA RTC）的读写校验；AGB 地址 SHALL 按字寻址。

#### Scenario: GBA ROM write and CRC verify
- **WHEN** 写入并校验 GBA ROM
- **THEN** 擦除所需扇区，通过 `0xA7`/`0xD3`/`0xD4`/`0xD2` 编程，并用 `0xD5` 校验

#### Scenario: DMG ROM and SRAM
- **WHEN** 读写 DMG/GBC ROM 或 SRAM/FRAM
- **THEN** 通过 `0xB8`/`0xB4`/`0xB3`/`0xB2`/`0xD1` 完成 bank 切换与传输

#### Scenario: Cancel or failure cleanup
- **WHEN** 操作被取消或失败
- **THEN** 执行适配器级复位并恢复电压/电源，设备可再次操作

#### Scenario: Multi-step transactions are serialized
- **WHEN** 同一设备同时发起多个操作
- **THEN** 多步 LK 事务按会话互斥锁串行，字节流不交错

#### Scenario: ChisFlash paths unaffected
- **WHEN** 用户使用 `stm` 或 `stc`
- **THEN** 行为、默认设置与现有测试结果保持不变
