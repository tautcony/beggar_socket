## REMOVED Requirements

### Requirement: Profiles only on FlashGBX devices

**Reason**: 判定依据从固件身份 `capabilities.nativeFlashgbxProtocol` 迁移到解析后的 `profile.flashcartDb` 能力，身份字段在 P4 删除。

**Migration**: 由本 change 新增的 `Profiles only when flashcart database capability is available` 取代；GBFlash 会话继续可用，Beggar 会话继续不可用，行为不变。

## ADDED Requirements

### Requirement: Profiles only when flashcart database capability is available
烧录卡 profile 的选择和应用 SHALL 要求活动会话具备 `profile.flashcartDb` 能力。该能力由固件声明提供：当前仅 `gbflash.cfw` 声明 supported，标准 STM、STM-Boost 与 STC 均显式声明为 unsupported（解析为不可用）。

#### Scenario: Beggar device
- **WHEN** 活动会话是标准 STM、STM-Boost 或 STC
- **THEN** Chip Operations 隐藏 profile 选择器，适配器忽略外部传入的 profile 选项

#### Scenario: Session provides the flashcart database capability
- **WHEN** GBFlash 会话声明烧录卡数据库能力
- **THEN** 界面与适配器都允许使用适用的烧录卡 profile，并继续验证电压与写引脚要求

#### Scenario: Capability is the only gate
- **WHEN** 检查 profile 选择器是否可用
- **THEN** 只读取 `has('profile.flashcartDb')`，不读取固件 ID 或 `nativeFlashgbxProtocol`

## MODIFIED Requirements

### Requirement: Manual profile override
用户 SHALL 能在 `ChipOperations` 选择具体 profile，覆盖 CFI/ID 探测，使用其命令集、扇区布局、缓冲区、默认电压与写引脚。GBFlash 的 DMG 模式在用户开启「强制输出5V」时 SHALL 使用 5V。关闭开关时 SHALL 恢复按 profile 选择电压。

#### Scenario: Manual selection
- **WHEN** 用户选择某 profile 并执行读 ID/擦除/写 ROM
- **THEN** 适配器使用其 `read_identifier`、`sector_erase`、`chip_erase`、`buffer_write`/`single_write`、`flash_size` 与扇区布局

#### Scenario: Manual 5V override in DMG mode
- **WHEN** GBFlash 处于 DMG 模式，用户选择 3.3V profile 并开启「强制输出5V」
- **THEN** 界面同步硬件及后续卡带操作使用 5V
- **AND** 关闭开关后恢复 3.3V

#### Scenario: Unsupported write pin
- **WHEN** profile 的 `write_pin` 为 `AUDIO` 或 `VIN` 而设备 `audioWePin` 为 `false`
- **THEN** 系统拒绝写操作并返回明确的 `unsupported` 错误

#### Scenario: Voltage mismatch
- **WHEN** profile 的 `voltage` 与设备可提供的电压不符（如设备无电源控制却需要 5V 切换）
- **THEN** 系统提示并拒绝，而不是静默继续
