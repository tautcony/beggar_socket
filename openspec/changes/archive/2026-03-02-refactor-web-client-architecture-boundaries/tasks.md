## 1. Guardrails Baseline

- [x] 1.1 固化并验证 `components/views -> protocol` 与 `types/utils -> services` 的依赖限制规则（ESLint + check:deps）。
- [x] 1.2 在 CI 流程中接入 `npm run check:deps`，确保新增穿透依赖会阻断提交。
- [x] 1.3 补充架构边界文档，明确允许依赖方向、临时豁免列表与移除策略。

## 2. Burner Application Skeleton

- [x] 2.1 新建 `features/burner/application` 目录与模块结构（use case、session、facade 接口）。
- [x] 2.2 定义 `BurnerSession` 状态模型（busy、abort、progress、logs）与统一生命周期 API。
- [x] 2.3 定义 `BurnerUseCase`/Facade 契约，覆盖 read/erase/write/verify/scan 的统一返回与错误语义。
- [x] 2.4 适配现有 adapter（GBA/MBC5/Mock）到 application 调用路径，保持外部行为兼容。

## 3. Incremental Flow Migration

- [x] 3.1 迁移 `readCart` 与 `eraseChip` 流程到 application，并在 `CartBurner.vue` 切换为 facade 调用。
- [x] 3.2 迁移 `writeRom/readRom/verifyRom` 流程到 application，统一取消与进度处理模板。
- [x] 3.3 迁移 `writeRam/readRam/verifyRam` 流程到 application，统一日志与错误处理语义。
- [x] 3.4 迁移 `readRomInfo/scanMultiCart` 到 application，保留现有用户可见行为与输出格式。
- [x] 3.5 删除 `CartBurner.vue` 中流程编排重复逻辑（含本地 detectMbcType 等重复实现）。

## 4. UI Boundary Enforcement

- [x] 4.1 移除 `CartBurner.vue` 对 `protocol/*` 的直接依赖，改为经 application/service facade。
- [x] 4.2 清理 `DebugToolModal.vue` 的协议直连策略或将其隔离到专用调试门面，避免污染常规 UI 依赖边界。
- [x] 4.3 确认 Burner 相关组件不再直接调用 adapter/protocol 的底层方法。

## 5. Tests and Verification

- [x] 5.1 新增 Burner application 集成测试（mock adapter/device），覆盖成功路径与失败路径。
- [x] 5.2 新增取消与超时场景测试，验证 session 生命周期与状态收敛一致性。
- [x] 5.3 新增进度与日志契约测试，保证迁移前后 UI 消费协议兼容。
- [x] 5.4 执行并通过 lint、`check:deps`、现有测试集与新增测试集，作为阶段验收门槛。

## 6. Baseline Exception Burn-down

- [x] 6.1 按迁移完成度逐项删除 ESLint override 中的遗留豁免项。
- [x] 6.2 按迁移完成度逐项删除 `check-architecture-deps` allowlist 中的遗留项。
- [x] 6.3 在文档中更新“剩余豁免为 0”的最终状态，并记录后续守护规则。
