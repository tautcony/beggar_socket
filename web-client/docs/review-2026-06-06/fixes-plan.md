# Fixes Plan

## Batch 1: 连接失败路径收敛

目标: 消除连接生命周期半完成状态。

1. 修改 `ConnectionOrchestrationUseCase.connectAndInit()`:
   - init failure 后先构造并返回 init failure。
   - rollback disconnect 放 try/catch，失败只记录到 failure details/cause。
   - stale_context 分支 best-effort disconnect 新 handle。
2. 修改 connected 状态重复 prepare 语义:
   - 推荐直接返回现有连接，或明确拒绝重复连接。
   - 如果产品需要重连，则先 disconnect 旧 handle，再 connect 新 handle。
3. 修改 `DeviceConnectionManager.disconnectDevice()`:
   - legacy `DeviceInfo` 字段清理放 finally。
   - 抛错前保证 `isDeviceConnected(device)` 不会继续返回 true。

验证:

- 新增 `connection-usecase-orchestration.test.ts`: init 失败 + rollback disconnect 失败。
- 新增 stale_context cleanup 测试。
- 新增 `device-connection-manager.test.ts`: disconnect 失败仍清 legacy device。

## Batch 2: 协议 reset 统一 finally

目标: 任意 UI 后处理失败都不能跳过设备命令缓冲复位。

1. 在 CartBurner 层抽 helper，例如 `runAdapterOperationWithReset(adapter, body)`。
2. 把 read/write/verify/erase/read-info 的 `resetCommandBuffer()` 移入 helper finally。
3. reset 失败单独 toast/log，不覆盖原始命令结果。
4. 优先把 read ROM/read RAM 的文件保存和结果处理移动到 reset 之后。

验证:

- read ROM 成功但 `saveAsFile()` 抛错时仍调用 reset。
- `resetCommandBuffer()` 抛错时 busy/progress 收敛，错误可见。

## Batch 3: 文件读取边界统一

目标: FileReader 成功、失败、abort、卸载都可预测。

1. 新增共享文件读取 helper:
   - Promise 包装 `FileReader`
   - 处理 `load/error/abort`
   - 支持 AbortSignal 或显式 cancel
2. `FileDropZone` 使用 helper:
   - 单文件失败 emit `file-error` 或 toast
   - 多文件失败要结束 pending，明确部分成功或整批失败策略
3. `useMultiMenuState` 使用 helper:
   - unmount abort 当前 FileReader
   - 背景图每个 await 后检查 disposed

验证:

- FileReader error/abort 单测。
- 多文件中一个失败不会无限等待。
- multi-menu 卸载后不会发 toast 或更新 refs。

## Batch 4: 下载 helper 收敛

目标: object URL 生命周期一致。

1. 抽通用 safe download helper，复用 `useCartBurnerFileState.saveAsFile()` 的 try/finally 模式。
2. 替换 `useMultiMenuState.downloadRom()` 和 `RomAssemblyView.assembleAndDownload()`。
3. 失败时 toast/log。

验证:

- `a.click()` 抛错时仍 revoke URL。
- 下载失败有用户可见反馈。
