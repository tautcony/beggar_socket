## Why

`web-client` 已有 `src/protocol` 目录，但协议调用路径仍存在“协议逻辑与运行时传输细节耦合”的历史痕迹。继续演进 Burner 流程前，需要先把协议层边界固定下来，避免后续改造反复回归。

## What Changes

- 明确 `src/protocol/beggar_socket` 的职责为“协议编码/解码与命令编排”，不承载运行时设备连接实现。
- 统一协议层输入为 `Transport` 抽象，禁止协议层直接触达 `services/serial-service` 或等价实现。
- 合并重复的 packet-read 逻辑为协议层单一实现，统一超时与错误语义。
- 为协议层提供稳定入口（barrel export / facade）供应用层调用，减少跨层直连路径。
- 补充依赖守卫规则，确保新增代码不会重新引入协议层越层依赖。

## Capabilities

### New Capabilities
- `protocol-layer-rehoming`: 定义协议层目录边界、公共入口和统一读写错误语义。

### Modified Capabilities
- `device-transport-gateway`: 强化协议调用仅通过 `Transport` 的要求，确保运行时差异由 gateway/transport 吸收。
- `architecture-dependency-guardrails`: 增加协议层对基础设施实现的依赖限制，防止反向耦合回流。
- `burner-application-orchestration`: 调整 Burner use case 对协议层的调用入口，移除旧路径依赖。

## Impact

- Affected code:
  - `web-client/src/protocol/beggar_socket/*`
  - `web-client/src/features/burner/application/*`
  - `web-client/src/platform/serial/*`
- Affected tests:
  - 协议层 packet read/send 语义测试
  - Burner orchestration 协议调用集成测试
- Affected tooling/docs:
  - 依赖守卫规则与对应文档
