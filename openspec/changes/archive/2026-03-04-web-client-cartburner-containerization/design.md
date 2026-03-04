## Context

`CartBurner.vue` 同时处理：
- 设备与模式状态；
- 各类读写/校验操作触发；
- progress/modal/log 等横切 UI 状态；
- 适配器初始化与错误恢复。

这种“胖组件”模式导致可测试性差、职责边界模糊，并放大后续架构改造冲击面。

## Goals / Non-Goals

**Goals:**
- 把 `CartBurner` 切分为“容器负责编排 + 展示组件负责渲染”的清晰结构。
- 将副作用（连接、读写、日志、取消）集中到容器/组合逻辑层，减少组件内流程分支。
- 稳定子组件契约，保证 UI 层不直接依赖协议/平台实现。

**Non-Goals:**
- 不在本变更中全面重做视觉设计与交互文案。
- 不替换 Burner 底层业务语义，仅调整 UI 组织方式。
- 不覆盖所有页面容器化，仅聚焦 CartBurner 主页面。

## Decisions

### Decision 1: 采用“单容器 + 多无状态子组件”结构
- 容器负责 orchestration 调用、状态聚合、事件分发。
- `ChipOperations` / `RomOperations` / `RamOperations` 等子组件保持输入输出纯粹化。
- 备选方案：拆为多个有状态容器。
  - 放弃原因：状态边界再次分裂，协调成本上升。

### Decision 2: 横切 UI 状态集中管理
- progress、modal、logs、busy 由容器统一维护，子组件通过 props/events 交互。
- 取消“子组件直接改全局状态”的路径。
- 备选方案：维持各子组件局部管理。
  - 放弃原因：跨组件一致性无法保证，取消/异常路径易遗漏。

### Decision 3: 通过 composable 封装容器流程逻辑
- 抽离可复用逻辑到 composable（例如 burner flow orchestration、file state 管理）。
- SFC 脚本层仅保留连接与视图绑定代码。
- 备选方案：直接在 SFC 内部继续组织函数。
  - 放弃原因：测试隔离度不足，复用困难。

### Decision 4: 先契约后迁移
- 先定义每个展示组件的输入输出契约，再迁移实现。
- 通过契约测试锁定行为，避免重构期 UI 回归。
- 备选方案：直接改实现再补契约。
  - 放弃原因：缺少行为基线，重构风险高。

## Risks / Trade-offs

- [Risk] 拆分阶段短期文件数量增加，理解成本上升。  
  → Mitigation: 目录按“container/composables/presentational”分层并文档化。

- [Risk] 事件链路变长，调试定位可能变慢。  
  → Mitigation: 在容器层统一日志埋点，记录关键事件与状态迁移。

- [Risk] 组件契约冻结后，快速试验新交互变得受约束。  
  → Mitigation: 允许在容器层新增实验字段，稳定后再固化到契约。

## Migration Plan

1. 定义 `CartBurner` 容器职责与子组件契约（props/events）。
2. 抽离 composable 管理流程与横切状态。
3. 将现有 `CartBurner.vue` 逻辑迁移到容器层，子组件改为纯展示/触发。
4. 运行关键流程回归（read/write/verify/cancel/error）并对齐行为。
5. 清理废弃状态字段和旧调用路径。

## Open Questions

- 容器层状态是否需要接入 Pinia 以支持跨页面共享，还是保持页面内局部状态？
- HMR 状态恢复（当前日志恢复逻辑）在容器化后保留在组件层还是下沉到 composable？
