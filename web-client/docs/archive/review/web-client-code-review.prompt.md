---
description: >
  对 web-client 源码进行逐模块、系统性代码审查。
  审查目标：定位运行时正确性缺陷、资源管理漏洞、协议实现偏差、跨平台不一致、
  状态机完整性问题及安全隐患。每个 Phase 独立完整，可逐阶段执行。
---

# Web Client 逐模块代码审查

## 1. 审查目标

本 prompt 驱动一次完整、不遗漏的代码审查。审查覆盖 `web-client/` 下所有源码模块，
重点定位以下类型的问题）：

| 类别 | 代号 | 典型缺陷举例 |
|------|------|-------------|
| 并发与资源管理 | C1 | writer/reader lock 生命周期错误、stream 泄漏 |
| 超时与错误处理 | C2 | 超时触发时破坏流状态、错误不向上传播、静默失败 |
| 协议正确性 | C3 | 字节序、帧格式、ACK 校验逻辑、长度计算偏差 |
| 跨平台一致性 | C4 | WebSerial 与 Electron 行为差异、缺少对等实现 |
| 状态机完整性 | C5 | 状态转换遗漏、异常时未重置、初始化顺序依赖 |
| 配置与常量 | C6 | bufferSize 默认值过小、魔法数字、超时过于激进 |
| 异步与 Promise | C7 | 竞态条件、未捕获 rejection、Promise 泄漏 |
| 类型安全 | C8 | `any` 滥用、不安全类型断言、narrowing 缺失 |
| Vue 响应式 | C9 | 响应式丢失、composable 副作用泄漏、store 滥用 |
| 安全性 | C10 | IPC 未验证输入、XSS、文件路径注入 |
| 内存与资源泄漏 | C11 | unmount 时未移除监听器、AbortController 未用 |

---

## 2. 执行策略

**在开始前**，使用 `manage_todo_list` 工具初始化所有 Phase 任务，之后每完成一个 Phase 立即标记为完成。

**每个 Phase 的执行步骤**：
1. 读取该 Phase 列出的所有文件（可并行读取）
2. 对照该 Phase 的专项 Checklist 逐项检查
3. 同时应用通用 Checklist（第 3 节）的全部条目
4. **将审查结果写入对应的 markdown 文件**（见第 5 节输出路径规范）
5. 标记该 Phase 为完成，然后继续下一 Phase

**不要跳过任何 Phase**，即使某个模块"看起来很简单"。每个 Phase 必须写出对应的 markdown 文件，内容为"未发现问题"或完整问题清单，两者都是有效产出。

**所有阶段的 markdown 文件统一写入 `web-client/docs/review/` 目录**（不存在时由 agent 创建），文件命名见第 5 节。

---

## 3. 通用审查 Checklist（每个 Phase 都必须应用）

对当前 Phase 的每个文件检查以下项：

### 3.1 异步安全
- [ ] `Promise.race()` 中是否有副作用（如释放锁、修改共享状态）在 race 的非胜出分支执行？
- [ ] `finally` 块是否可能在操作仍进行中时执行副作用（如 `releaseLock()`）？
- [ ] 是否存在未处理的 Promise rejection（`fire-and-forget` 模式）？
- [ ] 所有 `async` 函数的返回值是否被调用方 `await` 或显式处理？

### 3.2 资源生命周期
- [ ] 所有获取的锁/reader/writer 是否在所有退出路径（正常、超时、异常）上都被释放？
- [ ] 是否存在在同一对象上多次获取 exclusive lock 的风险？
- [ ] Event listener 是否在组件卸载或对象销毁时被移除？

### 3.3 错误传播
- [ ] catch 块是否有意义地处理了错误，还是仅 `console.log` 或空 catch？
- [ ] 一次错误是否可能导致系统进入无法自愈的状态（需用户手动重连）？
- [ ] 错误是否携带了足够的上下文信息（文件名、操作名、参数）？

### 3.4 边界与配置
- [ ] 是否使用了未经验证的外部输入（用户输入、API 响应、文件内容）？
- [ ] 默认值是否合理？（如 buffer 大小、超时时间、重试次数）
- [ ] 数值边界是否有校验？（如地址范围、长度溢出）

### 3.5 类型安全
- [ ] 是否有 `as unknown as T`、`as any` 等不安全的类型强转？
- [ ] 类型定义是否与实际数据结构对齐？
- [ ] 可选链 `?.` 是否遮盖了应当抛出错误的情况？

---

## 4. 模块审查清单

> **重要**：开始执行前，先用 `manage_todo_list` 创建以下所有任务（Phase 0–9），然后按顺序逐个执行。

---

### Phase 0：准备工作（必须首先执行）

**任务**：建立审查上下文，不读文件不计入统计。

1. 读取 `web-client/docs/webserial-vs-electron-serial-analysis.md` — 了解已知问题模式，作为后续审查的参照基准
2. 读取 `web-client/docs/modules/00-overview.md` — 了解架构分层与模块边界
3. 将以下内容写入 `web-client/docs/review/phase-0-baseline.md`：
   - 已知问题基线摘要（每条 1–2 行）
   - 本次审查的模块边界列表
   - 审查执行日期

---

### Phase 1：`platform/serial` — 传输层（最高优先级）

**文件清单**（并行读取）：
- `src/platform/serial/types.ts`
- `src/platform/serial/transports.ts`
- `src/platform/serial/web/device-gateway.ts`
- `src/platform/serial/electron/device-gateway.ts`
- `src/platform/serial/factory.ts`
- `src/platform/serial/compat.ts`
- `src/platform/serial/index.ts`
- `src/utils/electron.ts`

**专项 Checklist**：
- [ ] **[C1]** `WebSerialTransport.send()` 中 writer 的获取/释放是否与超时逻辑安全组合？
- [ ] **[C1]** `pumpReadable()` 异常退出后，`readable` stream 是否可被重新获取？重新获取前是否检查 stream 状态（`locked`/`errored`）？
- [ ] **[C2]** 超时触发时是否可能在 write/read 操作仍 pending 时执行 `releaseLock()`？这是否会破坏 stream 状态？
- [ ] **[C4]** `WebSerialTransport` 与 `ConnectionTransport` 的 `send()`/`read()`/`close()` 是否在语义上完全对等？（如超时行为、错误类型、返回值含义）
- [ ] **[C6]** `port.open()` 中是否设置了 `bufferSize`？默认 255 字节是否足够容纳最大协议包（可达 16KB）？
- [ ] **[C5]** `DeviceGateway.init()` 中 DTR/RTS 信号序列（false → delay → true）是否正确，delay 是否足够 MCU 响应？
- [ ] **[C5]** `disconnect()` 是否正确关闭 Transport（释放 reader/writer lock、等待 pump 结束）再关闭 port？
- [ ] **[C4]** Electron device-gateway 的 `setSignals()` 是否与 Web 版实现有行为差异？
- [ ] **[C7]** `pumpReadable` 的 `pumpPromise` 是否有竞态风险（两处同时调用 `ensurePumpStarted()`）？
- [ ] **[C11]** `ensurePumpStarted()` 创建的 pump 是否在 `close()` 时被等待/取消？

**参考**：`docs/modules/03-platform-serial.md`  
**参考**：`docs/webserial-vs-electron-serial-analysis.md`（已知 P0/P1 问题位于此模块）

**输出文件**：`web-client/docs/review/phase-1-platform-serial.md`

---

### Phase 2：`protocol/beggar_socket` — 协议层

**文件清单**（并行读取）：
- `src/protocol/beggar_socket/command.ts`
- `src/protocol/beggar_socket/payload-builder.ts`
- `src/protocol/beggar_socket/protocol.ts`
- `src/protocol/beggar_socket/protocol-adapter.ts`
- `src/protocol/beggar_socket/protocol-utils.ts`
- `src/protocol/beggar_socket/packet-read.ts`
- `src/protocol/beggar_socket/index.ts`

**专项 Checklist**：
- [ ] **[C3]** `cmdSize` 字段计算：是否等于 `2(cmdSize自身) + 1(cmdCode) + payloadSize + 2(crc)`？与固件 `uart.c` 中解析逻辑是否对齐？
- [ ] **[C3]** 所有多字节字段是否使用小端序写入？`payload-builder.ts` 中 `DataView.setUint16` / `setUint32` 的 `littleEndian` 参数是否均为 `true`？
- [ ] **[C3]** ACK 读取：是否读取恰好 1 字节并与 `0xAA` 比较？失败时的错误信息是否包含实际收到的值？
- [ ] **[C3]** 读类命令：响应头 2 字节（CRC 占位）是否被正确跳过？`readProtocolPayload` 的长度参数是否包含这 2 字节？
- [ ] **[C3]** 固件缓冲区上限 5500 字节——是否有任何命令可能构造超过此大小的请求包？
- [ ] **[C2]** `packet-read.ts` 中超时路径：是否能区分"read 超时"与"Transport 底层错误"？错误类型是否透传？
- [ ] **[C7]** `rom_get_id()` 等需要多次连续 send+read 的操作，是否正确处理中间步骤失败的情况？
- [ ] **[C6]** `ProtocolAdapter.sendCommand()` / `receiveResponse()` 中所用超时常量来源？是否与 `AdvancedSettings` 正确绑定？
- [ ] **[C3]** `GBACommand` / `GBCCommand` 枚举值是否与固件 `uart.c` 中 switch/case 对齐？

**参考**：`docs/modules/04-protocol-beggar-socket.md`  
**参考**：`mcu/chis_flash_burner/Core/Src/uart.c`（如需验证命令值）

**输出文件**：`web-client/docs/review/phase-2-protocol.md`

---

### Phase 3：`features/burner` — 应用层

**文件清单**（并行读取）：
- `src/features/burner/application/domain/ports.ts`
- `src/features/burner/application/domain/result.ts`
- `src/features/burner/application/domain/connection.ts`
- `src/features/burner/application/domain/error-mapping.ts`
- `src/features/burner/application/burner-session.ts`
- `src/features/burner/application/burner-use-case.ts`
- `src/features/burner/application/connection-use-case.ts`
- `src/features/burner/application/flow-template.ts`
- `src/features/burner/application/factory.ts`
- `src/features/burner/application/index.ts`
- `src/features/burner/adapters/cartridge-protocol-port.ts`
- `src/features/burner/adapters/connection-orchestration-factory.ts`
- `src/features/burner/adapters/device-gateway-connection-port.ts`
- `src/features/burner/adapters/index.ts`

**专项 Checklist**：
- [ ] **[C5]** `burner-session.ts` 中会话状态机：所有正常/异常路径是否最终都转移到终止状态？是否存在"永久 in-progress"风险？
- [ ] **[C2]** 用例（use-case）层是否捕获并正确映射了来自 protocol/service 层的所有错误类型？
- [ ] **[C7]** `flow-template.ts` 中的流程步骤是否保证原子性？中途失败是否执行回滚或清理？
- [ ] **[C5]** `connection-use-case.ts`：连接/断开操作是否幂等？重复调用是否有保护？
- [ ] **[C8]** `ports.ts` 中接口定义是否足够严格？是否存在宽泛类型（`any`、`object`）？
- [ ] **[C2]** `error-mapping.ts`：是否覆盖了所有来自 platform/protocol 层可能抛出的错误类型？unmapped 错误如何处理？
- [ ] **[C9]** factory 是否根据运行时环境（Electron / Web）正确创建不同实现？环境检测逻辑是否可靠？

**输出文件**：`web-client/docs/review/phase-3-features-burner.md`

---

### Phase 4：`services` — 服务与适配器层

**文件清单**（并行读取）：
- `src/services/cartridge-adapter.ts`
- `src/services/gba-adapter.ts`
- `src/services/mbc5-adapter.ts`
- `src/services/mock-adapter.ts`
- `src/services/device-connection-manager.ts`
- `src/services/serial-service.ts`
- `src/services/flash-chip.ts`
- `src/services/system-notice-service.ts`
- `src/services/tool-functions.ts`
- `src/services/debug-protocol-service.ts`
- `src/services/rtc/base-rtc.ts`
- `src/services/rtc/gba-rtc.ts`
- `src/services/rtc/mbc3-rtc.ts`
- `src/services/lk/romBuilder.ts`
- `src/services/lk/imageUtils.ts`
- `src/services/lk/utils.ts`
- `src/services/index.ts`

**专项 Checklist**：
- [ ] **[C5]** `gba-adapter.ts` / `mbc5-adapter.ts`：擦除 → 编程 → 校验流程，如果任一步骤失败，是否有明确的状态清理？
- [ ] **[C2]** 进度回调（progress callback）：异常时是否保证回调仍被调用（如以 error 状态结束）？不调用是否导致 UI 永久 loading？
- [ ] **[C6]** `flash-chip.ts`：芯片 ID 到参数的映射，是否覆盖所有已知芯片型号？未知芯片时降级行为是否合理？
- [ ] **[C10]** `system-notice-service.ts`：从外部 JSON 拉取的通知内容，是否在渲染前经过 XSS sanitization？
- [ ] **[C10]** `tool-functions.ts`：文件路径操作是否有路径遍历（path traversal）防护？
- [ ] **[C7]** `device-connection-manager.ts`：是否处理了在连接过程中被并发重复调用的情况？
- [ ] **[C4]** `serial-service.ts`（legacy facade）：是否仍被代码引用？若是，是否与新 connection-manager 行为一致？
- [ ] **[C3]** `rtc/gba-rtc.ts` / `mbc3-rtc.ts`：RTC 数据的字节格式是否与固件实现对齐（BCD 格式、字段顺序）？
- [ ] **[C7]** `lk/romBuilder.ts`：ROM 构建过程是否有边界检查（如目标 ROM 大小溢出）？

**输出文件**：`web-client/docs/review/phase-4-services.md`

---

### Phase 5：`utils` — 工具层

**文件清单**（并行读取）：
- `src/utils/async-utils.ts`
- `src/utils/address-utils.ts`
- `src/utils/compression-utils.ts`
- `src/utils/crc-utils.ts`
- `src/utils/formatter-utils.ts`
- `src/utils/port-filter.ts`
- `src/utils/sector-utils.ts`
- `src/utils/translation.ts`
- `src/utils/log-viewer.ts`
- `src/utils/markdown.ts`
- `src/utils/electron.ts`
- `src/utils/errors/NotImplementedError.ts`
- `src/utils/errors/PortSelectionRequiredError.ts`
- `src/utils/monitoring/sentry-loader.ts`
- `src/utils/monitoring/sentry-tracker.ts`
- `src/utils/parsers/cfi-parser.ts`
- `src/utils/parsers/rom-parser.ts`
- `src/utils/progress/progress-builder.ts`
- `src/utils/progress/progress-reporter.ts`
- `src/utils/progress/speed-calculator.ts`
- `src/utils/rom/rom-assembly-utils.ts`
- `src/utils/rom/rom-editor.ts`

**专项 Checklist**：
- [ ] **[C2]** `async-utils.ts` 中 `withTimeout`：超时后是否有资源泄漏（如 timer 未 clear、Promise 仍 pending）？
- [ ] **[C3]** `crc-utils.ts`：CRC16 算法实现是否与固件中使用的多项式一致？（即使固件当前不校验，实现本身应正确）
- [ ] **[C3]** `rom-parser.ts`：ROM header 解析是否处理了小于最小 header 大小的文件？是否有 buffer 越界风险？
- [ ] **[C3]** `cfi-parser.ts`：CFI 数据解析的偏移量是否与 JEDEC CFI 规范对齐？是否有规范外数据的容错？
- [ ] **[C6]** `sector-utils.ts`：扇区边界计算是否经过整数溢出检查？（大 ROM 时地址可能超过 32 位有符号整数范围）
- [ ] **[C10]** `markdown.ts`：渲染 Markdown 时是否做了 XSS 防护（sanitize HTML）？
- [ ] **[C8]** `rom-assembly-utils.ts`：ROM 拼接操作的边界检查是否完整？
- [ ] **[C11]** `monitoring/sentry-loader.ts`：Sentry 是否只在非开发环境加载？是否有隐私合规配置（PII sanitization）？
- [ ] **[C6]** `speed-calculator.ts`：速度计算是否处理了窗口为空或极短时间间隔（避免除零）？

**输出文件**：`web-client/docs/review/phase-5-utils.md`

---

### Phase 6：`stores` / `settings` / `composables` — 状态层

**文件清单**（并行读取）：
- `src/stores/rom-assembly-store.ts`
- `src/stores/recent-file-names-store.ts`
- `src/settings/advanced-settings.ts`
- `src/settings/debug-settings.ts`
- `src/composables/useEnvironment.ts`
- `src/composables/useToast.ts`
- `src/composables/cartburner/index.ts`
- `src/composables/cartburner/useCartBurnerFileState.ts`
- `src/composables/cartburner/useCartBurnerSessionState.ts`

**专项 Checklist**：
- [ ] **[C9]** Pinia store：是否有 reactive 数据在 store 外部被直接解构（打破响应式）？
- [ ] **[C5]** `advanced-settings.ts`：settings 变更是否即时生效？是否有依赖 settings 但在 settings 变更前已缓存的代码？
- [ ] **[C9]** composables：是否正确使用 `onUnmounted` 清理副作用（timer、event listener、unsubscribe）？
- [ ] **[C6]** `advanced-settings.ts`：所有超时/缓冲区等关键配置的默认值是否合理（参照 Phase 1 发现的 bufferSize 问题）？
- [ ] **[C7]** `useCartBurnerSessionState`：session 在操作进行中被重置时，是否会产生竞态？
- [ ] **[C8]** store state 的类型定义是否完整？是否有运行时类型与声明类型不符的风险？
- [ ] **[C11]** `recent-file-names-store.ts`：localStorage 存储量是否有上限？条目是否会无限增长？

**输出文件**：`web-client/docs/review/phase-6-stores-settings-composables.md`

---

### Phase 7：`views` + `components` — 展示层

**文件清单**（先做目录扫描再读文件）：

首先执行目录扫描（file_search）找到所有 `.vue` 文件，然后重点读取以下文件：
- `src/views/HomeView.vue`
- `src/views/SerialTestView.vue`
- `src/views/RomAssemblyView.vue`
- `src/views/GBAMultiMenuView.vue`
- `src/components/CartBurner.vue`
- `src/components/DeviceConnect.vue`
- `src/components/modal/ProgressDisplayModal.vue`
- `src/components/modal/AdvancedSettingsModal.vue`
- `src/components/modal/PortSelectorModal.vue`
- `src/components/modal/DebugToolModal.vue`
- `src/components/operaiton/RomOperations.vue`
- `src/components/operaiton/RamOperations.vue`
- `src/components/operaiton/ChipOperations.vue`
- `src/components/progress/SectorVisualization.vue`

**专项 Checklist**：
- [ ] **[C9]** 是否有 `v-html` 指令直接渲染用户输入或外部数据（XSS 风险）？
- [ ] **[C9]** 操作按钮（烧录、擦除等）是否在操作进行中被禁用（避免重复触发）？
- [ ] **[C5]** `ProgressDisplayModal`：进度对话框是否在操作异常结束后正确关闭/重置？
- [ ] **[C9]** `DeviceConnect`：连接状态与 UI 状态是否完全同步？断开连接时 UI 是否正确反映？
- [ ] **[C11]** 长时间操作是否提供了取消机制？取消后是否清理中间状态？
- [ ] **[C7]** 文件拖拽上传：是否有文件类型、大小的前端验证？
- [ ] **[C9]** `SerialTestView`：原始协议测试的输出是否经过 sanitize，防止特殊字节渲染为 HTML？
- [ ] **[C10]** 所有 `$t()` 的 key 是否在中英文 locale 文件中均有对应定义？（i18n 完整性）

**输出文件**：`web-client/docs/review/phase-7-views-components.md`

---

### Phase 8：`electron/` — Electron 运行时

**文件清单**（并行读取）：
- `electron/main.js`
- `electron/preload.js`
- `electron/ipc-handlers.js`
- `electron/security-utils.js`
- `electron/package.json`

**专项 Checklist**：
- [ ] **[C10]** `main.js`：`webPreferences` 是否启用了 `contextIsolation: true` 和 `nodeIntegration: false`？
- [ ] **[C10]** `preload.js`：通过 `contextBridge` 暴露的 API 是否严格限制了可调用的 IPC 频道（channelAllowList）？
- [ ] **[C10]** `ipc-handlers.js`：所有 IPC handler 是否对接收的参数做了类型/范围验证，防止主进程被注入指令？
- [ ] **[C4]** `serial-write` handler：write 回调仅表示数据进入内核缓冲区，是否考虑了在背压场景下等待 `drain` 事件？
- [ ] **[C4]** `serial-read` 数据通过 IPC 传输时（`Uint8Array → Array → Buffer → Uint8Array`），是否有数据截断或类型丢失风险？
- [ ] **[C2]** IPC handler 的异常是否都被 `try/catch` 保护并以 reject 返回，而非让主进程崩溃？
- [ ] **[C10]** `security-utils.js`：是否有白名单限制可打开的外部 URL（防止 shell open 任意 URL）？
- [ ] **[C11]** 串口打开后，如果渲染进程意外崩溃，主进程是否能检测到并关闭串口？

**参考**：`docs/webserial-vs-electron-serial-analysis.md` — P2 问题（drain、IPC 序列化）

**输出文件**：`web-client/docs/review/phase-8-electron.md`

---

### Phase 9：cross-cutting 交叉审查

**任务**：无需读取新文件，基于前 8 个 Phase 的发现进行综合分析。

**专项 Checklist**：
- [ ] **[C4]** 对比 Phase 1 与 Phase 8 的发现：WebSerial 与 Electron Transport 的行为差异是否超出预期？是否有系统性的"对等实现缺失"？
- [ ] **[C5]** 梳理所有涉及状态的模块（Phase 3、6）：是否存在跨模块的状态不一致风险（如 connection state 在 feature 层与 UI 层不同步）？
- [ ] **[C7]** 主链路（连接 → 读 ID → 擦除 → 编程 → 校验）的每个步骤，失败时是否有完整的回滚路径或明确的"脏状态"清理？
- [ ] **[C2]** 是否有任何模块形成了"静默失败孤岛"——错误在内部被消化，上层完全不知情？
- [ ] **[C10]** 整体安全性：外部输入的信任边界是否清晰？ROM 文件内容、设备返回数据、用户文本输入，分别在哪一层被 validate？

**输出文件**：`web-client/docs/review/phase-9-crosscutting.md`

---

## 5. 输出格式规范

### 5.1 每个 Phase 的输出文件

| Phase | 输出文件路径 |
|-------|--------------|
| Phase 0 | `web-client/docs/review/phase-0-baseline.md` |
| Phase 1 | `web-client/docs/review/phase-1-platform-serial.md` |
| Phase 2 | `web-client/docs/review/phase-2-protocol.md` |
| Phase 3 | `web-client/docs/review/phase-3-features-burner.md` |
| Phase 4 | `web-client/docs/review/phase-4-services.md` |
| Phase 5 | `web-client/docs/review/phase-5-utils.md` |
| Phase 6 | `web-client/docs/review/phase-6-stores-settings-composables.md` |
| Phase 7 | `web-client/docs/review/phase-7-views-components.md` |
| Phase 8 | `web-client/docs/review/phase-8-electron.md` |
| Phase 9 | `web-client/docs/review/phase-9-crosscutting.md` |
| 汇总 | `web-client/docs/review/summary.md` |

每个 Phase **必须**在完成审查后立即将结果写入对应文件，然后才能标记为 completed。

### 5.2 Phase 报告文件格式

每个 Phase 的 markdown 文件结构如下（严格遵守，不得省略任何章节）：

```markdown
# Phase N 审查报告：[模块名]

> 审查时间：YYYY-MM-DD  
> 审查文件数：X  
> 发现问题数：P0(N) / P1(N) / P2(N) / INFO(N)

## 已审查文件

- `path/to/file.ts`
- `path/to/file2.ts`
- ...（每个文件一行）

## 问题清单

<!-- 如无问题，写"本 Phase 未发现问题。"并结束文件 -->

### 🔴 P0 — [C类别代号] 问题标题

**文件**：`path/to/file.ts` — `函数名或代码块名`

**现象**：  
（描述当前代码的实际行为，引用关键代码片段）

**问题**：  
（解释为什么这是个问题，以及潜在的触发条件）

**影响**：  
（P0 = 可导致功能失效/数据损坏 | P1 = 可靠性/性能显著影响 | P2 = 边角场景）

**修复建议**：  
（具体可操作的修复方向，不需要完整代码）

---

## 未覆盖区域

<!-- 如所有文件均已成功读取，写"无" -->
- `path/to/unreadable.ts` — 原因：（文件不存在 / context 不足 / 其他）
```

严重度标记：
- `🔴 P0` — 必须修复，可能导致数据损坏或功能失效
- `🟡 P1` — 应当修复，影响可靠性或性能
- `🟢 P2` — 建议修复，边角场景或代码质量问题
- `ℹ️ INFO` — 观察记录，无需立即修复

---

## 6. 最终汇总报告

所有 Phase 完成后，将以下内容写入 `web-client/docs/review/summary.md`：

```markdown
# Web Client 代码审查汇总报告

> 审查完成时间：YYYY-MM-DD  
> 覆盖 Phase：0–9（共 10 个）

## 统计

| 严重度 | 数量 |
|--------|------|
| 🔴 P0  | N    |
| 🟡 P1  | N    |
| 🟢 P2  | N    |
| ℹ️ INFO | N    |
| **合计** | **N** |

## 高优先级问题（P0）

<!-- 每条格式：`- [Cx] 模块/文件 — 问题标题`，链接到对应 Phase 文件 -->
- [C1] `platform/serial/transports.ts` — writer lock 超时破坏 stream 状态

## 各 Phase 汇总

| Phase | 模块 | P0 | P1 | P2 | INFO | 报告链接 |
|-------|------|----|----|----|----|----------|
| 0 | 基线准备 | - | - | - | - | [phase-0](./phase-0-baseline.md) |
| 1 | platform/serial | N | N | N | N | [phase-1](./phase-1-platform-serial.md) |
| 2 | protocol | N | N | N | N | [phase-2](./phase-2-protocol.md) |
| 3 | features/burner | N | N | N | N | [phase-3](./phase-3-features-burner.md) |
| 4 | services | N | N | N | N | [phase-4](./phase-4-services.md) |
| 5 | utils | N | N | N | N | [phase-5](./phase-5-utils.md) |
| 6 | stores/settings/composables | N | N | N | N | [phase-6](./phase-6-stores-settings-composables.md) |
| 7 | views/components | N | N | N | N | [phase-7](./phase-7-views-components.md) |
| 8 | electron | N | N | N | N | [phase-8](./phase-8-electron.md) |
| 9 | cross-cutting | N | N | N | N | [phase-9](./phase-9-crosscutting.md) |

## 跨模块系统性问题

（如果存在多个模块共同导致的问题，描述根因及涉及模块）

## 未覆盖区域汇总

（汇总所有 Phase 中未能完成审查的文件）
```

---

## 7. 执行约束

1. **不要生成虚构代码**：只基于实际读取到的文件内容做判断，不推测或假设
2. **审查与写文件分离**：完成一个 Phase 的审查 → 写对应 markdown 文件 → 标记 todo completed → 开始下一 Phase
3. **不跳过 Phase**：即使一个 Phase 没有发现问题，也必须写出包含"未发现问题"的 markdown 文件
4. **持续使用 manage_todo_list**：每完成一个 Phase 立即标记为 completed，保持进度可见
5. **遇到文件无法读取时**：记录在该 Phase 文件的"未覆盖区域"章节，继续执行下一个文件，不停止整个 Phase
6. **文件路径以仓库根目录为基准**：所有 `web-client/docs/review/` 路径均相对于仓库根目录
