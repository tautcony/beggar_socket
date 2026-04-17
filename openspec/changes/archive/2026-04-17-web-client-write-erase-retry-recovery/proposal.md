## Why

当前 `web-client` 的 Burner ROM 写入流程在读失败场景已有重试，但写入与扇区擦除仍是“一次失败即整次操作失败”。一旦写入在区块中途超时，芯片可能处于“当前扇区已被部分编程但尚未完成”的状态，用户只能手动重新擦除再重试，且 UI 无法明确显示恢复阶段。

## What Changes

- 为 ROM 扇区擦除增加可配置的失败重试能力，避免单次超时直接终止整次写入准备
- 为 ROM 写入增加按区块/扇区的失败重试能力；若失败区块所在扇区已存在部分写入，则先重新擦除该扇区，再从该扇区起点恢复写入
- 保持 ROM 写入的大流程为“先完整擦除目标范围，再开始线性写入”，但在写失败时支持当前扇区的局部回滚与恢复重试
- 为扇区进度引入更明确的擦除状态语义，用于擦除流程和恢复性重擦除阶段；普通写入流程仍保持清晰的写入进度语义
- 为高级设置增加写入重试、擦除重试与重试延迟配置，并补齐对应验证覆盖

## Capabilities

### New Capabilities
- `burner-write-recovery`: 定义 Burner ROM 写入在区块写入失败、扇区擦除失败、局部回滚和按扇区恢复重试下的行为契约

### Modified Capabilities
- `burner-application-orchestration`: Burner 进度与会话契约需要支持新的恢复阶段和恢复式写入语义

## Impact

- 重点代码范围：`web-client/src/services/gba-adapter.ts`, `web-client/src/services/mbc5-adapter.ts`, `web-client/src/utils/progress/`, `web-client/src/types/progress-info.ts`, `web-client/src/settings/advanced-settings.ts`, `web-client/src/components/progress/SectorVisualization.vue`, `web-client/src/components/modal/AdvancedSettingsModal.vue`
- 重点测试范围：`web-client/tests/mbc5-adapter.test.ts`, `web-client/tests/protocol-transport.test.ts`, `web-client/tests/burner-application.test.ts`, 新增写入/擦除恢复专项测试
- 用户可见变化：写入失败后会显示恢复阶段与重试信息，不再总是要求手工先擦除再重新开始
