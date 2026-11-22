# Spec Delta

## ADDED Requirements

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
