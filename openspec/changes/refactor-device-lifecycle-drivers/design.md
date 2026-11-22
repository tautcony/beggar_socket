# Design

## Context

`ConnectionOrchestrationUseCase` 已有生命周期队列、连接身份、操作协调和清理路径。`DeviceConnectionManager` 目前在获取已连接 handle 后分别执行 Boost 或 FlashGBX 探测。Web 与 Tauri 网关已经分离串口选择和打开操作。产品行为来自 [设计文档 §5](../../../docs/device-abstraction-design.md#5-注册表与解析流程)。

## Goals / Non-Goals

- 让所有连接入口共用一条连接事务，并使串口和协议初始化受同一生命周期管理。
- 复用现有协议实现、适配器读写算法和 Tauri 命令签名。

## Decisions

### 设备选择与端口发现

每次建立会话时通过 core change 提供的稳定 `SelectionProvider` 读取单一 `variantId` 并快照化连接参数。注册表返回 binding 与协议策略，串口枚举只影响候选顺序和诊断。Web 由网关取得用户授权的串口及其 USB 信息，并在 `DeviceConnect.vue` 提供无过滤器的「选择其他串口」入口（自动发现不打开 mismatch/unknown 端口；用户显式选择后才可按所选 variant 尝试连接）。Tauri 沿用 `PortSelectionRequiredError`，一个匹配可直接使用，多个匹配请求选串口，无匹配返回完整列表且不得自动打开 mismatch 端口；只有用户显式选择 mismatch 端口后才允许按所选 variant 尝试连接。Web 失败重试保留已授权端口，同时按新一轮的设置建立会话。

记录选择、端口和匹配结果。`beggar-stm` 匹配 `0483:0721` 及 `STMicroelectronics` / `Beggar Socket`，`beggar-stc` 匹配 `0483:0721` 与 `0483:5740`（`0483:5740` 仅对 `beggar-stc` 判为 match，同时作为其他 Beggar variant 的手动候选列表线索），`gbflash` 匹配 `1A86:7523` 与 `16C0:27DD`。binding 中的 runtime binding 与 transport 要求是协议和信号策略的权威来源。

### 连接事务与身份

首次连接、指定端口和重连统一调用 `establishSession(port, selection)`。管理器和连接用例通过既有域端口装配握手与初始化。协议操作留在连接队列内，打开 transport 并创建 PendingSession 后依次验证固件、解析 profile、初始化，再发布 `connected`。重新建立会话时重新读取设置并生成新的连接身份。open 后先创建 `PendingSession`；probe/resolve/initialize/commit 前任何失败均走 `cleanupPending()` 并关闭 pending transport。commit 后成为 `ActiveSession`，断开才调用 `teardown(activeSession)`。清理失败仍要使旧会话和适配器失效，并保留主错误与清理结果。恢复路径沿用已有操作互斥和 generation 校验。

### 驱动与适配器边界

driver、display contributor 与 adapter factory 全部落在 `src/device-runtime/`，由 `RuntimeBinding<TFacts>` 按 `runtimeBindingId` 装配；`src/device/` 不新增任何实现文件。`BeggarDriver implements ProtocolDriver<BeggarProbeFacts>`、`FlashgbxDriver implements ProtocolDriver<FlashgbxProbeFacts>`，`SessionResolver.resolve` 保留 facts 泛型。

Beggar 驱动复用标准 STM 和 STC 的信号初始化。仅在选择 Boost 的真机会话沿用 `boost_probe(transport, 250)`。`src/protocol/beggar_socket/boost-protocol.ts` 内的 `boost_enter_mode()` 目前使用 `AdvancedSettings.packageReceiveTimeout`（默认 3000 ms），与本路径不一致；提取驱动时两处统一到固定 250 ms 常量，避免同一探测出现两套超时。

`runtimeFeatures.boostTransport` 由 `SessionResolver` 按 core 规则派生（Boost variant 且 verified/simulated），lifecycle SHALL NOT 在解析后手工补写该字段。

探测不支持或异常时尽力复位到默认模式，返回带阶段的错误，再关闭端口。`SimulatedTransport` 是 transport backend，协议仍为 Beggar 或 FlashGBX；跳过真机探测，不注册成用户可选协议身份。

FlashGBX 驱动复用既有握手函数，**断开以目标规范为准**（不迁就既有二选一实现）：若握手确认 `cart_power_ctrl=true`，依次发送 `CART_PWR_OFF` 与 `SET_VOLTAGE_3_3V`；若无电源控制，仅发送 `SET_VOLTAGE_3_3V`，最后关闭端口；收尾命令失败写入 `DeviceDiagnostic(code='teardown-failed', stage='disconnect')`。连接期间按现有速率与信号策略执行，握手成功后只做维持现有行为所需的初始化。`auto` 波特率 SHALL 展开为 `2000000`（现有实现即固定 2 Mbps，没有端口或宿主维度），不再按设备类别或端口猜测。固件版本下限引用实现中的 `DEVICE_MIN_FW`（`protocol/flashgbx/handshake.ts`，判定 `cfwId !== 'L' || fwVer < DEVICE_MIN_FW`），不得在文档或测试中另命名。Rust 继续强制校验波特率，前端在 `src/device/` 维护 `ALLOWED_BAUD_RATES` 常量（注明须与 `native_platform.rs` 一致）用于 UI 提前拦截，不新增 `get_allowed_baud_rates` 命令或额外契约文件。

packet limits 统一直接读取 binding 的 `transport.packetLimits`（当前 GBFlash 全平台均为 `0x100`，不再按 `ch340`/`cdc`/`default` 分表或拒绝 unknown 端口）。

mismatch 端口只有在用户显式选择后才连接，记录 `DeviceDiagnostic(code='port-mismatch', stage='transport')` 并按所选 variant 继续（不弹出二次确认）。

适配器工厂按会话提供 GBA、MBC5 适配器和可选的模式同步。保留 FlashGBX 会话现有客户端共享及事务互斥，连接显示模型来自已提交的会话。

## Risks / Trade-offs

- 已知端口提示仍可能与整机不同。日志包含所选配置和实际 VID/PID，握手错误提示核对高级设置或更换串口。
- 提前发布会话会允许界面在未完成握手时执行操作。回归覆盖握手和初始化失败，以及紧接失败的重连。
- 会话替换可能遗留旧适配器。使用连接身份绑定缓存和操作入口。
- 宿主分块策略与固件上限可能混淆。对照既有限幅矩阵验证标准 STM、STC、Boost、GBFlash CH340 和 CDC。

## Migration Plan

在核心抽象后接线并用 Web、Tauri、模拟传输回归。连接生命周期只依赖 core 的 SelectionProvider。参数 schema/UI 后续依赖 core 与 lifecycle，不再与 lifecycle 互相循环依赖。
