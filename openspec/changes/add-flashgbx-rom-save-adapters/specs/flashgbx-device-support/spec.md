# Spec Delta

## ADDED Requirements

### Requirement: Command channel without ChisFlash signalling
FlashGBX 适配器 SHALL 覆写通道复位逻辑，在任何操作前后 SHALL NOT 脉冲 DTR/RTS。

#### Scenario: Operation start
- **WHEN** 在 `flashgbx` 设备上开始任意读写操作
- **THEN** 仅进行输入/输出缓冲清理，不产生 DTR/RTS 变化

### Requirement: Frame layer and ACK flow control
系统 SHALL 在 GBxCart RW（`pcb ∈ {5,6}`、`cfw_id=='L'`、`fw_ver>=16`）上支持 ACK 流控（`Synchronize`/`ConfigureACK`），并按 ACK/波特率调整读写上限；其他设备 SHALL 使用对应的非 ACK 上限。

#### Scenario: ACK enabled
- **WHEN** 设备满足条件且用户开启 ACK
- **THEN** 读上限 `0x2000`、写上限 `0x100`，传输失败时重新 `Synchronize`

#### Scenario: 1M without ACK
- **WHEN** 波特率为 1M 且 ACK 关闭
- **THEN** 读写上限均为 `0x100`

### Requirement: Voltage and cartridge power control
系统 SHALL 在 `cartPowerControl` 为真的设备上支持 3.3V/5V 电压与电源开关/查询，并 SHALL 在操作结束或失败时恢复进入前的电压与电源状态。

#### Scenario: 5V DMG operation
- **WHEN** MBC/DMG 操作需要 5V 且设备支持电源控制
- **THEN** 设置 5V 并循环电源后访问卡带，结束（含失败/取消）后恢复

#### Scenario: No power control
- **WHEN** 设备 `cartPowerControl = false`
- **THEN** 不发送电源命令，需要电源循环的操作给出明确提示

#### Scenario: Joey Jr V2 dial-controlled voltage
- **WHEN** 连接仅拨码控压的 Joey Jr V2
- **THEN** 不下发电压命令，并提示用户手动切换

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

## REMOVED Requirements

### Requirement: Operations guarded until adapters exist
**Reason**: 适配器上线后护栏被真实适配器取代。
**Migration**: `flashgbx` 连接下的操作改由 `FlashgbxGbaAdapter`/`FlashgbxMbcAdapter` 执行。
