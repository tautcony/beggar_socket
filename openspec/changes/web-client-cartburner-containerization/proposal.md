## Why

`CartBurner.vue` 目前承担了大量流程编排、状态管理与视图协调职责，文件体量和耦合度高，导致变更风险与测试成本持续上升。需要把该页面重构为容器化结构，明确“流程控制”与“展示组件”的边界。

## What Changes

- 将 `CartBurner.vue` 重构为 container + presentational 子组件的组合结构。
- 抽离操作流程状态与副作用到 composable/use-case 绑定层，组件只消费声明式状态与事件。
- 统一 modal、log、progress 等横切 UI 状态的管理入口，减少散落的本地状态变量。
- 固化组件输入输出契约，限制子组件直接触达协议或设备实现。
- 增加容器层集成测试，覆盖关键用户路径（读写/校验/取消/异常）。

## Capabilities

### New Capabilities
- `cartburner-containerization`: 定义 CartBurner 容器化架构和组件契约边界。

### Modified Capabilities
- `burner-application-orchestration`: 容器层通过统一 orchestration API 调用 burner 流程，移除组件侧流程拼装。
- `architecture-dependency-guardrails`: 增加 UI 组件对协议层/平台层直接依赖的限制规则。

## Impact

- Affected code:
  - `web-client/src/components/CartBurner.vue`
  - `web-client/src/components/operaiton/*`
  - `web-client/src/features/burner/application/*`
  - `web-client/src/composables/*`（新增容器编排 composable）
- Affected tests:
  - CartBurner 容器层行为测试
  - 关键操作流 UI 集成测试
