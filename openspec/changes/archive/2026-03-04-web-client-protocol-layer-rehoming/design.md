## Context

当前协议代码已经集中在 `src/protocol/beggar_socket`，但调用方仍可能绕过协议边界直接依赖实现细节，导致：
- 协议行为难以在 Web/Electron 之间保持一致；
- packet-read 异常处理在不同流中重复且不一致；
- 架构守卫虽然存在，但对协议层约束还不够精确。

该变更是后续 domain port 与 UI container 化改造的基础。

## Goals / Non-Goals

**Goals:**
- 固化协议层边界：协议层仅依赖 `Transport`，不依赖运行时设备实现。
- 统一 packet-read 行为与错误/超时语义，减少 flow 侧特判。
- 提供稳定协议入口给 Burner 应用层，降低跨目录耦合。
- 让依赖守卫可自动拦截新增越层依赖。

**Non-Goals:**
- 不重写底层串口实现（Web/Electron gateway 的核心行为保持不变）。
- 不在本变更中引入新协议指令集或业务流程。
- 不处理 UI 结构重构（由 containerization change 处理）。

## Decisions

### Decision 1: 协议层公开单一入口
- 在 `src/protocol/beggar_socket` 暴露稳定 API（通过 index/barrel 或 facade）。
- 应用层只依赖该入口，不直接引用协议内部 util。
- 备选方案：允许按文件直接 import。
  - 放弃原因：会让内部实现细节成为事实标准，重构成本高。

### Decision 2: 协议通信依赖 `Transport` 注入
- 协议方法入参统一接收 `Transport`（或封装后的等价端口），所有 send/read/setSignals 均走抽象。
- 禁止协议目录直接 import `services` 下具体实现。
- 备选方案：协议层保留 runtime 分支。
  - 放弃原因：协议逻辑与运行时耦合，破坏跨端一致性。

### Decision 3: packet-read 只保留一个 canonical 实现
- 将超时、重试（如有）、错误映射收敛到单一函数，所有协议读取路径复用。
- 输出统一错误类型/消息键，方便上层结果归一化。
- 备选方案：各协议命令局部处理读取。
  - 放弃原因：重复逻辑会持续分叉，难以保证语义一致。

### Decision 4: 守卫规则提升为阻断级
- 在依赖检查中显式加入 `src/protocol -> src/services/serial-service` 禁止边。
- 仅保留对 `src/platform/serial` 抽象契约的允许路径。
- 备选方案：仅文档约定。
  - 放弃原因：无法自动阻断回归。

## Risks / Trade-offs

- [Risk] 统一错误语义后，历史调用方可能依赖旧文案/类型。  
  → Mitigation: 在应用层保留兼容映射，并补充回归测试覆盖常见失败路径。

- [Risk] 协议入口收敛可能导致短期改动面较大。  
  → Mitigation: 分阶段迁移 import 路径，先增加新入口，再清理旧入口。

- [Risk] 守卫规则过严可能阻断正在迁移中的中间态提交。  
  → Mitigation: 使用 baseline 例外清单，仅放行已知历史例外，禁止新增例外。

## Migration Plan

1. 引入协议层公开入口与 canonical packet-read 实现（不移除旧路径）。
2. 迁移 Burner 应用层调用到新入口，并验证读写/超时语义。
3. 删除旧的重复读取实现与过期 import 路径。
4. 更新依赖守卫规则并在 CI 中启用阻断。
5. 运行 burner orchestration 与 protocol 相关集成测试，确认行为一致。

## Open Questions

- canonical packet-read 是否需要内建 retry，还是完全交给上层流程控制？
- 协议层错误对象是否统一映射为 i18n key，还是保留结构化 code + message 双字段？
