# Phase 2 Application Operations

范围: `src/components/CartBurner.vue`, `src/features/burner/application/**`, `tests/burner-application.test.ts`。

## Findings

### P1-03: 操作后的 resetCommandBuffer 不在 finally，导出/日志等后处理异常会跳过协议复位

- 位置: `src/components/CartBurner.vue:406`, `441`, `494`, `568`, `610`, `656`, `692`, `745`, `783`, `825`, `896`
- 触发条件: 烧录/读取/校验命令完成后，在执行 `resetCommandBuffer()` 之前的后处理发生异常，例如 `saveAsFile()`、`parseRom()`、`recentFileNamesStore.addFileName()`、toast/log、或结果弹窗状态更新抛错。
- 影响: `runBurnerFlow()` 会收敛 busy/progress，但不会保证协议 command buffer 复位。下一次命令可能在设备侧残留输出/状态上开始，表现为 ACK 错位、读包超时或必须重新插拔设备。
- 证据: `CartBurner.vue:535-568` 中 read ROM 先解析和保存文件，最后才 reset；`flow-template.ts` 的 finally 只 complete operation/reset progress/sync state，没有协议清理钩子。
- 修复方向: 把需要协议复位的操作改成共享 helper: command execution 放 try，`resetCommandBuffer(adapter)` 放 finally，并单独捕获 reset 失败写日志。读/导出等 UI 后处理应在协议 reset 之后执行，或至少不能阻止 reset。
- 测试缺口: 需要覆盖 read ROM 成功但 `saveAsFile()` 抛错时仍调用 `resetCommandBuffer()`；以及 `resetCommandBuffer()` 抛错时 busy 状态仍收敛并提示用户。

## 已排查未命中

- `runBurnerFlow()` 已覆盖 AbortError、runtime error 后 busy 收敛和后续操作恢复。
- `BurnerSession` 日志截断、progress reset、cancel 后状态恢复已有单测。
- `verifyRom` 对必须有 abort signal 的断言明确，当前调用均通过 cancellable flow 进入。

## 漏检复盘

本 phase 反向检查了下游失败后上游状态是否恢复、延迟后处理是否阻断协议清理、取消后是否能继续操作。未发现 busy 状态永久卡住；主要缺口是设备协议复位没有放在不可跳过的 finally 中。
