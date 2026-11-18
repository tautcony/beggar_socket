# Design

## Context

本设计基于 `web-client/docs/bunner-review.md` 的审查结论与当前 `web-client` 代码基线（见 `proposal.md`），涵盖烧录器适配器（`GBAAdapter`、`MBC5Adapter`、`CartridgeAdapter`）、Beggar Socket 协议层、Web/Tauri/Simulated `Transport`、连接管理（`DeviceConnectionManager`、`ConnectionContext`）、应用层编排（`BurnerUseCase`、`BurnerSession`、`BurnerProtocolPort`/`Session`）以及 UI 入口（`HomeView`、`CartBurner`、`AppMenu`、`CartridgeToolsModal`、`DeviceConnect`、`AdvancedSettingsModal`）。

目标结构如下：

```text
UI（CartBurner / 卡带工具 / 调试工具 / 连接控制 / 高级设置）
→ 连接级操作入口：跨入口互斥、嵌套调用复用所有权、在途取消、释放前清理（含缓冲复位与供电恢复）
→ BurnerUseCase / 工具服务：业务编排
→ 单一卡带操作契约：GBA / GB-MBC 策略与已验证的共用流程
→ Beggar Socket 协议：组包、原子收发（含 ACK 后清理）、协议错误
→ Transport：Web / Tauri / 模拟字节通道

连接上下文统一持有：transport、portInfo、有效 profile、connection generation
操作上下文捕获并校验：connection generation
```

## Goals / Non-Goals

**Goals:**
- 修复 `MBC5Adapter` 的 `verifyROM()` 5V 供电/通道稳定/重试缺陷与 `writeROM()` 误用读取页大小的问题。
- 建立跨 UI/服务入口的连接级操作互斥，支持同连接内嵌套调用复用所有权，并保证清理完成前不释放所有权。
- 补齐 `Transport` 互斥盲区（`sendAndExpectAck()` 的 ACK 后 `flushInput()` 与 `executeDebugCommand()`），在 Web/Tauri/Simulated 三端保持一致。
- 消除 `DeviceInfo` 与 `serialHandle` 的重复可变状态，接入连接 `generation` 生命周期校验，并在高级设置中补齐 `romReadPageSize` 控件与生效 profile 提示。
- 清理 `PlatformOps` 半迁移残留与不可达旧擦除链路，收敛重复卡带操作契约与无损结果转换。

**Non-Goals:**
- 不修改 STM/STC 固件。
- 不实现固件 profile 自动识别或连接空闲时的热切换。
- 不实现部分扇区擦除前的读-改-写，不补齐 MBC1/MBC2 bank 切换。

## Decisions

### 1. MBC5Adapter `verifyROM()` 与 `writeROM()` 定点修复（优先于重构）
- **决策**：先独立修复 `MBC5Adapter.verifyROM()` 与 `writeROM()`，再推进所有权与架构收敛。
  - `verifyROM()`：在 `PerformanceTracker` / 读取循环外层包裹 `withOptional5v(enable5V, ...)`（与 `writeROM()` 一致），在分块循环前调用 `stabilizeCommandChannel()`，分块读取改用 `readROMChunkWithRetry()`（失败时复位通道并恢复当前 bank 后按 `romReadRetryCount` 重试）。
  - `writeROM()`：将 `resolveRomReadPageSize(options.romPageSize)` 改为 `resolveRomPageSize(options.romPageSize)`，使真实设备编程块受 `AdvancedSettings.romPageSize`（上限 `0x1000` = 4096 B）约束，模拟设备保留独立放大分支。
- **备选方案**：等 `PlatformOps` 读取模板统一后再一并修复。
- **取舍**：先修缺陷可立即消除硬件超时与校验假阴性风险，且为后续模板重构提供干净的回归基线。

### 2. 连接级操作所有权（支持重入）与 `Transport` 原子原语
- **决策**：
  - **连接级互斥**：在连接上下文/协调器上维护连接级操作锁（持有当前操作所有者 token/作用域）。`CartBurner`（通过 `BurnerSession` / `runBurnerFlow`）、`CartridgeToolsModal`（RTC/震动/PPB）、`DebugTools`（`executeDebugCommand`）与 `DeviceConnect`（重置/断开）均通过同一连接级入口获取所有权；busy 时返回可识别的 busy 结果并由 UI 共享禁用状态与提示。
  - **可重入嵌套**：同一操作链内的嵌套调用（`writeROM → eraseSectors`、`verifyRAM → readRAM`、免电存档、PPB 解锁等）沿用当前所有权上下文，避免重入死锁。
  - **释放前清理**：将 `withCommandBufferReset()` 及 3.3V 供电恢复纳入所有权释放前的 `finally` 阶段，确保在 `completeOperation()` 与释放连接锁之前完成。
  - **`Transport` 原子原语**：在 `Transport` 接口增加受控的原子事务或带读后清理选项的方法（如 `sendAndReceive(..., { flushAfterRead?: boolean })` 或 `runExclusive(tx => ...)`），内部调用不重复加锁的原语执行 send → read → `flushInput()`，并同步实现于 Web、Tauri 与 Simulated `Transport`；`executeDebugCommand()` 改用 `sendAndReceive()`。
- **备选方案**：仅靠 UI 层 disabled 状态防并发。
- **取舍**：UI 状态无法阻止程序化调用或异步竞态，且无法解决 `sendAndExpectAck()` 在 `sendAndReceive()` 锁外调用 `flushInput()` 的协议层交错；必须由连接级所有权 + Transport 临界区共同保证。

### 3. 连接信息唯一来源、Profile 生效时机与 Generation 校验
- **决策**：
  - 由 `ConnectionContext` 作为 `transport`、`portInfo`、有效 `firmwareProfile` 与 `generation` 的唯一权威来源；精简或只读化 `DeviceInfo` 与 `serialHandle` 的重复字段，消除 `resetCommandBuffer()` 等只读顶层字段的回退分叉。
  - `withPortInfo()` 仅更新端口元数据，不再将 `firmwareProfile` 临时改写为端口推断值；profile 解析集中于连接初始化阶段，并在整次操作期间固定。
  - 创建操作上下文/会话时捕获当前连接 `generation`，每次执行操作前比对当前有效连接的 `generation`，不匹配时立即以 `stale_context` / 断连错误拒绝。
  - `AdvancedSettingsModal.vue` 新增 `romReadPageSize` 编辑控件（复用 `AdvancedSettings` 校验规则），并在固件设置区展示当前连接生效的 profile 与“修改将在重连或重新初始化后生效”提示。
- **备选方案**：允许在设备空闲时热更新当前连接的 `firmwareProfile`。
- **取舍**：热切换需要同步刷新适配器持有的 profile 引用与状态机，且用户已确认本次保持“手动选择 + 重连/重初始化生效”语义。

### 4. `PlatformOps` 半迁移收敛与旧链路清理
- **决策**：
  - 先验证并补齐三处平台差异：`MBC5Adapter.createPlatformOps().toRomBank()` 尊重 `options.mbcType`（区分 MBC3 `0x0000` 与 MBC5 `0x4000`）、5V 能力前置检查在日志/`PerformanceTracker`/供电前执行、`romReadThrottleMs` 与默认 `size` 语义一致。
  - 在补齐差异后，统一 `readROM()` / `getCartInfo()` 共享路径（或若评估收益不足则移除基类未启用的 `readROM()` / `getCartInfo()` / `withPowerConfig()` 模板），同时删除无调用方的 `PlatformOps.romProgram` / `romEraseSector` 以及脱离生产入口的 `eraseChip()`、`rom_erase_chip()`、`gbc_rom_erase_chip()`、`rom_erase_sector_direct()`。
- **备选方案**：保留半迁移模板与旧擦除包装以维持历史兼容。
- **取舍**：保留两套并行的读取实现与不可达擦除包装持续制造维护陷阱；直接清理可消除双份实现与误调用风险。

### 5. 单一卡带操作契约与无损结果表达
- **决策**：
  - 将 `BurnerProtocolPort` 与 `BurnerProtocolSession` 合并为单一应用层卡带操作契约（由 `CartridgeAdapter` 实现或单层适配器接入），保留 `BurnerUseCase` 的读卡组装、全片扇区计算、多卡扫描编排以及 `scripts/check-architecture-deps.cjs` 的依赖方向约束。
  - 去掉 `CommandResult → BurnerDomainResult<CommandResult> → CommandResult` 的往返包装，使 `readCartInfo()` 等操作保留底层错误原因（如 5V 不支持、CFI 解析失败、超时/取消），同时保留连接编排所需的 `BurnerDomainResult` 与 `ConnectionFailure` 契约。

## Risks / Trade-offs

- **[Risk] 连接级可重入锁在异步并发下误判重入** → 通过显式传递操作上下文/Token（而非全局静态标记）识别合法嵌套调用，外部新入口无 Token 时一律视为并发冲突返回 busy。
- **[Risk] 清理 `PlatformOps` 与合并端口契约影响大量现有测试替身** → 按第 7 节顺序分步实施，每一步独立运行对应单测与 `scripts/check-architecture-deps.cjs`，避免跨步骤混改。
- **[Risk] Tauri/Web/Simulated 三端 Transport 原子清理实现不一致** → 为三端编写统一的 Transport 原子性与并发回归测试，验证互斥锁内无重入死锁。

## Migration Plan

按 `web-client/docs/bunner-review.md` 第 7 节顺序分 6 步推进，每步独立验证：
1. 修复 `MBC5Adapter.verifyROM()` 供电、稳定化与重试。
2. 修复 `MBC5Adapter.writeROM()` 页大小解析。
3. 统一连接级操作所有权、清理时序与 `Transport` 原子操作能力。
4. 统一连接信息来源、接入 `generation` 校验，并补齐高级设置 UI 控件与提示。
5. 收敛 `PlatformOps` 半迁移状态并删除旧擦除链路。
6. 合并重复卡带操作契约与无损结果表达，并运行全量测试与架构依赖检查。
