## 1. Test matrix and baseline setup

- [x] 1.1 梳理并固化 Phase 4 覆盖矩阵（连接成功/失败、读写流程、取消、超时、错误恢复）并映射到现有测试文件。
- [x] 1.2 明确三层测试分工（主流程集成层、规则契约层、工具层），为每层定义最小可验收断言。
- [x] 1.3 统一测试执行基线与命令入口（`test:run`、`lint`、`type-check`、`check:deps`），确保本地与 CI 口径一致。

## 2. Burner application integration tests

- [x] 2.1 在 `burner-application` 集成测试中补充连接成功与失败场景，验证结果结构与失败语义归一。
- [x] 2.2 补充 ROM/RAM 读写主流程场景，验证成功路径、进度语义与命令缓冲清理行为。
- [x] 2.3 补充取消流程场景，验证取消后 busy/abort/log 状态收敛与后续操作可继续执行。
- [x] 2.4 补充超时与运行时错误恢复场景，验证错误映射语义与会话状态恢复一致性。

## 3. Device gateway and transport contract tests

- [x] 3.1 补充 `DeviceGateway` 生命周期集成测试，覆盖 `connect/init/list/select/disconnect` 成功路径。
- [x] 3.2 补充 `DeviceGateway` 失败路径测试，覆盖连接或初始化异常并验证上层可消费的标准错误语义。
- [x] 3.3 补充 `Transport` 的 `send/read/setSignals` 回归断言，覆盖超时与错误传播语义。
- [x] 3.4 增加 Web/Electron 运行时一致性断言，验证上层观察到的成功/失败/超时行为等价。

## 4. Regression hardening for shared flow and rules

- [x] 4.1 补充 `BurnerSession` 与 `runBurnerFlow` 的生命周期回归断言，覆盖进度、取消、错误、最终状态收敛。
- [x] 4.2 补充 parser/protocol 关键规则回归测试，确保规则与契约在重构后不漂移。
- [x] 4.3 校验并清理重复或低价值测试，确保断言聚焦关键契约且维护成本可控。

## 5. Validation and documentation closure

- [x] 5.1 运行并通过 `npm run test:run`（含新增场景）并记录关键覆盖结果。
- [x] 5.2 运行并通过 `npm run lint`、`npm run type-check`、`npm run check:deps`、`npm run build` 作为阶段验收门禁。
- [x] 5.3 更新 `web-client/docs/*.md` 中 Phase 4 完成状态、测试落点与回归策略说明。
