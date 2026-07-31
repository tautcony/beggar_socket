# Code Review Summary

> 日期: 2026-07-31  
> 范围: `web-client` 全模块（排除生成物）  
> 审查方式: 串行 systemic review；未使用 sub-agent

## 统计

| 严重度 | 数量 |
|---|---:|
| P0 | 0 |
| P1 | 4 |
| P2 | 3 |
| INFO | 0 |
| 合计 | 7 |

## Findings（按优先级）

1. **P1-P1-1**：connect/disconnect 生命周期未互斥，在途 connect 可覆盖后发 disconnect；`retryConnection()` 还忽略 disconnect 失败。见 [Phase 1](./phases/phase-1-connection-state.md)。
2. **P1-P2-1**：UI 暴露的 cartridge type 6 没有构建器定义，选择后必然失败。见 [Phase 2](./phases/phase-2-multimenu-rom-builder.md)。
3. **P1-P2-2**：ROM 构建器原地递减 `title_font/save_slot`，重复构建静默输出错误元数据。见 [Phase 2](./phases/phase-2-multimenu-rom-builder.md)。
4. **P1-P3-1**：默认 multi-menu 资源任务没有 latest-wins/disposed 保护，会覆盖用户输入或在卸载后产生副作用。见 [Phase 3](./phases/phase-3-views-state-files.md)。
5. **P2-P2-3**：标题长度字段未按固定 0x30 字符槽截断。见 [Phase 2](./phases/phase-2-multimenu-rom-builder.md)。
6. **P2-P3-2**：FileDropZone 读取失败只写 console，用户没有错误反馈。见 [Phase 3](./phases/phase-3-views-state-files.md)。
7. **P2-P3-3**：多次快速选择文件时旧异步任务可以覆盖新输入。见 [Phase 3](./phases/phase-3-views-state-files.md)。

## 已确认的正向保护

- 2026-06-06 报告中的 init rollback、legacy device finally 清理、command buffer finally、FileReader helper 和 object URL finally 已在当前路径实现，并由现有测试/静态复读支持。
- `npm run lint`、`npm run type-check`、`npm run check:deps` 和 `npm run test:run` 全部通过；43 个测试文件共 416 项通过。

## 差异化反证复查

- 所有连接/协议入口：检查了未知选择、失败回传、并发、超时和清理。
- 所有异步链路：检查了 rejection、取消、卸载、重复提交和上下文失效。
- 所有状态写入：检查了 snapshot/legacy device、Pinia result、ROM builder 派生字段的半完成状态。
- 所有渲染/导出/高杠杆工具：检查了 `v-html` 清理、object URL、标题编码、路径和摘要；未新增 P0。

## 未覆盖与限制

- `cargo check` 未执行成功，环境没有 `cargo`；Tauri 权限和实际打包行为仅静态检查。
- 没有真实 Web Serial/Tauri 设备来验证断连、超时和固件端 item-list 解析。
- `services/lk` 的完整算法契约仍需要固件 fixture；本次已验证的重复构建和 type 6 问题不依赖该 fixture。
