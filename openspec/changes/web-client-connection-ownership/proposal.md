## Why

串口枚举失败、关闭失败和迟到的打开结果会导致连接资源所有权丢失。按审查 LC-02/03/04 改善，不改变健康连接流程。

## What Changes

- 枚举查询失败不修改连接 snapshot。
- 关闭或初始化回滚失败保留待清理句柄，阻止未经清理的新连接。
- 指定端口重连整体串行化，迟到 open 自动关闭，close 失败可重试。

## Capabilities

### New Capabilities
- `connection-resource-ownership`: 所有连接失败路径可追踪、可重试释放资源。

### Modified Capabilities
无；保留 gateway 对 UI 引用的旧清理行为，资源重试通过 transport handle 管理。

## Impact

connection use case、manager、Tauri gateway/transport 与测试；不修改 Rust、固件或线协议。
