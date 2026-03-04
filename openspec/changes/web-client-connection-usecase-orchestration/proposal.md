## Why

设备连接生命周期（list/select/connect/init/disconnect）在 UI 与应用层之间仍有职责交叉，导致状态一致性与错误恢复难以保证。需要将连接流程收敛为应用层 use case 编排，以提供稳定、可测试的连接行为。

## What Changes

- 新增连接编排 use case，统一承载设备发现、选择、连接、初始化、断开流程。
- 将连接状态机（idle/selecting/connecting/connected/disconnecting/failed）从组件逻辑收敛到应用层会话模型。
- 统一连接流程的错误归一化、重试策略与用户可见结果语义。
- 提供可组合的连接命令入口，供 Burner 主流程与独立连接场景复用。
- 增加连接路径集成测试，覆盖成功、失败、中断与恢复场景。

## Capabilities

### New Capabilities
- `connection-usecase-orchestration`: 提供应用层连接流程编排与统一状态机语义。

### Modified Capabilities
- `burner-application-orchestration`: 将连接前置条件与会话生命周期并入统一 use case 编排。
- `device-transport-gateway`: 对齐连接用例所需的 gateway 返回结构与错误语义。

## Impact

- Affected code:
  - `web-client/src/features/burner/application/*`
  - `web-client/src/platform/serial/*`
  - `web-client/src/components/CartBurner.vue`（连接触发路径）
- Affected tests:
  - 连接生命周期集成测试
  - 连接失败后的恢复/重连回归测试
