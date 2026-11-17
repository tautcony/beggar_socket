# Proposal

## Why

基于 `web-client/docs/bunner-review.md` 对烧录器读写、设备能力、命令协议与串口传输的系统性审查，当前 `web-client` 存在若干可靠性缺陷与架构冗余：

1. **MBC 校验与写入实现缺陷**：`MBC5Adapter.verifyROM()` 在 `enable5V: true` 时仅检查能力而未切换/恢复 5V 供电，且跳过 `stabilizeCommandChannel()` 与 `readROMChunkWithRetry()`，导致 `romReadRetryCount` 不生效；`MBC5Adapter.writeROM()` 误用 `resolveRomReadPageSize()` 替代 `resolveRomPageSize()`，导致用户配置的写入页大小（如 512 B / 1 KiB）失效，且当 `romReadPageSize` 增大时可能生成超过 STC `cmdBuf[5500]` 容量的编程块。
2. **跨入口设备操作缺少连接级互斥**：`BurnerSession.busy` 与 `Transport.sendAndReceive()` 互斥锁无法阻止卡带工具（RTC/震动/PPB）、调试工具（直接调用 `sendPackage`/`getPackage`）和连接控制（重置/断开）与在途读写并发交错；`sendAndExpectAck()`、`cart_power()` 和通道复位也在互斥锁外操作输入缓冲或控制线；清理动作与所有权释放时序也不一致。
3. **连接信息重复存储与 Profile 生效时机不明确**：`DeviceInfo` 与 `serialHandle` 重复持有 `port`/`transport`/`portInfo`/`firmwareProfile`，`withPortInfo()` 会临时覆盖 profile，操作上下文未校验连接 `generation`/身份，且设置界面未展示当前连接生效的 profile 及重连生效说明，也缺少 `romReadPageSize` 编辑控件。
4. **半迁移的 `PlatformOps` 与重复卡带契约**：`CartridgeAdapter` 基类读取模板与 `withPowerConfig()`、`PlatformOps.romProgram`/`romEraseSector`、旧 `eraseChip()` 链路脱离生产路径；`BurnerProtocolPort` 与 `BurnerProtocolSession` 重复定义卡带操作契约，且 `CommandResult → BurnerDomainResult<CommandResult> → CommandResult` 往返转换丢失错误类型与 `readCartInfo` 失败原因。

## What Changes

- **修复 MBC 校验与写入缺陷**：
  - `MBC5Adapter.verifyROM()` 在 `enable5V` 时包裹 `withOptional5v()`，读前执行 `stabilizeCommandChannel()`，分块读取复用 `readROMChunkWithRetry()` 并在通道复位后恢复 bank。
  - `MBC5Adapter.writeROM()` 改用 `resolveRomPageSize()`，遵守已校验写入设置（真实设备上限 4096 B）与调用方更小限制，保留模拟设备独立放大分支。
- **统一连接级操作所有权与 Transport 原子能力**：
  - 为同一连接建立统一的操作入口，覆盖烧录读写、卡带工具、调试命令、连接重置/断开与结束清理；支持同连接内嵌套调用复用所有权，拒绝并发请求并返回可识别的 busy 结果，UI 共享忙碌状态并禁用冲突入口。
  - 确保 `resetCommandBuffer()`、默认 3.3V 供电恢复等清理动作在释放连接所有权之前完成。
  - 扩展 `Transport` 原子操作契约（覆盖 ACK 后 `flushInput()` 与调试收发），并同步更新 Web、Tauri 与模拟 Transport 实现。
- **统一连接信息来源、Profile 生效提示与连接生命周期校验**：
  - 由连接上下文唯一持有 `transport`、`portInfo`、有效 `firmwareProfile` 与连接 `generation`/身份；`withPortInfo()` 仅更新端口信息，不再覆盖 profile。
  - 保持手动 profile 选择与“重连/重新初始化生效”语义；操作上下文捕获并校验连接 `generation`/身份，使旧会话在重连后立即失效。
  - 在 `AdvancedSettingsModal` 补充 `romReadPageSize` 编辑控件，并展示当前连接生效 profile 及重连/重新初始化生效提示。
- **清理 `PlatformOps` 半迁移状态与旧擦除链路**：
  - 对齐平台差异（MBC3/MBC5 bank 0 基址映射、5V 能力前置检查、`romReadThrottleMs` 与默认参数）并决定统一读取模板或移除未启用基类模板；清理无调用方的 `PlatformOps.romProgram` / `romEraseSector` 及脱离生产入口的 `eraseChip()` / `rom_erase_sector_direct()` 旧链路。
- **合并重复卡带操作契约与结果表达**：
  - 将 `BurnerProtocolPort` 与 `BurnerProtocolSession` 的卡带操作职责收敛为单一应用层契约，去掉 `CommandResult → BurnerDomainResult<CommandResult> → CommandResult` 往返包装及 `readCartInfo` 失败原因丢失；保留 `BurnerUseCase` 编排职责、架构依赖隔离与连接错误契约。

## Capabilities

### New Capabilities
- `burner-settings-ui`: 高级设置界面暴露 `romReadPageSize` 编辑控件，展示当前连接生效的固件 profile 并明确提示修改在重连或重新初始化后生效。

### Modified Capabilities
- `adapter-template-operations`: 修复 `MBC5Adapter.verifyROM()` 供电与读取恢复、`MBC5Adapter.writeROM()` 页大小解析，并清理 `PlatformOps` 半迁移状态与生产不可达的旧擦除链路。
- `device-transport-gateway`: 扩展 `Transport` 原子操作契约以覆盖 ACK 后缓冲清理与调试命令收发，在 Web、Tauri 与模拟实现中保持一致的临界区语义。
- `burner-application-orchestration`: 建立跨入口的连接级操作所有权（支持嵌套调用复用、busy 反馈与释放前清理）及连接生命周期校验。
- `connection-usecase-orchestration`: 统一连接上下文对 `transport`、`portInfo`、有效 `firmwareProfile` 与连接 `generation`/身份的唯一持有，消除 `withPortInfo()` 副作用。
- `domain-port-abstraction`: 收敛重复的卡带操作端口与会话契约，消除 `CommandResult` 与 `BurnerDomainResult` 的无损外往返转换并保留底层错误原因。

## Non-Goals

- 不修改 STM/STC 固件代码。
- 本次不引入固件 profile 自动识别或连接空闲时的热切换应用功能。
- 不实现局部扇区擦除前的读-改-写保留，也不补齐未完成的 MBC1/MBC2 bank 切换。
- 不替换 Beggar Socket 协议底层。

## Impact

- **适配器与平台策略**：`web-client/src/services/mbc5-adapter.ts`、`web-client/src/services/gba-adapter.ts`、`web-client/src/services/cartridge-adapter.ts`、`web-client/src/services/platform-ops.ts`
- **协议与 Transport**：`web-client/src/platform/serial/types.ts`、Web/Tauri/Simulated Transport 实现、`web-client/src/protocol/beggar_socket/protocol-utils.ts`、`web-client/src/services/debug-protocol-service.ts`
- **连接与操作所有权**：`web-client/src/services/device-connection-manager.ts`、`web-client/src/types/device-info.ts`、`web-client/src/types/firmware-profile.ts`、`web-client/src/features/burner/application/`
- **应用层契约与适配器**：`web-client/src/features/burner/application/domain/ports.ts`、`web-client/src/features/burner/adapters/cartridge-protocol-port.ts`、`web-client/src/features/burner/application/burner-use-case.ts`
- **UI 与设置**：`web-client/src/views/HomeView.vue`、`web-client/src/components/common/AppMenu.vue`、`web-client/src/components/DeviceConnect.vue`、`web-client/src/components/CartBurner.vue`、`web-client/src/components/modal/CartridgeToolsModal.vue`、`web-client/src/components/modal/AdvancedSettingsModal.vue`
- **测试**：`web-client/tests/services/adapters/`、`web-client/tests/features/burner/`、`web-client/tests/protocol/`、`web-client/tests/platform/serial/`、`web-client/tests/services/device-connection-manager.test.ts`
