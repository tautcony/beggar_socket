## Why

Burner 相关应用逻辑虽然已进入 `features/burner/application`，但对底层网关、协议与运行时细节的依赖仍偏具体实现。需要引入明确的 domain port 抽象，减少应用层对基础设施变化的敏感性。

## What Changes

- 定义 Burner 领域端口（连接端口、协议执行端口、会话状态端口）的最小契约集合。
- 应用层 use case 从“依赖具体类”改为“依赖端口接口 + 适配器注入”。
- 统一结果模型（success/failure/progress）在端口边界上的语义，减少跨层格式转换分歧。
- 建立端口到实现的绑定策略（Web/Electron 运行时通过工厂/组合根装配）。
- 补充端口契约测试，确保替换实现不会破坏 Burner 流程语义。

## Capabilities

### New Capabilities
- `domain-port-abstraction`: 为 Burner 领域建立稳定端口契约，隔离应用层与基础设施实现。

### Modified Capabilities
- `burner-application-orchestration`: 将 use case 依赖改为端口抽象，规范 flow 输入输出语义。
- `device-transport-gateway`: 细化 gateway 对上层暴露的契约字段，确保可被 domain port 直接消费。
- `architecture-dependency-guardrails`: 增加“应用层不得直接依赖运行时串口实现”的约束规则。

## Impact

- Affected code:
  - `web-client/src/features/burner/application/*`
  - `web-client/src/platform/serial/*`
  - `web-client/src/protocol/beggar_socket/*`
- Affected tests:
  - Burner use case 端口契约测试
  - gateway/transport 与应用层集成测试
- Affected architecture:
  - 应用层依赖方向从“具体实现”转为“端口接口”
