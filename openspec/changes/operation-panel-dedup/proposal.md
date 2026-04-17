## Why

`GBAOperationPanel.vue` 和 `GBCOperationPanel.vue` 有 60+ 行重复 CSS（按钮组样式、面板布局、响应式断点），以及重复的 blank-check 逻辑模式。修改样式时需双份同步更新。

## What Changes

- 提取共享 CSS 到 `operation-panel-shared.scss` 或公共 CSS class
- 提取 blank-check 共享逻辑到 composable
- 两个面板组件引用共享样式和逻辑

## Capabilities

### New Capabilities
- `operation-panel-shared-styles`: 操作面板共享样式模块

### Modified Capabilities

## Impact

- `styles/operation-panel-shared.scss` — 新增
- `composables/useBlankCheck.ts` — 新增（如果逻辑重复足够多）
- `GBAOperationPanel.vue` — 删除重复样式和逻辑
- `GBCOperationPanel.vue` — 删除重复样式和逻辑
