## Context

Phase 1~3 已完成应用编排、网关抽象与规则去重，但测试覆盖仍以工具类单测为主，主链路（连接 -> 协议收发 -> 用例编排 -> UI 消费语义）缺少系统性回归保护。结合 `web-client/docs/*.md` 的 Phase 4 目标，本次设计要把测试能力从“点状”升级为“分层闭环”：主流程集成测试、规则/协议契约测试、工具单测共同构成稳定回归基线。

## Goals / Non-Goals

**Goals:**
- 建立应用层集成测试矩阵，覆盖连接成功/失败、读写流程、取消、超时、错误恢复。
- 固化网关与传输契约测试，验证 Web/Electron 路径在 `DeviceGateway`/`Transport` 语义上保持一致。
- 延续并补强规则与工具单测，确保 parser、protocol、session 等核心规则具备可回归验证。
- 将 `lint`、`type-check`、`check:deps`、`test:run` 组成 Phase 4 验收基线。

**Non-Goals:**
- 不引入新的业务能力或协议功能变更。
- 不调整既有架构分层边界（仅增强可验证性）。
- 不新增外部测试框架依赖。

## Decisions

### Decision 1: 采用“三层测试”结构组织回归能力
- Choice:
  - 将测试按 `主流程集成层 + 规则契约层 + 工具函数层` 组织，并明确每层覆盖目标与责任边界。
- Rationale:
  - 与目标架构（presentation/application/infrastructure）一致，能把回归信号映射到具体层次，定位更快。
- Alternatives considered:
  - 继续只扩充工具单测：实现成本低，但无法覆盖链路级回归。
  - 仅做端到端测试：覆盖广但定位慢、维护成本高，不适合当前重构节奏。

### Decision 2: 应用层使用 mock transport / mock adapter 驱动集成测试
- Choice:
  - 在 `burner-application` 相关测试中，以 mock `Transport`/adapter 注入连接、读写、异常、超时、取消等场景。
- Rationale:
  - 保留测试稳定性与速度，避免受真实串口环境波动影响，同时验证主流程编排语义。
- Alternatives considered:
  - 直接依赖真实设备测试：结果更贴近真实，但 CI 不稳定且难规模化。

### Decision 3: 将关键行为语义转化为可断言契约
- Choice:
  - 对结果结构、错误映射、进度语义、取消行为、busy 状态收敛定义统一断言。
- Rationale:
  - Phase 3 已抽出通用流程模板，需通过统一断言保证模板接入后各流程行为一致。
- Alternatives considered:
  - 仅断言“成功/失败”：无法捕捉语义回归（如取消后状态未收敛、错误消息漂移）。

### Decision 4: 用 CI 组合门禁保证持续有效
- Choice:
  - 将 `npm run lint`、`npm run type-check`、`npm run check:deps`、`npm run test:run` 作为阶段验收最小集合。
- Rationale:
  - 同时覆盖代码质量、类型契约、架构边界与行为回归，避免“单维通过”。

## Risks / Trade-offs

- [Risk] mock 场景与真实串口时序存在偏差，可能漏掉边缘问题  
  → Mitigation: 保留少量手工冒烟流程，并对超时/重试参数做边界测试。

- [Risk] 测试范围扩张导致维护负担上升  
  → Mitigation: 按分层职责拆分测试文件，避免跨层断言耦合；公共构造逻辑提取 helper。

- [Risk] 现有流程模板与历史流程并存时可能出现断言分歧  
  → Mitigation: 先固化公共语义断言，再逐步替换旧断言，确保迁移期兼容。

- [Trade-off] 更强的门禁会增加短期开发反馈时间  
  → Mitigation: 维持定向测试命令用于本地快速迭代，CI 使用全量门禁。

## Migration Plan

1. 梳理现有测试并建立 Phase 4 覆盖矩阵（连接、读写、取消、超时、错误恢复）。
2. 先补 `burner-application` 与 `protocol-transport` 的关键缺口测试，形成主链路最小闭环。
3. 补齐 parser/session/flow-template 相关规则断言，统一行为语义基线。
4. 将门禁命令纳入阶段验收，并更新文档中的 Phase 4 完成状态与落点。
5. 运行全量验证并清理重复或低价值测试，保持可维护性。

Rollback strategy:
- 按测试文件或测试组分步提交，若某组引入不稳定性可单独回退，不影响其它覆盖面建设。

## Open Questions

- 是否需要引入专门的“慢速集成测试”分组，以区分本地快速反馈与 CI 全量验证？
  - No
- 当前是否需要补充最小真实设备 smoke 流程文档，作为 mock 测试的外部校验补充？
  - Yes，后续可在 `web-client/docs/phase-4-test-system-completion.md` 中补充。
