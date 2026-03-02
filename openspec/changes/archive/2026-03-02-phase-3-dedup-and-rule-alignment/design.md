## Context

当前 Burner 主链路已具备应用编排与传输抽象基础，但仍存在三类重复点：
- `CartBurner.vue` 内部保留了与 parser 重复的 `detectMbcType` 规则实现；
- 读包逻辑在协议相关模块存在重复函数，形成行为分叉风险；
- 日志、进度、取消、错误处理在不同流程中重复拼装，语义一致性依赖人工维护。

本次设计面向 Phase 3，目标是在不改变用户可见行为的前提下，完成规则归位和流程模板化收敛。

## Goals / Non-Goals

**Goals:**
- 将 MBC 判定规则收敛到 parser 单一来源，移除组件内重复实现。
- 将读包逻辑收敛到单一实现，统一调用入口与错误语义。
- 提供可复用的流程模板，统一处理日志、进度、取消、错误四类横切关注点。
- 保持现有 UI 行为、结果结构、进度显示语义兼容。

**Non-Goals:**
- 不在本阶段引入新的设备协议能力或修改底层通信协议格式。
- 不重构整个 Burner 目录结构，仅处理与去重和规则归位直接相关模块。
- 不新增外部依赖或变更对外 API。

## Decisions

### Decision 1: MBC 判定以 parser 为唯一规则来源
- Choice:
  - 移除 `CartBurner.vue` 内部 `detectMbcType`，统一改为调用 `utils/parsers/rom-parser` 暴露的能力。
- Rationale:
  - parser 已承担 ROM 解析语义，规则集中在单点更容易验证与维护。
  - 组件层只消费解析结果，符合分层边界与职责收敛目标。
- Alternatives considered:
  - 保留组件内实现并与 parser 同步维护：实现快，但持续制造双维护点，长期风险高。
  - 将重复逻辑迁入 application 层再由 parser 调用：会增加中间层复杂度，且 parser 仍需保留核心规则。

### Decision 2: 读包函数保留单一实现并提供统一入口
- Choice:
  - 识别 `protocol-adapter` 与 `protocol-utils` 的重复读包逻辑，确定一个规范实现为唯一来源；
  - 其余调用方改为复用该实现，重复函数删除或降为薄封装（不保留独立行为）。
- Rationale:
  - 读包是关键主链路，重复实现极易造成超时、重试、错误映射等行为不一致。
  - 单一实现可为后续测试与性能优化提供稳定锚点。
- Alternatives considered:
  - 保留双实现并通过文档约束一致：无法防止后续漂移。
  - 完全重写新实现替代全部旧逻辑：一次性风险过高，不符合小步可回滚策略。

### Decision 3: 提取统一流程模板处理横切逻辑
- Choice:
  - 在 `features/burner/application` 增加通用流程执行模板（例如 execute-with-session 形态），统一封装：
    - 操作开始/结束日志；
    - 进度事件透传与归一；
    - 取消信号注册与清理；
    - 错误捕获、归一化与会话状态恢复。
- Rationale:
  - 当前每条流程都重复粘贴这四类逻辑，容易在异常分支出现状态不一致。
  - 模板化后可确保 busy/progress/log/abort 语义一致，并降低新增流程成本。
- Alternatives considered:
  - 保持每个 use case 自行处理横切逻辑：短期灵活，长期重复和回归风险持续。
  - 在 UI 层统一处理：违背“编排逻辑下沉 application”原则。

### Decision 4: 采用渐进迁移并以行为等价为验收
- Choice:
  - 按“规则归位 -> 读包收敛 -> 模板接入”顺序分步迁移；
  - 每一步都以行为等价（结果、进度、错误、取消）为验收标准。
- Rationale:
  - 减少单次改动面，便于定位回归与快速回滚。
  - 与既有 Phase 0~2 的增量改造节奏一致。

## Risks / Trade-offs

- [Risk] parser 规则与现有组件逻辑存在隐性差异，切换后可能影响边缘卡带识别结果  
  → Mitigation: 增加典型 ROM 样本回归用例，覆盖常见与边缘 MBC 判定。

- [Risk] 读包函数收敛可能改变超时/重试时序，导致设备兼容性波动  
  → Mitigation: 保持既有默认参数，先做等价迁移，再在后续独立变更中优化策略。

- [Risk] 流程模板抽象不当会降低局部可读性，增加调试层级  
  → Mitigation: 模板仅抽横切逻辑，业务步骤仍保留在具体 use case；提供统一日志标签便于追踪。

- [Trade-off] 早期会引入少量适配代码（wrapper）以平滑迁移  
  → Mitigation: 在迁移完成后清理过渡层，并通过任务验收确保重复实现完全移除。

## Migration Plan

1. 在 parser 对外暴露稳定的 MBC 判定入口，并替换 `CartBurner.vue` 调用，删除组件内重复函数。
2. 梳理现有读包调用链，确定唯一实现，逐个替换调用方并移除重复实现。
3. 在 application 层落地流程模板，并迁移至少一条读/写主流程验证模板可用性。
4. 扩展到其余 Burner 流程，统一日志、进度、取消、错误处理路径。
5. 运行回归测试与关键手工验证，确认行为一致后清理过渡代码。

Rollback strategy:
- 每一步保持独立提交粒度，若出现回归可回退到上一步并保留已通过验证的改动。

## Open Questions

- 读包唯一实现应落在 `protocol-adapter` 还是 `protocol-utils`，以最小化跨层影响？
  - `protocol-adapter`，更贴近设备交互语义。
- 流程模板是否需要暴露可插拔 hook（如自定义日志前缀、进度映射），还是保持固定契约以减少复杂度？
  - 保持固定契约，先满足当前需求，后续如有需要再评估增加灵活性。
