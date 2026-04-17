## Why

2026-04-15 的 `web-client` 审查识别出 3 个 P0、12 个 P1 和多项跨模块脆弱点，其中几项会直接影响串口互斥正确性、断连恢复、协议请求原子性和 ROM 校验结果。需要先把这些问题整理成一个可裁剪的 OpenSpec 变更，明确哪些属于发布前必须修复，哪些适合放入本迭代或后续技术债处理。

## What Changes

- 建立一份基于 `web-client/docs/review-2026-04-15/` 的问题修复变更，按 `Batch A / B / C` 组织修复范围与优先级
- 为串口 gateway/transport 增补生命周期可靠性要求，覆盖 mutex 幂等释放、send 超时恢复、disconnect 清理和跨运行时一致性
- 为 Tauri 串口实现增补 open 超时、init 信号回滚和 disconnect 异常兜底要求
- 为连接编排补充“断开时始终清理状态”和“失败后可立即重试”的恢复契约
- 为协议层补充原子 `sendAndReceive` 使用约束，以及摆脱字符串匹配的错误分类方向
- 为 Burner ROM 校验流程补充跨 MBC 类型的 bank switching 正确性要求，消除 `verifyROM()` 的误判风险
- 在设计和任务中保留非 spec 型修复项，包括端口泄漏、UI 双击竞态、Blob URL 清理和共享 `withTimeout` 工具抽取，供后续按编号选择实施

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `device-transport-gateway`: 强化 transport/gateway 的生命周期恢复、disconnect 清理和回归覆盖要求
- `tauri-serial-gateway`: 强化 Tauri connect/init/disconnect 的失败处理与恢复语义
- `connection-usecase-orchestration`: 补充断连清理、失败恢复和重试一致性要求
- `protocol-layer-rehoming`: 约束协议调用使用原子收发路径，并为错误分类演进预留稳定契约
- `burner-application-orchestration`: 补充 ROM 校验在不同 MBC 类型下的正确性要求

## Impact

- 审查输入: `web-client/docs/review-2026-04-15/summary.md`, `fixes-plan.md`, `phase-1-platform-serial.md`, `phase-2-protocol.md`, `phase-3-services.md`, `phase-5-crosscutting.md`
- 重点代码范围: `web-client/src/platform/serial/`, `web-client/src/protocol/beggar_socket/`, `web-client/src/services/`, `web-client/src/features/burner/application/domain/`, `web-client/src/components/`, `web-client/src/composables/`
- 用户决策点: 以 `A1-A4` 为发布前必选候选，`B1-B6` 为本迭代候选，`C1-C4` 为技术债候选；最终实施前需要逐项确认范围
