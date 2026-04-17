## Why

`FlashEmulator.vue`、`SRAMEmulator.vue`、`EEPROMEmulator.vue` 三个组件几乎完全相同（~90% 重复），仅在芯片类型标签和少量配置项上有差异。每次修改模拟器 UI（如添加新功能或修复 bug）需同步修改三个文件，极易产生不一致。

## What Changes

- 提取 `BaseEmulator.vue` 通用组件，包含共享模板、样式和逻辑
- 三个具体模拟器组件变为轻量包装（仅传 props 差异项）
- 消除 ~500 行重复代码

## Capabilities

### New Capabilities
- `emulator-base`: 通用模拟器基础组件

### Modified Capabilities

## Impact

- `components/emulators/BaseEmulator.vue` — 新增
- `components/emulators/FlashEmulator.vue` — 简化为包装组件
- `components/emulators/SRAMEmulator.vue` — 简化为包装组件
- `components/emulators/EEPROMEmulator.vue` — 简化为包装组件
- 纯 UI 重构，不影响业务逻辑
