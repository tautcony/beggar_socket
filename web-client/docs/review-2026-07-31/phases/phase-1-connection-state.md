# Phase 1 审查报告: Connection and State

> 日期: 2026-07-31  
> 文件数: 8  
> 发现: P0(0) / P1(1) / P2(0) / INFO(0)  
> 导航: [返回 review index](../index.md) | [查看修复 checklist](../fix-checklist.md)

## 已审查文件

- `src/features/burner/application/connection-use-case.ts`
- `src/features/burner/application/domain/connection.ts`
- `src/features/burner/adapters/device-gateway-connection-port.ts`
- `src/features/burner/adapters/connection-orchestration-factory.ts`
- `src/services/device-connection-manager.ts`
- `src/components/DeviceConnect.vue`
- `src/views/HomeView.vue`
- `tests/connection-usecase-orchestration.test.ts`

## Findings

### P1-P1-1: [P1] connect 与 disconnect 可并发，后发 disconnect 会被已在途 connect 覆盖

- 位置: `src/features/burner/application/connection-use-case.ts:79-80, 132-149, 280-326`
- 触发条件: `prepareConnection()` 已进入 `list/select/connect/init` 任一步等待期间调用 `disconnect()`。两个方法只分别检查 `isConnecting`/`isDisconnecting`，没有共享互斥或 generation/cancellation；若 disconnect 先看到尚无 handle，会直接把快照置为 `idle`，在途 connect 随后仍会执行 `markConnected()`。
- 影响: UI/快照显示“已断开”后又恢复“已连接”，用户的断开动作失效；`retryConnection()`（329-333）也忽略 disconnect 失败后继续 prepare，可能在旧物理 handle 未释放时重新打开同一端口。
- 证据: 静态路径；现有测试只覆盖串行 connect/disconnect，未覆盖交错时序。
- 置信度: 高。
- 修复方向: 为连接生命周期建立单一互斥队列，或给每次连接分配 generation 并在 connect/init 完成前检查取消/最新 generation；`retryConnection()` 必须处理 disconnect 失败并禁止在未知物理状态上重新连接。

#### 修复 Checklist

- [ ] 复现：使用 deferred `connect/init`，在其 pending 时调用 `disconnect()`，确认最终 snapshot 不会回到 `connected`。
- [ ] 实施修复：统一 connect/disconnect/retry 的互斥和取消语义。
- [ ] 回归测试：增加 connect-in-flight、disconnect-in-flight、retry cleanup failure 三组负向测试。
- [ ] 相邻路径验证：检查 Tauri 端口关闭失败、Web Serial close、HMR cleanup 和重复点击。
- [ ] 执行验证并记录证据：`npm run test:run`、`npm run type-check`。
- [ ] 发布/监控/文档动作：N/A（无需迁移）。
- 当前状态: [ ] 未开始
- 负责人/批次: 未分配 / Batch 1
- 最后更新: 2026-07-31

## 漏检复盘

- 默认分支/未知输入: 连接 failure stage 已有映射；本 phase 新增关注生命周期交错。
- 异步失败/前提失效: 已检查 init rollback、disconnect failure、retry；并发缺口如上。
- 半完成状态: 已检查 orchestration snapshot 与 legacy `DeviceInfo` 的同步清理；未发现新的单次 disconnect 清理缺口。
- 渲染/导出/编码: 不适用于本 phase。

## 未覆盖区域

- 无真实硬件运行时观测；Tauri Rust 编译受环境限制。
