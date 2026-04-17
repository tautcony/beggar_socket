## Context

`web-client/docs/review-2026-04-15/` 这轮审查暴露的问题可以分成三类:

1. 正确性缺陷: `mbc5-adapter.ts` 的 `verifyROM()` 未传递 `mbcType`，以及 `mutex.ts` 的双重释放会直接破坏串行语义。
2. 生命周期恢复缺陷: Web/Tauri transport 与 gateway 在 send 超时、connect 卡死、disconnect close 抛错时，仍可能留下 stale writer、未清理 handle 或不可重连状态。
3. 架构脆弱点: 协议层未使用原子 `sendAndReceive()`，错误分类链从协议层到应用层过度依赖字符串匹配。

这几个问题横跨 `platform/serial/`、`protocol/`、`services/` 和 Burner 应用域。一次性全部实现风险较高，因此本 change 采用“先规约、后选范围”的方式，把审查问题整理成可选修复批次，再由用户确认实际实施边界。

## Goals / Non-Goals

**Goals:**
- 把 2026-04-15 审查问题整理成一个可执行的 OpenSpec 变更
- 为发布前必须修复的问题提供明确、低风险、可验证的实现方向
- 为本迭代可修项和技术债项提供审核用方案，而不是直接默认全部纳入
- 明确哪些问题需要 spec 变更，哪些只属于实现层补丁

**Non-Goals:**
- 在本设计文档中直接实施修复
- 把 `web-client` 历史上未纳入本轮审查范围的旧问题一并纳入
- 在未获确认前强行推进跨层错误体系的大范围重构

## Decisions

### D1: 按 Batch A / B / C 分层治理，而不是把 27 个问题当成一个平面清单

**选择**: 沿用审查文档的 `A1-A4`、`B1-B6`、`C1-C4` 划分。

**理由**:
- A 批问题包含 3 个 P0 和 1 个跨模块 disconnect 问题，属于发布前候选。
- B 批多为资源释放、类型安全和 UI 健壮性问题，适合与 A 批并行或随后处理。
- C 批包含跨层错误模型和协议原子性演进，收益高，但改动面最广，应该单独确认是否本次纳入。

**备选方案**:
- 按文件或模块分批: 对修复优先级表达不直观，不利于用户做范围决策。
- 一次性全修: 会把一行级别热修和跨层重构耦合到同一实现窗口，回归风险过高。

### D2: A1 采用“一行修复 + 回归测试”策略

**选择**: 在 `services/mbc5-adapter.ts` 的 `verifyROM()` 中，将 `await this.switchROMBank(bank);` 改为 `await this.switchROMBank(bank, mbcType);`，并增加 MBC3 回归覆盖。

**理由**:
- 当前代码已在 verify 循环中解析出 `bank`，问题只在于没有把已知的 `mbcType` 传下去。
- 这是明确的正确性缺陷，不需要额外架构设计。
- 最小补丁就能阻断 MBC3/MBC1 按 MBC5 规则切 bank 的误判。

**备选方案**:
- 在 `switchROMBank()` 内猜测类型: 会继续把规则来源分散到多处，不如直接传入显式参数。

### D3: A2 采用幂等 release，而不是在双重释放时抛异常

**选择**: 在 `platform/serial/mutex.ts` 的 `acquire()` 返回闭包内引入 `released` 标志，第二次调用直接忽略。

**理由**:
- 这个 mutex 作为底层保护原语，核心目标是“不要破坏队列状态”，而不是惩罚上层误用。
- 忽略第二次 release 可以最大化降低临界区进一步损坏的概率。
- 如需调试信号，可附加 `console.warn`，但不应影响生产时序。

**备选方案**:
- 第二次 release 抛错: 容易在 finally/cleanup 链路中制造新的未捕获异常，反而干扰恢复。

### D4: A3 保留 writer 缓存，但把超时恢复改成显式 writer 状态机

**选择**:
- 保留 `WebSerialTransport` 的 cached writer 模式，不把 writer 改成“每次 send 获取、每次 send 释放”。
- 为 writer 引入显式恢复状态，例如 `healthy` / `recovering` / `closed`，或等价的内部标记，确保超时后的 abort、writer 失效和后续重建不会并发交错。
- `send()` 在发现 writer 正处于恢复中时等待恢复完成或明确失败，而不是直接重新 `getWriter()`。
- 超时回调不再只做“异步 `abort()` 并立即把 `this.writer = null`”，而是把本次 writer 标记为失效，串行完成 abort/释放/重建准备后，才允许下一次 send 复用或替换 writer。

**理由**:
- 这个 transport 当前设计明显是希望复用 writer，而不是把 `WritableStream` 锁的获取释放放到每个包发送上。
- 当前 `onTimeout` 里异步 `writer.abort()` 且立刻 `this.writer = null`，会让下一次 `getWriter()` 与旧 writer 清理并发。
- 真正的问题不是“缓存 writer”本身，而是“失效 writer 的恢复流程没有串行化”。
- 维持缓存 writer 更符合 Web Serial 的预期使用方式，也避免无谓改变既有性能和锁语义。

**备选方案**:
- 每次 send 独占 writer: 实现更直接，但改变既有 writer 生命周期语义，不符合当前实现预期。
- 延续当前缓存策略只加 `await writer.abort()`: 仍然不足以防止新旧 writer 在恢复窗口内并发交错。

### D5: A4/B2/B3 统一落到 gateway 生命周期契约

**选择**:
- `TauriDeviceGateway.connect()` 的 `port.open()` 增加应用侧超时。
- `TauriDeviceGateway.init()` 在任一步骤失败时尝试把 DTR/RTS 拉回 low。
- `TauriDeviceGateway.disconnect()` 和 `WebDeviceGateway.disconnect()` 的 close 均使用 `try/finally` 风格，确保内存句柄清理始终发生。

**理由**:
- 这些问题都属于“设备句柄是否还能被安全回收和重建”的同一语义面。
- 放在 gateway 层修复，能保证上层 connection use case 无需感知运行时细节。

**备选方案**:
- 把 cleanup 逻辑上提到 `DeviceConnectionManager`: 会泄漏平台细节到应用层，不符合现有 abstraction。

### D6: B1/B4/B5/B6/C3 作为实现层补丁，不新增 capability

**选择**:
- `SerialService.openPort()` 补齐 `handle.port.close()`
- `useCartBurnerFileState` 对空数组选择做防御，并用 `try/finally` 确保 Blob URL 释放
- `DeviceConnect.vue` 为 connect/disconnect/port selection 使用单一处理锁，避免双击并发
- `DeviceConnectionManager` 以类型守卫替代 `ctx as DeviceHandle`
- `withTimeout` 统一继续沿用已有 `@/utils/async-utils`

**理由**:
- 这些修复不会改变对外行为契约，只会让现有实现更稳健。
- 把它们放进 design/tasks 便于一起排期，但不需要额外扩大主 spec 面。

### D7: C1 与 C2 分开决策，但设计上保持兼容

**选择**:
- `C2` 可以独立推进为“协议调用改用原子 sendAndReceive”。
- `C1` 若纳入，则以“稳定错误 code/type”逐层替代字符串匹配；优先从 protocol packet-read 与 application error-mapping 两端落点，中间层兼容旧 message。

**理由**:
- 原子收发能先解决响应错位风险，不必等待完整错误类型体系落地。
- 错误类型重构横跨 `packet-read.ts`、`error-mapping.ts`、`device-connection-manager.ts`，属于更大的演进。

**备选方案**:
- 绑定成一个大改一起做: 设计更纯，但交付节奏更慢。

## Risks / Trade-offs

- **[R1: WebSerial writer 恢复状态机会增加实现复杂度]** → 复杂度集中在 transport 内部，比修改为每次 send 重取 writer 更符合现有抽象和预期语义；通过回归测试覆盖 timeout 后 send/close/reconnect 降低风险。
- **[R2: disconnect “清理后仍抛错”会改变部分日志表现]** → 通过在 finally 中清理、再把 close 错误作为 failure cause 返回，可以同时保留诊断信息和恢复性。
- **[R3: C1 结构化错误会触及多层映射逻辑]** → 采用渐进替换，先引入 code/type，再保留消息文本兼容旧 UI 展示。
- **[R4: C2 批量改 protocol 调用点较多]** → 使用模式化替换，并以协议层回归测试覆盖典型 ack/payload 命令组合。
- **[R5: B5 连接按钮互斥若实现不一致，可能误伤断开流程]** → 使用统一的处理状态源，不分别维护 connect/disconnect 锁。

## Migration Plan

1. 先确认本次纳入的 batch 和 issue 编号。
2. 若仅纳入 A 批，先做 A1 → A2 → A3 → A4，并补最低限度回归。
3. 若纳入 B 批，实现层补丁可并行推进，但应在 A3/A4 之后合并。
4. 若纳入 C 批，先做 C2（原子收发），再评估是否跟进 C1（结构化错误）。
5. 合并前执行 transport/gateway/protocol/service 相关测试，并对 MBC3 verify 与断连重连做手工验证。

## Open Questions

- 本次是否只修发布前问题 `A1-A4`，还是同时纳入 `B1-B6`？
- `C1` 的结构化错误改造是否接受“先引入 code，暂不全面定义自定义 Error 子类”的渐进方案？
- `C2` 是否要在本 change 中一起推进，还是拆成后续独立 change？
