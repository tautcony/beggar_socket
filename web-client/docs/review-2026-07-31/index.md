# Code Review Index

> 日期: 2026-07-31  
> 范围: `web-client`  
> 结论: 发现 4 个 P1 和 3 个 P2；最高风险集中在连接生命周期、multi-menu ROM 构建输入污染和异步资源竞态。

## 从这里开始

1. 了解结论：[`summary.md`](./summary.md)
2. 开始修复：[`fix-checklist.md`](./fix-checklist.md) -> [`fixes-plan.md`](./fixes-plan.md)
3. 核对证据：进入 [`phases/`](./phases/)
4. 了解基线与限制：[`phase-0-baseline.md`](./phases/phase-0-baseline.md)

## 当前状态

- P0: 0 / P1: 4 / P2: 3 / INFO: 0
- 已完成: 0 / 部分完成: 0 / 未开始: 7

## 优先处理

| Finding | 级别 | 状态 | 问题 | 证据 |
|---|---|---|---|---|
| P1-P1-1 | P1 | [ ] | connect/disconnect 生命周期竞态 | [Phase 1](./phases/phase-1-connection-state.md) |
| P1-P2-1 | P1 | [ ] | UI type 6 无构建定义 | [Phase 2](./phases/phase-2-multimenu-rom-builder.md) |
| P1-P2-2 | P1 | [ ] | 重复构建污染配置 | [Phase 2](./phases/phase-2-multimenu-rom-builder.md) |
| P1-P3-1 | P1 | [ ] | 默认资源覆盖/卸载竞态 | [Phase 3](./phases/phase-3-views-state-files.md) |

## 文档地图

| 文档 | 用途 |
|---|---|
| [`summary.md`](./summary.md) | 结论、统计、限制 |
| [`fix-checklist.md`](./fix-checklist.md) | 每个 finding 的修复主记录 |
| [`fixes-plan.md`](./fixes-plan.md) | 修复批次与验证顺序 |
| [`phases/`](./phases/) | 文件范围、触发条件、证据和漏检复盘 |

## Phase 导航

- [Phase 0: Baseline](./phases/phase-0-baseline.md)
- [Phase 1: Connection and State](./phases/phase-1-connection-state.md)
- [Phase 2: Multi-menu ROM Builder](./phases/phase-2-multimenu-rom-builder.md)
- [Phase 3: Views, Async State and Files](./phases/phase-3-views-state-files.md)
- [Phase 4: Cross-cutting and Verification](./phases/phase-4-crosscutting.md)

## 限制

- Rust/Tauri 编译未运行：当前环境无 `cargo`。
- 没有真实硬件和固件端 item-list 契约 fixture；相关结论已标注静态推断或运行时最小复现。
