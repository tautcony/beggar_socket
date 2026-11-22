# Spec Delta

## ADDED Requirements

### Requirement: FlashGBX firmware profile and connection options in Advanced Settings
高级设置 SHALL 提供 `flashgbx` 固件选项；选中时显示波特率（`auto`/1M/1.5M/2M），并在封包大小编辑中提供 `flashgbx` 页签（默认保守值）。旧版缺少这些字段的持久化设置 SHALL 回落默认；三个固件 profile 共存时「其他 profile」逻辑 SHALL 不再假设仅有两个。全部文案 SHALL 覆盖 5 种语言。

#### Scenario: Select FlashGBX
- **WHEN** 用户选择 `flashgbx`、配置波特率并保存
- **THEN** 设置被持久化并在下次连接生效

#### Scenario: Edit FlashGBX packet sizes
- **WHEN** 用户切换到 `flashgbx` 页签
- **THEN** 显示并校验封包大小，与 `stm`/`stc` 独立

#### Scenario: Legacy settings load
- **WHEN** 载入不含 `flashgbxBaudRate` 的旧设置
- **THEN** 使用默认 `auto`，`stm`/`stc` 设置不变

#### Scenario: Locale completeness
- **WHEN** 运行 i18n 校验
- **THEN** 5 种语言均包含新增键
