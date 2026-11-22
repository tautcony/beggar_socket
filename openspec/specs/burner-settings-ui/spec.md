# burner-settings-ui Specification

## Purpose
Expose firmware profile status and ROM read page size configuration in the advanced settings UI so users can configure read chunk sizes and understand when firmware profile changes take effect.

## Requirements

### Requirement: ROM read page size editing control
The advanced settings modal SHALL provide an editing control for `romReadPageSize` that loads the persisted setting, validates user input against configured bounds, and persists changes on save.

#### Scenario: User updates ROM read page size in advanced settings
- **WHEN** the user opens the advanced settings modal, changes the ROM read page size to a valid value, and saves settings
- **THEN** the updated `romReadPageSize` value is persisted and used by subsequent ROM read operations

#### Scenario: Invalid ROM read page size input is rejected
- **WHEN** the user enters an out-of-range or invalid ROM read page size in the advanced settings modal
- **THEN** the modal displays validation feedback and prevents saving until a valid value is entered

### Requirement: Active firmware profile display and reconnect notice
The advanced settings modal SHALL display the active connection's effective firmware profile (when connected) and clearly indicate that manual firmware profile changes apply upon reconnect or connection re-initialization.

#### Scenario: Connected device displays effective firmware profile
- **WHEN** a device is connected and the user opens the advanced settings modal
- **THEN** the firmware settings section displays the effective firmware profile bound to the current connection alongside a notice that changing the selected profile takes effect after reconnecting or re-initializing the connection

#### Scenario: Profile change does not mutate active connection immediately
- **WHEN** the user changes the firmware profile setting from STM to STC (or vice versa) while a device is connected and saves settings
- **THEN** the persisted setting is updated for future connections/re-initializations while the active connection retains its bound effective profile until reconnected or re-initialized

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

### Requirement: FlashGBX packet size upper bound
高级设置 SHALL 允许 `flashgbx` 封包大小上限至 `0x2000`。

#### Scenario: Packet size upper bound
- **WHEN** 用户为 `flashgbx` 输入 `0x2000`
- **THEN** 校验通过，输入超过 `0x2000` 被拒绝

### Requirement: Cartridge profile selector in Chip Operations
当设备具备 `nativeFlashgbxProtocol` 时，Chip Operations SHALL 显示按模式过滤的 profile 选择器，默认 `Auto (CFI)`；`profile_ambiguous` 错误 SHALL 以候选列表形式提示用户选择。

#### Scenario: Mode switch
- **WHEN** 用户在 `GBA` 与 `MBC5` 之间切换
- **THEN** 选项更新为 `AGB` 或 `DMG` profile，不兼容的手动选择重置为 `Auto (CFI)`

#### Scenario: Architecture boundary
- **WHEN** 选择器渲染与发出选择
- **THEN** `ChipOperations.vue` 只通过 `contracts.ts` 交互，不导入 `platform/`、`services/`

#### Scenario: Hidden on ChisFlash
- **WHEN** 当前设备为 `stm` 或 `stc`
- **THEN** 不显示选择器
