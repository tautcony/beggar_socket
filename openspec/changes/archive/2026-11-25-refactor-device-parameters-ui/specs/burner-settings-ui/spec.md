## ADDED Requirements

### Requirement: Explicit device and firmware selection in Advanced Settings
高级设置 SHALL 提供丐中丐、丐中丐（Boost）、碳酸丐和 GBFlash 四个持久化 variant 选项。每项 SHALL 原子对应一个已注册 `DeviceFirmwareBinding`，存储单一 `variantId`；标准 STM 和 Boost 共用封包参数。连接流程读取保存的 variant。

#### Scenario: Select the Boost variant
- **WHEN** 用户在高级设置选择丐中丐（Boost）并保存
- **THEN** 下次连接使用 `beggar.stm-boost`，封包编辑继续读取共用的 STM 设置

#### Scenario: Localized variant selection
- **WHEN** 用户在任一受支持语言打开高级设置
- **THEN** 四个选项、连接生效提示和相关参数均有可读的本地化标签

### Requirement: Operation controls follow session capabilities
操作和工具入口 SHALL 根据活动会话的能力显示可用状态与原因。执行层 SHALL 遵守同一能力约束。

#### Scenario: Session lacks a tool capability
- **WHEN** 活动会话不具备所请求的工具能力
- **THEN** 界面禁用该入口或说明原因，执行层拒绝该操作

#### Scenario: RTC support is available without PPB unlock
- **WHEN** 活动会话具备 RTC 能力且缺少 PPB 解锁能力
- **THEN** RTC 入口仍可用，PPB 解锁入口禁用

## MODIFIED Requirements

### Requirement: Active firmware profile display and reconnect notice
高级设置 SHALL 显示活动会话绑定的设备和固件，并说明保存的新选择在下次连接或重新建立会话后生效。

#### Scenario: Connected device displays effective firmware profile
- **WHEN** 用户在连接状态打开高级设置
- **THEN** 设置界面显示活动会话实际使用的设备与固件，并显示新选择的生效时机

#### Scenario: Profile change does not mutate active connection immediately
- **WHEN** 用户在连接期间保存另一设备或固件选项
- **THEN** 新设置持久化供未来的会话使用，活动会话继续使用已经绑定的选项

### Requirement: FlashGBX firmware profile and connection options in Advanced Settings
高级设置 SHALL 提供 GBFlash 选项、对应的波特率（`auto`、1M、1.5M、2M）和独立的 GBFlash 封包编辑。旧设置缺失波特率时 SHALL 使用 `auto`。所有相关文案 SHALL 覆盖现有五种语言。

#### Scenario: Select FlashGBX
- **WHEN** 用户选择 GBFlash、配置波特率并保存
- **THEN** 设置被持久化并于下次连接生效

#### Scenario: Edit FlashGBX packet sizes
- **WHEN** 用户打开 GBFlash 的封包编辑
- **THEN** 显示并校验 GBFlash 的封包设置，与 Beggar 封包设置独立

#### Scenario: Legacy settings load
- **WHEN** 载入缺少 FlashGBX 波特率的旧设置
- **THEN** 默认使用 `auto`，保留旧 STM 和 STC 封包设置

#### Scenario: Locale completeness
- **WHEN** 运行 i18n 校验
- **THEN** 五种语言均包含相关文本键

### Requirement: Cartridge profile selector in Chip Operations
当活动会话具备烧录卡数据库能力时，Chip Operations SHALL 显示按模式过滤的 profile 选择器。默认选项 SHALL 为 `Auto (CFI)`，`profile_ambiguous` SHALL 显示候选列表。选择器 SHALL NOT 以固件身份或 `nativeFlashgbxProtocol` 作为显示条件。

#### Scenario: Mode switch
- **WHEN** 用户在 `GBA` 与 `MBC5` 之间切换
- **THEN** 选项更新为 `AGB` 或 `DMG` profile，不兼容的手动选择重置为 `Auto (CFI)`

#### Scenario: Architecture boundary
- **WHEN** 选择器渲染并提交选项
- **THEN** 操作面板通过既有呈现契约交互

#### Scenario: Hidden on ChisFlash
- **WHEN** 活动会话缺少烧录卡数据库能力（标准 STM、STM-Boost 或 STC）
- **THEN** 操作面板隐藏选择器，适配器忽略外部传入的 profile 选项

### Requirement: FlashGBX packet size upper bound
GBFlash 封包大小上限 SHALL 由 `gbflash.cfw` 参数 descriptor 的 `constraints.max`（`0x2000`）声明，不再由全局校验统一限制。该上限只约束可编辑值，实际传输仍按宿主与 CH340/CDC 帧限制收窄。

#### Scenario: Packet size upper bound
- **WHEN** 用户为 GBFlash 输入 `0x2000`
- **THEN** 校验通过；输入超过 `0x2000` 被拒绝，且同一规则只作用于 GBFlash 参数命名空间

#### Scenario: Beggar upper bound unchanged
- **WHEN** 用户在丐中丐或碳酸丐上编辑封包大小
- **THEN** 沿用既有范围校验，不受 GBFlash `0x2000` 上限影响
