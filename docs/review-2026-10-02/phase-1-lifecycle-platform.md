# Phase 1：操作生命周期与平台集成

审查：`features/burner/application/*`、`features/burner/adapters/*`、`DeviceConnectionManager`、`useCartBurnerSessionState`、`CartBurner`、设备 gateways、Web/Tauri transport、Rust native platform、相关测试。

## LC-01 [P1 / 确认] 取消请求被当作操作完成，旧操作能清理新操作

- 位置：`web-client/src/features/burner/application/burner-session.ts:19`、`:35`、`:40`；`flow-template.ts:65`；`web-client/src/composables/cartburner/useCartBurnerSessionState.ts:84`。
- 触发：操作还在 await 传输时点击停止；`abortOperation()` 立即设 busy=false 并丢弃 controller；用户启动下一操作；旧操作进入 finally 无条件 `completeOperation()`。
- 影响：第二操作被标记完成、controller 被清除；底层 reset、模式命令和数据流可能交错。Transport 的单次 sendAndReceive 互斥不能保证整个烧写事务互斥。
- 证据：对原始 TS 进行内存 strip 后执行 start → abort → start → complete，第二操作的 busy 与 controller 被清空。现有测试只验证立即 busy=false 和取消后先等待再启动，不覆盖真实在途任务。
- 改善：操作 token + `idle/running/cancelling/recovering` 状态；取消只提出请求，确认底层退出和命令缓冲恢复后才释放独占权限；只有匹配 token 的操作允许修改进度与终结会话。
- 验收：延迟传输 + 取消 + 立即第二操作；旧 finally/进度不能污染新操作；RAM、RTC、PPB、断连统一参与设备级独占。

## LC-02 [P1 / 确认] 枚举失败丢失已连接句柄，后续 disconnect 无法释放资源

- 位置：`web-client/src/features/burner/application/connection-use-case.ts:100`、`:193`、`:263`。
- 触发：已连接时调用 `listAvailableSelections()`，list 返回 failure。
- 影响：通用 `markFailure()` 清空 handle/selection，而实际端口没有关闭；后续 disconnect 直接返回 No active connection，连接生命周期队列也不能防止这个不入队的写状态操作。
- 证据：原始类内存最小复现：成功连接 → list failure → disconnect，真实 disconnect 调用数为 0。
- 改善：枚举是查询，失败不改变连接所有权；资源释放失败保留可重试清理的 handle。进一步分离 discovery status 与 connection status。
- 验收：已连接刷新失败、connect/init 在途刷新失败、重复断连，资源所有权始终可追踪。

## LC-03 [P1 / 确认] 上层指定端口重连仍忽略 disconnect 失败

- 位置：`web-client/src/services/device-connection-manager.ts:201`，尤其 `:208`；`connection-use-case.ts:277`。
- 触发：Tauri 选择新端口前，旧端口 close 返回失败。
- 影响：manager 忽略失败结果继续 connect；use case 已清空旧 handle，无法再次清理。7 月 retryConnection 的修复并未覆盖这个上层入口。
- 改善：选择新端口重连成为一个 use case 内的原子 lifecycle 操作；先收敛旧资源，再允许新连接；manager 不重新编排两个队列动作。
- 验收：close failure 时不执行新 open；恢复后可重试；两次指定端口选择不能交错。

## LC-04 [P1 / 确认结构，延迟 open 为触发条件] Tauri open 超时没有回收迟到的成功结果

- 位置：`web-client/src/platform/serial/tauri/device-gateway.ts:111`；`web-client/src/utils/async-utils.ts:80`；`web-client/src-tauri/src/native_platform.rs:68`。
- 触发：native open 超过 5 秒，JS race 先 reject，native 随后成功并插入 serial_sessions。
- 影响：返回的 sessionId 被丢弃，缺少 late-success close 路径；重试可能遇到端口占用。
- 改善：open 任务携带 generation/撤销标记；迟到成功立即 close，或 native 端拥有可取消连接任务。避免只在 UI 中增加一次 Promise.race。
- 验收：mock 延迟到 deadline 后成功，close 恰好一次，无过期 device-ready；真机驱动慢打开补实测。

## LC-05 [P2 / 确认] 同名读超时在 Web 与 Tauri 有不同语义

- 位置：`web-client/src/platform/serial/transports.ts:378`、`:406`；`tauri/tauri-serial-transport.ts:46`。
- 触发：慢设备持续分片，每片间隔小于 timeout，但整个包耗时超过 timeout。
- 影响：Web 每次 wait 重新开始计时，表现为静默超时；Tauri 按整个包剩余 deadline 读取。相同设置在两个运行时产生不同结果。
- 改善：先明确 `idleTimeout` 与 `totalDeadline` 两种语义和默认兼容策略，再实现共享契约；不要直接统一为更短 deadline，避免慢设备回归。
- 验收：Web/Tauri/模拟共用契约用例：零字节、分片、总超时、空读、迟到字节、close 在途读取。

## LC-06 [P2 / 确认] Native 全局 sessions 锁持有至阻塞 I/O 完成

- 位置：`web-client/src-tauri/src/native_platform.rs:19`、`:260`；read/write/setSignals/flush 均通过 with_session。
- 触发：一个 session read 长时间等待，同时请求关闭、复位或操作另一个 session。
- 影响：所有会话操作串行等待全局锁；取消不能靠另一个命令及时复位，最大等待随配置 timeout 增长。
- 改善：短锁查找 session；每设备独立 actor/队列或 per-session 锁，提供可观察停止机制。先保持单设备模型，避免为多设备需求过度设计。
- 验收：native 假驱动阻塞读取时 close/cancel 有界；第二会话不被全局锁阻塞；串口信号顺序保持。

## LC-07 [P2 / 确认] 超时设置存在未接入的操作级参数

- 位置：`web-client/src/settings/advanced-settings.ts:78`；`web-client/src/components/CartBurner.vue:200`；`burner-session.ts:46`。
- 证据：operationTimeout 仅被设置、持久化、测试；业务调用链未使用。CartBurner 同名 computed 实际取 package timeout 传给进度显示；runWithTimeout 只出现在测试。
- 影响：用户以为配置了操作超时，但实际没有对应边界；直接启用 Promise.race 会重复 LC-01 的提前释放风险。
- 改善：明确显示超时/包超时/操作预算；操作预算必须与真实取消及恢复状态一同接入，先记录实际耗时，避免长烧写被默认 30 秒中断。

## 残留假设与限制

- Web writer recovery 在 abort 永不 resolve 时，下一 send 与 close 会等待无界（`transports.ts:51`、`:178`）。现有测试证明等待顺序，未证明底层 abort 有界；需要可控流与真机失败验证。
- Tauri flushInput 吞错、close 先标 closed 再等待 native 释放，需在资源所有权修复时一起定义重试行为；不把所有 cleanup 异常统一吞掉。
- `BurnerSession.runWithTimeout` Promise.race 不停止 operation，但当前无业务调用者，不作为线上故障统计。
