## 1. MBC rule single-source migration

- [x] 1.1 在 parser 层确认并固定统一的 MBC 判定入口（含输入/输出契约与错误语义）。
- [x] 1.2 替换 `CartBurner.vue` 中所有 MBC 判定调用为 parser 入口调用。
- [x] 1.3 删除 `CartBurner.vue` 内部 `detectMbcType` 及其相关重复分支，并确认组件仍仅消费编排层结果。

## 2. Packet-read deduplication

- [x] 2.1 梳理 `protocol-adapter` 与 `protocol-utils` 的读包函数调用链，确定唯一保留实现位置（按 design 采用 `protocol-adapter`）。
- [x] 2.2 将全部 Burner 读包路径切换到统一实现，移除重复实现或降为无独立行为的薄封装。
- [x] 2.3 对统一实现补齐超时、错误映射与返回结构的一致性断言，避免迁移后语义漂移。

## 3. Shared flow template extraction

- [x] 3.1 在 `features/burner/application` 新增通用流程模板，统一封装日志、进度、取消、错误处理生命周期。
- [x] 3.2 迁移至少一条 ROM 主流程接入模板并验证 busy/progress/log/abort 状态收敛。
- [x] 3.3 迁移其余 Burner 流程到模板执行路径，删除各 use case 内重复横切处理代码。

## 4. Compatibility and behavior verification

- [x] 4.1 新增/更新测试覆盖 MBC 判定一致性（parser 单一来源）与组件无本地重复实现。
- [x] 4.2 新增/更新测试覆盖读包统一实现的成功、超时、错误场景，并比较迁移前后结果语义一致。
- [x] 4.3 新增/更新测试覆盖模板化后的日志、进度、取消、错误处理在不同流程中的一致性。

## 5. Final cleanup and acceptance

- [x] 5.1 清理迁移过程中引入的过渡 wrapper 与死代码，确保重复函数仅保留单一实现。
- [x] 5.2 运行并通过 `lint`、`check:deps` 与相关测试集，记录 Phase 3 验收结果。
- [x] 5.3 按变更说明更新 `web-client/docs/*.md` 的 Phase 3 完成状态与实现落点。
