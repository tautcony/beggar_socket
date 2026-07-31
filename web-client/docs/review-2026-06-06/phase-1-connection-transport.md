# Phase 1 Connection And Transport

范围: `src/platform/serial/**`, `src/protocol/beggar_socket/**`, `src/services/device-connection-manager.ts`, `src/features/burner/application/connection-use-case.ts`, 相关测试。

## Findings

### P1-01: init 失败后的 rollback disconnect 可覆盖原始失败并跳过状态收敛

- 位置: `src/features/burner/application/connection-use-case.ts:228`
- 触发条件: `connectionPort.connect()` 成功打开新 handle，随后 `connectionPort.init()` 返回失败；紧接着 rollback `connectionPort.disconnect(connectResult.data)` 也失败。
- 影响: `await this.connectionPort.disconnect(connectResult.data)` 在 `markFailure()` 之前执行，rollback 失败会直接抛出并越过 `markFailure()`。调用方无法收到规范化的 init failure，snapshot 可能停留在 `connecting`，后续 `ensureConnected()` / retry 会基于错误状态继续运行；原始 init 错误也被 close 错误覆盖。
- 证据: `connection-use-case.ts:228-233` 先 await disconnect 再 mark failure；`tests/connection-usecase-orchestration.test.ts:60-82` 只覆盖 init 失败且 disconnect 成功的路径。
- 修复方向: rollback disconnect 用 best-effort try/catch，不允许覆盖原始 init failure；将 rollback 错误挂到 failure cause/details。补测试: init 失败 + rollback disconnect 失败时仍返回 `success:false`、state 为 `failed`、context 清空。

### P1-02: manager 层断开失败时 legacy DeviceInfo 未清理，UI 可能继续认为设备已连接

- 位置: `src/services/device-connection-manager.ts:287`
- 触发条件: `disconnectDevice(device)` 调用 `connectionUseCase.disconnect()`，底层 close/driver 失败导致 result `success:false`。
- 影响: orchestration 和 gateway 已经清空内部 handle/port，但传入的 legacy `DeviceInfo` 只在成功路径 `deviceConnectionManager.ts:297-300` 清字段。失败时直接抛错，`isDeviceConnected()` 仍会因旧 `transport/port/connection` 返回 true，UI 与真实连接状态分叉。
- 证据: `device-connection-manager.ts:288-295` 失败即抛，`device-connection-manager.ts:306-307` 用 legacy 字段判断连接；`tests/device-gateway.test.ts` 覆盖 gateway close 失败清 handle，但 `tests/device-connection-manager.test.ts` 没有覆盖 manager 层 close 失败同步。
- 修复方向: `disconnectDevice()` 使用 `finally` 清理 legacy `DeviceInfo`，或根据 connection snapshot 同步 legacy 状态后再抛错。补 manager 层断开失败测试，断言 `isDeviceConnected(device) === false`。

### P2-01: connected 状态下重复 prepareConnection 可替换 snapshot 而不释放旧 handle

- 位置: `src/features/burner/application/connection-use-case.ts:208`
- 触发条件: 已 connected 且存在 handle 时再次调用 `prepareConnection()` / `prepareConnectionWithSelection()`，并且调用方没有先执行 disconnect。
- 影响: `connectAndInit()` 直接打开新连接并 `markConnected()` 替换 snapshot，旧 `previousHandle` 只用于 stale id 检测，没有释放。未来自动重连或入口误用会泄漏旧串口/transport。
- 证据: `connection-use-case.ts:208-237` 没有 connected guard；`previousHandle` 不参与 cleanup。
- 修复方向: 明确 use case 语义: connected 时返回现有连接、拒绝重复连接，或先 best-effort disconnect 旧 handle 再连接。补重复 prepare 不泄漏旧 handle 的测试。

### P2-02: stale_context 分支未释放刚打开的新 handle

- 位置: `src/features/burner/application/connection-use-case.ts:218`
- 触发条件: `connectionPort.connect()` 返回的 `id` 与 previous handle 相同，触发 stale guard。
- 影响: 状态会 mark failed，但 `connectResult.data` 可能已经打开底层连接，未 best-effort disconnect。
- 证据: `connection-use-case.ts:218-225` 直接 mark failure。当前生产 adapter 用递增 sequence 基本避免该分支，因此严重度低于 P1。
- 修复方向: stale 分支先 best-effort disconnect 新 handle，再 mark failure。补 adapter double 测试。

## 已排查未命中

- `WebSerialTransport.sendAndReceive()` 已有 mutex；写超时有 writer recovery；close 对 reader cancel 和 pump shutdown 有 2s 兜底。
- `TauriSerialTransport` close 后 send/read/setSignals 有 closed guard，短读会循环补齐或超时。
- 协议 ACK 和 payload 读已走 atomic `sendAndReceive`，相关测试覆盖超时和短包分类。
- `Mutex` 重复 release 不破坏队列，已有单测覆盖。

## 漏检复盘

本 phase 重点检查了异步失败、rollback、重复连接、资源释放、协议闭合和状态半提交窗口。未发现新的协议读写竞态；新增问题集中在连接生命周期失败组合和 legacy facade 状态同步。
