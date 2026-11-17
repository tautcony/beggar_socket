# Tasks

## 1. 修复 MBC5Adapter verifyROM 供电、稳定化与重试

- [x] 1.1 在 `web-client/src/services/mbc5-adapter.ts` 的 `verifyROM()` 中用 `withOptional5v(enable5V, ...)` 包裹校验执行，在分块读取前调用 `stabilizeCommandChannel()`，并将分块读取改为调用 `readROMChunkWithRetry()`（通道复位后恢复当前 bank）；运行 `tests/services/adapters` 验证 5V 切换/恢复、成功/失败/取消后清理及 `romReadRetryCount` 重试行为。

## 2. 修复 MBC5Adapter writeROM 页大小解析

- [x] 2.1 将 `web-client/src/services/mbc5-adapter.ts` 的 `writeROM()` 中的 `resolveRomReadPageSize(options.romPageSize)` 替换为 `resolveRomPageSize(options.romPageSize)`，保持模拟设备独立放大分支；补充单元测试覆盖 `romPageSize` 为 512 B / 1 KiB 生效，以及人工设置 STC `romReadPageSize = 32 KiB` 且不传 `options.romPageSize` 时真实设备编程块仍 ≤ 4096 B，并运行 `tests/services/adapters` 验证通过。

## 3. 统一连接级操作所有权与 Transport 原子操作能力

- [x] 3.1 扩展 `web-client/src/platform/serial/types.ts` 中的 `Transport` 原子操作契约（覆盖 ACK 后 `flushInput()` 且互斥锁内不重复加锁），并在 Web、Tauri 与 Simulated `Transport` 实现中同步落地；在 `tests/platform/serial` 与 `tests/protocol` 补充三端原子清理与互斥测试并验证通过。
- [x] 3.2 修改 `web-client/src/protocol/beggar_socket/protocol-utils.ts` 的 `sendAndExpectAck()` 使用 `Transport` 原子清理路径，并将 `web-client/src/services/debug-protocol-service.ts` 的 `executeDebugCommand()` 改为通过 `Transport.sendAndReceive()` 收发；运行 `tests/protocol` 验证 ACK 清理不干扰后续请求且调试命令不再绕过请求锁。
- [x] 3.3 建立连接级操作所有权协调入口（支持同连接嵌套调用复用所有权，拒绝并发请求并返回可识别 busy 结果），接入 `CartBurner`、`AppMenu`/`CartridgeToolsModal`（RTC/震动/PPB）、`DebugTools` 与 `DeviceConnect`（重置/断开），并确保 `resetCommandBuffer()` 与 3.3V 供电恢复在释放所有权前完成；补充并发拒绝、嵌套不死锁与清理时序测试并验证 UI 共享忙碌状态禁用冲突入口。

## 4. 统一连接信息来源、Profile 生效提示与连接生命周期校验

- [x] 4.1 重构 `DeviceConnectionManager`、`ConnectionContext` 与 `DeviceInfo`/`DeviceHandle`，由连接上下文唯一持有 `transport`、`portInfo`、有效 `firmwareProfile` 与连接 `generation`；移除 `withPortInfo()` 覆写 `firmwareProfile` 的副作用，并统一 `resetCommandBuffer()` 等读取路径。
- [x] 4.2 在创建操作上下文与烧录会话时捕获连接 `generation`/身份并在执行时校验，使断连或重连后的旧会话立即失效；运行 `tests/services/device-connection-manager.test.ts` 与 `tests/features/burner` 验证端口信息更新保留有效 profile、重连应用新配置且旧会话被拒绝。
- [x] 4.3 在 `web-client/src/components/modal/AdvancedSettingsModal.vue` 补充 `romReadPageSize` 编辑与校验控件，并在固件设置区展示当前连接生效 profile 及“修改将在重连或重新初始化后生效”提示；补充组件/设置测试验证保存校验与提示渲染。

## 5. 处理 PlatformOps 半迁移状态并清理旧链路

- [x] 5.1 补齐或对齐平台读取差异：`MBC5Adapter.createPlatformOps().toRomBank()` 尊重 `options.mbcType`（MBC3 `0x0000` / MBC5 `0x4000`）、5V 能力前置检查、`romReadThrottleMs` 与默认 `size` 参数，并完成读取共享路径统一（或移除未启用的基类 `readROM`/`getCartInfo`/`withPowerConfig` 模板）。
- [x] 5.2 移除 `PlatformOps` 中无调用方的 `romProgram`/`romEraseSector` 字段及生产不可达的 `eraseChip()`、`rom_erase_chip()`、`gbc_rom_erase_chip()`、`rom_erase_sector_direct()` 旧链路；新增/运行 GBA、MBC5、MBC3 命令序列对比测试，覆盖 bank 边界、读取重试、STM 拒绝 5V、STC 供电恢复与 MBC1/2 未实现错误。

## 6. 合并重复卡带操作接口和结果表达

- [x] 6.1 将 `BurnerProtocolPort` 与 `BurnerProtocolSession` 收敛为单一应用层卡带操作契约并由单层适配器接入 `GBAAdapter`/`MBC5Adapter`，保留 `BurnerUseCase` 编排职责（读卡组装、全片扇区计算、多卡扫描）与连接错误契约。
- [x] 6.2 消除 `CommandResult → BurnerDomainResult<CommandResult> → CommandResult` 往返转换，保留底层错误分类与 `readCartInfo` 具体失败原因；补充并运行测试验证成功、超时、取消、断连、能力不支持与 `readCartInfo` 失败原因透传。

## 7. 集成回归与架构检查

- [x] 7.1 在 `web-client/` 运行完整相关测试集（`npm run test:run -- tests/services/adapters tests/features/burner tests/protocol tests/platform/serial tests/utils/firmware-profile.test.ts tests/utils/transfer-plan.test.ts tests/services/device-connection-manager.test.ts`）以及架构依赖检查脚本（`scripts/check-architecture-deps.cjs`），确认全部通过且无新增架构违规。
