## Why

Phase 1~3 已完成架构边界收敛、应用编排抽取与规则去重，但当前主链路测试覆盖仍不足，尤其缺少针对连接、读写、取消、超时和错误恢复的应用层集成保障。现在需要补齐 Phase 4 测试体系，确保后续重构和功能演进具备稳定回归护栏。

## What Changes

- 增加 Burner 应用层集成测试（mock transport / mock adapter），覆盖连接成功/失败、读写流程、取消流程、超时与错误恢复。
- 保留并延续现有工具类单测，补齐“主流程 + 规则 + 工具”三层测试结构。
- 增加主链路回归测试，验证关键用户可见行为在持续重构后保持一致。
- 将测试覆盖目标与关键契约（结果结构、进度语义、错误语义、取消行为）绑定为可验证要求。

## Capabilities

### New Capabilities
- 无。

### Modified Capabilities
- `burner-application-orchestration`: 增补应用层可验证性要求，明确主流程必须具备集成测试覆盖（成功/失败/取消/超时/错误恢复）并保持会话状态语义一致。
- `device-transport-gateway`: 增补网关与传输契约回归要求，明确连接生命周期与传输超时/错误行为须由测试验证并在 Web/Electron 路径保持一致语义。

## Impact

- Affected code:
  - `web-client/tests/burner-application.test.ts`
  - `web-client/tests/protocol-transport.test.ts`
  - `web-client/tests/*`（主链路与规则相关回归测试）
  - `web-client/src/features/burner/application/*`（如需暴露更可测的测试接入点）
  - `web-client/src/platform/serial/*`（契约测试相关）
- APIs/Contracts:
  - 不新增外部 API；主要增强内部契约的可测试性与可验证性。
- Tooling/Validation:
  - 持续使用并强化 `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run check:deps` 作为阶段验收基线。
- Dependencies:
  - 不新增外部依赖，沿用现有 Vitest 测试栈。
