## Why

最新 Web Client 的 LK 确定性测试在大数组深比较时超时，且 CI 未执行行为测试。先建立稳定回归门禁，才能安全实施审查方案。

## What Changes

- 用字节精确比较保留大型 ROM 确定性断言，验证单字节差异仍被发现。
- 增加独立 Web Client 质量工作流，PR 与 main push 执行 lint、类型、架构、单测和构建。
- 固定质量工作流 Node/npm 版本，不改变产品或固件行为。

## Capabilities

### New Capabilities
- `web-client-regression-gates`: 可重复的二进制回归测试与 PR 质量门禁。

### Modified Capabilities
无。

## Impact

仅 tests、CI 与审查实施记录；不恢复用户 stash，不修改固件、旧客户端、协议或依赖版本。
