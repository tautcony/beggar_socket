## Why

`GBAMultiMenuView.vue` 是项目中最大的单文件组件（1815 行），承载了 5 个以上的独立职责：游戏 ROM 列表管理与配置编辑、存档文件处理、背景图片上传/裁剪/预览、构建配置选项、ROM 构建与结果下载。模板约 430 行，脚本约 1000 行，样式约 380 行。单文件内多职责混合导致定位具体逻辑困难，修改一个功能可能意外影响其他功能，且单元测试极难编写。

## What Changes

- 将 `GBAMultiMenuView.vue` 拆分为 4 个子组件和 1 个 composable
- 主视图保留为布局编排器，负责子组件组合和全局状态分发
- 游戏 ROM 列表与配置提取为 `<GameRomPanel>`
- 存档文件管理提取为 `<SaveFilePanel>`
- 背景图片上传/裁剪/预览提取为 `<BgImageUploader>`
- 构建选项与结果下载提取为 `<RomBuildPanel>`
- 共享的视图状态逻辑提取为 `useMultiMenuState()` composable

## Capabilities

### New Capabilities
- `multimenu-component-split`: 定义 GBAMultiMenuView 拆分后的组件结构、职责划分和状态通信规范

### Modified Capabilities

## Impact

- `views/GBAMultiMenuView.vue` — 大幅缩减至约 200 行的布局编排器
- 新增 `views/gba-multi-menu/GameRomPanel.vue` (~350 行)
- 新增 `views/gba-multi-menu/SaveFilePanel.vue` (~200 行)
- 新增 `views/gba-multi-menu/BgImageUploader.vue` (~300 行)
- 新增 `views/gba-multi-menu/RomBuildPanel.vue` (~250 行)
- 新增 `composables/useMultiMenuState.ts` (~200 行)
- 纯结构重构，不改变用户可见行为
- 可能需要更新相关 i18n key 的引用路径（key 本身不变）
