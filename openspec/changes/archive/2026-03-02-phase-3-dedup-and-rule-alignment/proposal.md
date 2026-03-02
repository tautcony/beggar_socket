## Why

Phase 1/2 已完成主流程下沉与传输网关统一，但当前仍存在重复规则实现与重复读包逻辑，导致维护点分散且行为一致性风险仍高。现在推进 Phase 3，目标是把规则与流程模板收敛到单一实现，降低回归风险并提升后续演进效率。

## What Changes

- 删除 `CartBurner.vue` 内部重复的 `detectMbcType` 实现，统一使用 parser 层能力作为唯一来源。
- 合并重复读包函数，收敛为单一实现并统一调用入口。
- 提取通用流程模板，统一处理日志、进度、取消、错误四类横切逻辑。
- 对已迁移与未迁移流程保持兼容，确保用户可见行为与现有流程语义一致。

## Capabilities

### New Capabilities
- 无。

### Modified Capabilities
- `burner-application-orchestration`: 补充“规则单一来源与流程模板化”要求，约束 MBC 判定、读包流程与日志/进度/取消/错误处理在 Burner 主链路中采用统一实现并保持行为一致。

## Impact

- Affected code:
  - `web-client/src/components/CartBurner.vue`
  - `web-client/src/utils/parsers/*`
  - `web-client/src/protocol/beggar_socket/*`（读包函数收敛点）
  - `web-client/src/features/burner/application/*`（通用流程模板与编排接入）
- APIs/Contracts:
  - 不引入新的外部 API；主要调整内部调用路径与规则归属，保持 UI 侧调用契约稳定。
- Testing:
  - 需要补充或更新针对 MBC 判定一致性、读包行为一致性、取消/错误/进度语义一致性的测试。
- Dependencies:
  - 不新增外部依赖，主要为内部实现收敛与重复代码清理。
