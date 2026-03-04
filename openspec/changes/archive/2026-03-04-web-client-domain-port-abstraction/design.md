## Context

当前 Burner 应用层已经形成 use case + session + flow template 的主干，但依赖边界仍以实现类为主，导致：
- 运行时实现替换需要改动应用层代码；
- 测试常通过复杂 mock 贴合具体实现细节；
- 协议/网关契约演进时影响面扩大。

本设计通过 domain port 抽象把变化收敛到适配器层。

## Goals / Non-Goals

**Goals:**
- 为 Burner 应用层定义清晰、可测试、可替换的端口接口。
- 用组合根注入端口实现，避免 use case 内部感知 runtime 细节。
- 统一端口级错误与进度语义，减少调用层分叉。

**Non-Goals:**
- 不重构所有历史服务模块；仅覆盖 Burner 主路径所需端口。
- 不在本变更中改动 UI 交互文案与展示策略。
- 不新增设备协议能力，仅重构依赖结构。

## Decisions

### Decision 1: 端口按职责拆分而非单一“大接口”
- 设计最小端口集合（例如 `ConnectionPort`、`ProtocolPort`、`SessionPort`），每个端口只承载一类能力。
- Use case 组合依赖多个小端口，而不是依赖一个全能 gateway。
- 备选方案：定义一个统一 `BurnerGateway`。
  - 放弃原因：接口膨胀快，难以稳定演进和精确测试。

### Decision 2: 端口契约稳定，适配器吸收实现差异
- Web/Electron 差异保留在 `platform/serial` 与协议适配器中。
- use case 仅消费端口返回的标准结果结构。
- 备选方案：在 use case 内判断运行时并走分支。
  - 放弃原因：会把平台复杂度引回应用层。

### Decision 3: 统一结果模型
- 端口返回统一 `Result` 结构（success/failure + normalized error + optional payload）。
- Progress 事件字段统一，供 flow-template 直接转发到会话。
- 备选方案：不同端口返回各自结构。
  - 放弃原因：调用方需做大量桥接转换，增加错误面。

### Decision 4: 契约测试先于实现迁移
- 先建立端口契约测试，再迁移现有实现以测试为护栏。
- 对关键失败路径（连接失败、超时、中断）建立固定断言。
- 备选方案：先迁移后补测试。
  - 放弃原因：迁移期回归风险高且定位成本大。

## Risks / Trade-offs

- [Risk] 端口抽象过度会引入额外样板代码。  
  → Mitigation: 严格控制端口粒度，只覆盖已存在稳定用例。

- [Risk] 迁移中同一能力短期存在“双路径”（旧实现 + 新端口）。  
  → Mitigation: 通过 feature flag 或单向迁移清单限定生命周期，完成后立即清理。

- [Risk] 统一结果模型可能丢失实现层细节。  
  → Mitigation: 在错误对象中保留 machine-readable code 与调试上下文。

## Migration Plan

1. 定义端口接口与统一结果类型（仅新增，不替换现有调用）。
2. 为现有 gateway/protocol 实现添加端口适配器。
3. 迁移 Burner use case 到端口注入模型。
4. 迁移 flow-template 的结果处理到统一模型。
5. 清理 use case 对旧具体实现的直接依赖并收紧依赖守卫。

## Open Questions

- 端口接口应放在 `features/burner/application` 还是独立 `domain` 目录，以便跨模块复用？
- 对于长耗时流，progress 推送使用回调还是异步迭代器更适合当前代码基线？
