## Why

`web-client` 当前存在 UI、协议、设备连接、流程编排相互穿透的问题，`CartBurner.vue` 作为巨型组件导致维护成本高、变更风险大。当前已完成 Phase 0 防劣化机制，需要尽快推进 P0 的“Burner 应用编排层抽取”，把核心流程从组件中下沉为可测试、可复用的应用层能力。

## What Changes

- 新增 Burner 应用编排能力，抽取 `read/erase/write/verify/scan` 等主流程到 application use case。
- 建立 Burner 会话状态模型（busy/abort/progress/log），统一处理取消、错误、进度与日志语义。
- 将 `CartBurner.vue` 从“流程执行者”调整为“状态消费 + 事件分发”容器组件。
- 通过门面接口隔离组件与底层适配器/协议实现，减少 UI 对底层细节直接依赖。
- 延续 Phase 0 的防劣化约束，确保迁移期间不引入新的跨层穿透依赖。

## Capabilities

### New Capabilities
- `burner-application-orchestration`: 定义 Burner 读卡、擦写、校验、多卡扫描等流程的应用层编排能力及状态管理契约。
- `architecture-dependency-guardrails`: 定义并约束 `components/views -> protocol`、`types/utils -> services` 的依赖边界，防止架构继续劣化。

### Modified Capabilities
- 无（当前无既有 capability spec，后续通过新增 specs 建立基线）。

## Impact

- Affected code:
  - `web-client/src/components/CartBurner.vue`
  - `web-client/src/components/operaiton/*`
  - `web-client/src/services/*`（尤其 adapter、device connection 相关）
  - `web-client/src/protocol/beggar_socket/*`（通过门面解耦其上层调用）
  - `web-client/eslint.config.js`
  - `web-client/scripts/check-architecture-deps.cjs`
- APIs/Contracts:
  - 新增 application 层 use case 与会话状态接口，作为 UI 调用入口。
  - 现有组件内部调用路径会调整，但对最终用户行为保持兼容。
- Testing:
  - 需要补充 application 层集成测试（mock transport/device）以覆盖主链路回归。
- Dependencies:
  - 不新增外部三方依赖，主要为代码结构与模块依赖关系重组。
