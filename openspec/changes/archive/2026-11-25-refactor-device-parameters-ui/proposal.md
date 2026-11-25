# Proposal

## Why

设备选择、波特率和封包设置目前分别依赖旧固件 ID、独立字段和组件特判。设置存储与界面需要和新的设备模型对齐，并迁移现有用户配置。

## What Changes

- 在高级设置提供对应四个 `DeviceFirmwareBinding` 的 variant 选项，并持久化单一 `variantId`，并区分保存的选择与活动会话实际使用的配置。
- 将 core 已提供的 ParameterStore 从 legacy adapter 迁移到 v2 namespace storage，并通过参数 schema 提供默认值、校验和表单渲染，以及 STM 与 Boost 的共用封包设置。
- **BREAKING** 以独立 Boost 选项替换旧探测开关。旧 `stm` 选择直接迁移到标准 STM，旧设置迁移为 v2；P1/P2 使用 core read-only legacy SelectionProvider，不写新 variant 值。需要 Boost 的用户在高级设置直接选择「丐中丐（Boost）」。
- 将操作和工具界面改用解析后的能力，清理仅用于过渡的固件标志和设置别名。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `burner-settings-ui`：四个选项、会话显示、生效时机和能力驱动的操作入口。
- `settings-data-driven`：参数 schema、共用封包存储、旧设置迁移和兼容门面。
- `flashcart-profile-selection`：通过烧录卡数据库能力控制 profile 选择和应用。

## Impact

依赖 core 提供的 legacy-backed ParameterStore/SelectionProvider；lifecycle 可先按该稳定接口交付，本 change 随后提供 schema 表单与迁移。影响 `AdvancedSettings`、高级设置弹窗、烧录操作与工具面板、五种语言文案、`localStorage` 及相关测试。
