## 1. Settings And Progress Model

- [x] 1.1 扩展 `AdvancedSettings` 和 `AdvancedSettingsModal`，增加 `romWriteRetryCount`、`romWriteRetryDelay`、`romEraseRetryCount`、`romEraseRetryDelay`
- [x] 1.2 扩展 `SectorProgressInfo`、`ProgressReporter` 与 `SectorVisualization`，将擦除态明确为 `pending_erase`、`erasing`、`erased` 并补齐对应文案/样式
- [x] 1.3 为进度与设置模型补单元测试，覆盖新状态编码与新重试配置的读写/校验

## 2. MBC5 Recovery Flow

- [x] 2.1 重构 `MBC5Adapter.writeROM()` 为“先完整擦除目标范围，再线性写入；失败时按扇区恢复”的流程
- [x] 2.2 为 `MBC5Adapter` 增加 ROM sector erase retry 逻辑，并在恢复性重擦除场景复用同一策略
- [x] 2.3 为 `MBC5Adapter` 增加 ROM write retry 逻辑：写失败后回滚当前扇区并从扇区起点恢复写入
- [x] 2.4 为 `MBC5Adapter` 补回归测试，覆盖整段预擦除、写超时重试、部分扇区脏写后重擦除恢复、擦除重试耗尽失败

## 3. GBA Recovery Flow

- [x] 3.1 重构 `GBAAdapter.writeROM()` 为与 MBC5 对齐的“先完整擦除目标范围，再线性写入；失败时按扇区恢复”流程
- [x] 3.2 为 `GBAAdapter` 增加 ROM sector erase retry 与恢复性重擦除逻辑
- [x] 3.3 为 `GBAAdapter` 增加 ROM write retry 逻辑，并确保大容量 bank switching 路径在恢复后仍正确
- [x] 3.4 为 `GBAAdapter` 补回归测试，覆盖整段预擦除、写失败恢复、擦除失败重试和重试耗尽错误

## 4. Verification

- [x] 4.1 运行 adapter/progress/settings 相关自动化测试
- [x] 4.2 运行 `web-client` 全量测试与生产构建
- [x] 4.3 手工验证 MBC5/GBA ROM 写入在写超时、擦除失败、恢复后继续写入时的 UI 状态与最终结果
