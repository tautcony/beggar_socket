## Context

当前 `web-client` 在 Burner 相关链路中存在明显的跨层耦合：`CartBurner.vue` 同时承担 UI、流程编排、适配器选择、日志与进度管理；部分组件直接依赖 `protocol/*`，`types/utils` 对 `services` 存在倒挂依赖。  
本次变更目标是把 Burner 主流程下沉到应用编排层，在不改变用户可见行为的前提下，建立可测试、可演进的分层结构，并与已落地的 Phase 0 依赖防劣化机制协同推进。

约束与前提：
- 当前项目已上线 Web/Electron 双运行形态，改造必须保持运行时兼容。
- 已有历史穿透点通过 lint override 和脚本 allowlist 做基线豁免，需“迁移一处、移除一处豁免”。
- 改造应分批进行，避免一次性大改导致回归不可控。

## Goals / Non-Goals

**Goals:**
- 建立 Burner 应用编排层（application），统一承载 `read/erase/write/verify/scan` 主流程。
- 建立 Burner 会话状态模型，统一 busy/abort/progress/log 的生命周期与语义。
- 将 `CartBurner.vue` 收敛为容器组件：只负责状态渲染与事件分发。
- 通过门面接口屏蔽组件对 adapter/protocol 细节的直接依赖。
- 与 Phase 0 guardrails 联动，确保迁移期间新增代码不产生新的跨层依赖。

**Non-Goals:**
- 本阶段不重写底层协议实现（`protocol/beggar_socket`）和设备驱动细节。
- 本阶段不引入新的外部依赖或状态管理框架。
- 本阶段不处理全部 UI 组件架构治理，仅覆盖 Burner 主链路和直接相关模块。

## Decisions

### 1) 引入 `features/burner/application` 作为单一编排入口
- 决策：
  - 新增 `BurnerUseCase`（或等价命名）统一组织所有 Burner 流程。
  - UI 不再直接调用 adapter 方法，统一走 application 接口。
- 原因：
  - 把跨步骤流程和错误处理集中，降低组件复杂度。
  - 便于后续对流程做集成测试（mock adapter/transport）。
- 备选方案：
  - 继续在组件中拆 composable：可降低一点文件体积，但流程职责仍停留在展示层，边界不清，放弃。

### 2) 引入 `BurnerSession` 管理运行态
- 决策：
  - 会话对象统一维护 `busy`、`abortController`、`progressInfo`、`logs`。
  - 所有操作以“开始-执行-收尾”模板执行，确保取消、异常、资源清理一致。
- 原因：
  - 当前各操作对 busy/progress/reset 的处理分散且重复，容易不一致。
  - 模板化能显著减少 `read/write/verify` 之间样板代码。
- 备选方案：
  - 每个 use case 独立维护状态：灵活但重复度高，且语义易漂移，放弃。

### 3) 采用 Facade 隔离 UI 与底层实现
- 决策：
  - application 层对外提供稳定接口（Facade），内部再调用现有 `GBAAdapter/MBC5Adapter/MockAdapter`。
  - `CartBurner.vue` 不再 import `protocol/*`，也不直接处理 `arraysEqual/getFlashId` 等底层细节。
- 原因：
  - 降低 UI 对实现细节耦合，便于未来替换 adapter/protocol 或引入统一 gateway。
- 备选方案：
  - 直接让组件调用 adapter 并逐步删代码：过渡成本低，但边界目标无法达成，放弃。

### 4) 迁移策略采用“增量切换 + 行为对齐”
- 决策：
  - 按用例逐步迁移：`readCart/eraseChip` -> `write/read/verify ROM` -> `write/read/verify RAM` -> `scanMultiCart`。
  - 每迁移一批即删除对应旧路径和豁免规则，避免新旧长期并存。
- 原因：
  - 控制回归范围，保持每次变更可验证、可回滚。
- 备选方案：
  - 一次性全量迁移：实现更快，但风险显著更高，放弃。

### 5) 测试策略升级为“应用层集成测试优先”
- 决策：
  - 保留现有 utils 单测，补充 application 层集成测试（mock device/adapter）。
  - 覆盖成功、失败、取消、超时、进度与日志行为。
- 原因：
  - 当前测试重心偏工具函数，无法有效保护主流程重构。
- 备选方案：
  - 只补组件测试：维护成本高且脆弱，难覆盖流程分支，放弃。

## Risks / Trade-offs

- [迁移期双路径并存导致行为偏差] → 采用“单用例切换后立即删除旧路径”，并为关键用例加回归测试。
- [会话状态抽象过度，增加理解门槛] → 保持接口最小化（只抽通用状态与生命周期），避免过度框架化。
- [UI 与 application 的事件模型不一致] → 明确 `ProgressInfo` 和日志事件契约，先冻结契约再迁移调用方。
- [历史豁免长期存在导致规则失效] → 在 tasks 中把“移除豁免”列为完成标准，并在 CI 中监控。

## Migration Plan

1. 新建 `features/burner/application`，定义 `BurnerUseCase` 与 `BurnerSession` 最小接口。
2. 迁移 `readCart`、`eraseChip` 到 application，`CartBurner.vue` 改为调用 Facade。
3. 迁移 `write/read/verify ROM`，同步收敛进度与取消逻辑。
4. 迁移 `write/read/verify RAM` 与 `scanMultiCart`，移除组件内重复工具逻辑。
5. 为 application 新增集成测试，覆盖核心流程与异常路径。
6. 每完成一批迁移，移除对应 lint override 与脚本 allowlist 项。
7. 全量切换完成后，执行 lint + `check:deps` + tests，作为阶段验收。

回滚策略：
- 每批迁移保持独立提交，若出现回归可按批次回滚到前一稳定点。
- 在完全切换前保留旧调用路径分支，必要时可快速临时恢复。

## Open Questions

- `BurnerSession` 是否应由 Pinia 托管，还是保持模块内实例即可？
  - 无需托管，当前仅限于 Burner 主流程，且生命周期与组件树不完全一致，放在模块内更轻量。
- Facade 返回值应保持当前 `CommandResult` 原样，还是引入更语义化的 application result？
  - 保持原样，当前 `CommandResult` 已经足够表达成功/失败/数据。
- 多卡扫描是否与通用读 ROM 流程共享同一流水线，还是维持独立用例更清晰？
  - 维持独立用例，扫描流程在 UI 和交互上与单卡读 ROM 有明显差异，分开更清晰。
- `DeviceConnect` 的连接态是否也纳入 application 统一管理（为 Phase 2 铺路）？
  - 纳入，但保持接口最小化，先抽象连接态和错误处理，后续再根据需要扩展。
