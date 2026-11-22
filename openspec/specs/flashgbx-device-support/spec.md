# flashgbx-device-support Specification

## Purpose

支持 FlashGBX（GBFlash CH340 `1A86:7523` 与 CDC `16C0:27DD`）作为一等可配置设备类型：设备发现、握手、能力探测、波特率策略。读写操作由后续 change 提供。

## Requirements

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
