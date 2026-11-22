## REMOVED Requirements

### Requirement: Profiles only on FlashGBX devices

**Reason**: 判定依据从固件身份 `capabilities.nativeFlashgbxProtocol` 迁移到解析后的 `profile.flashcartDb` 能力，身份字段在 P4 删除。

**Migration**: 由本 change 新增的 `Profiles only when flashcart database capability is available` 取代；GBFlash 会话继续可用，Beggar 会话继续不可用，行为不变。

## ADDED Requirements

### Requirement: Profiles only when flashcart database capability is available
烧录卡 profile 的选择和应用 SHALL 要求活动会话具备 `profile.flashcartDb` 能力。该能力由固件声明提供：当前仅 `flashgbx.cfw` 声明 supported，标准 STM、STM-Boost 与 STC 均未声明（解析为不可用）。

#### Scenario: Beggar device
- **WHEN** 活动会话是标准 STM、STM-Boost 或 STC
- **THEN** Chip Operations 隐藏 profile 选择器，适配器忽略外部传入的 profile 选项

#### Scenario: Session provides the flashcart database capability
- **WHEN** GBFlash 会话声明烧录卡数据库能力
- **THEN** 界面与适配器都允许使用适用的烧录卡 profile，并继续验证电压与写引脚要求

#### Scenario: Capability is the only gate
- **WHEN** 检查 profile 选择器是否可用
- **THEN** 只读取 `has('profile.flashcartDb')`，不读取固件 ID 或 `nativeFlashgbxProtocol`
