## Context

ConnectionOrchestrationUseCase 已串行化生命周期，但查询失败仍调用 markFailure 清空资源；manager 又自行组织两个队列操作。Tauri timeout race 丢弃成功 session。

## Goals / Non-Goals

Goals：可追踪资源、原子重连、迟到打开回收与重试关闭。Non-Goals：不改变协议和健康设备信号时序，不新增连接框架。

## Decisions

- 查询结果与生命周期 snapshot 分离，失败只返回 failure。
- 初始化失败后统一检查 cleanup 的 Result 和异常；cleanup 失败保留 handle，后续 prepare 必须先清理。
- 新增 reconnectWithSelection，把 close/open/init 放入同一既有队列；manager 只调用它。
- 超时 open 通过 settled promise 的迟到分支关闭 session；清理错误记录日志。transport close 成功才设 closed，并共享在途 close promise。
- 分三个提交：查询/回滚所有权；原子重连；迟到 open/close 重试。每个使用延迟/失败注入测试。

## Risks / Trade-offs

保留失败 handle 不能让 UI 误认 connected：仅 connected 状态有效。强制 prepare 清理失败资源，防止重复打开。late cleanup 失败无法保证驱动释放，必须记录原 sessionId 便于诊断。
