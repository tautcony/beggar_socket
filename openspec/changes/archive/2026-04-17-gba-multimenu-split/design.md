## Context

`GBAMultiMenuView.vue` 是 GBA 多合一菜单 ROM 构建工具的主视图，承载了从游戏选择到 ROM 构建下载的完整流程。当前 1815 行全部集中在单个 SFC 文件中。代码审查 (review-2026-04-17 Phase 3 P1-03) 将其标记为 P1 级别可维护性问题。

文件内部可识别的独立区域：
- 游戏 ROM 列表管理（行 53-188）：文件拖拽、列表排序、单项配置编辑
- 存档文件管理（行 189-249）：存档文件拖拽、列表展示
- 构建配置（行 250-384）：基础配置、菜单 ROM 配置、背景图片配置
- 构建与下载（行 385-422）：构建按钮、进度、结果下载
- 背景图片预览（行 423+）：图片预览 modal

## Goals / Non-Goals

**Goals:**
- 将 GBAMultiMenuView.vue 从 1815 行缩减至约 200 行的布局编排器
- 每个子组件职责单一，可独立理解和测试
- 子组件间通过 props/emits 或共享 composable 通信
- 保持完全相同的用户可见行为和 UI 外观
- 保持所有 i18n key 不变

**Non-Goals:**
- 不重新设计 UI 布局或交互流程
- 不改变构建逻辑的实现细节
- 不引入新的状态管理（如 Pinia store）
- 不拆分样式为独立文件（CSS 随组件走）
- 不拆分 `RomAssemblyView.vue`（不在本变更范围内）

## Decisions

### D1: 子组件划分

| 子组件 | 职责 | 关键 props/emits |
|--------|------|-----------------|
| `GameRomPanel` | 游戏 ROM 列表：拖拽添加、排序、删除、配置编辑 | `v-model:games`, `@config-change` |
| `SaveFilePanel` | 存档文件列表：拖拽添加、删除 | `v-model:saveFiles` |
| `BgImageUploader` | 背景图片：上传、裁剪、预览 | `v-model:bgImage`, `@preview` |
| `RomBuildPanel` | 构建配置、构建按钮、结果下载 | `:games`, `:saveFiles`, `:bgImage`, `:buildConfig`, `@build`, `@download` |

### D2: 状态管理策略

采用 composable + props/emits 模式（不引入 Pinia store）：

- `useMultiMenuState()` composable 封装核心响应式状态：游戏列表、存档列表、背景图片、构建配置、构建结果
- 主视图 `GBAMultiMenuView.vue` 调用 composable 获取状态，通过 props 分发给子组件
- 子组件通过 emits 或 `v-model` 反馈状态变更
- 构建逻辑保留在 composable 中，`RomBuildPanel` 通过 emit 触发

### D3: 文件组织

```
views/
  GBAMultiMenuView.vue          # 布局编排器 (~200 行)
  gba-multi-menu/
    GameRomPanel.vue            # 游戏列表与配置
    SaveFilePanel.vue           # 存档管理
    BgImageUploader.vue         # 背景图片处理
    RomBuildPanel.vue           # 构建与下载
composables/
  useMultiMenuState.ts          # 共享状态逻辑
```

子组件放在 `views/gba-multi-menu/` 目录下而非 `components/`，因为它们是该视图的专属子组件，不具通用性。

### D4: 样式拆分策略

- 每个子组件携带自己的 scoped 样式
- 全局布局样式（`.gba-multi-menu-view`, `.gba-multi-menu-content`, `.page-header`）保留在主视图
- 加载遮罩样式保留在主视图

## Risks / Trade-offs

- [风险] 拆分过程中 props 传递层级可能增加模板冗余 → 可用 `v-model` 语法糖减少样板代码
- [风险] 游戏配置编辑涉及多个字段联动，拆分后跨组件联动可能复杂化 → composable 集中管理状态，子组件只负责 UI
- [取舍] 不引入 Pinia store 意味着状态刷新依赖 props drilling → 当前子组件层级只有一层，props drilling 可接受
- [取舍] 子组件放在 views/ 下而非 components/ → 语义更清晰但与部分项目约定不同
