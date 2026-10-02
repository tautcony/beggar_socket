# 模块：Tauri Runtime

`src-tauri/src/lib.rs` 注册 native commands；`src-tauri/src/native_platform.rs` 管理 serial sessions，`src/platform/serial/tauri/tauri-serial-transport.ts` 从前端调用 native。

registry 仅在查找/插入/移除 session 时持全局短锁。每个 session 独立持有 driver、closing 状态与 mutex；async command 用 spawn_blocking 执行真实 driver I/O，阻塞一个 session 不占用其他 session 的全局锁。

read/write 使用小时间片和整个调用 deadline，close 请求停止并等待真实 I/O、恰好一次 dispose。Windows write 返回零字节时重试但受总 deadline 约束。OS flush 缺乏可移植取消保证，必须等待真实完成；这一限制保留在恢复语义中。

`src-tauri/src/native_platform_tests.rs` 使用假 driver/thread/barrier 验证会话隔离、停止、close 与资源释放。在 src-tauri 目录执行 `cargo check --locked`、`cargo test --locked`；CI Windows native job 与前端 quality 都是打包前置。物理驱动失败/慢打开/flush 仍需实测。
