# Phase 0 Baseline

日期: 2026-06-06
范围: `web-client`
审查类型: 缺陷风险审查，覆盖生产代码、配置、测试与历史 review 结论。

## 技术栈与边界

- Vue 3 + TypeScript + Vite，桌面端通过 Tauri 2 串口插件接入。
- 关键分层:
  - 接入/视图: `src/views`, `src/components`
  - 状态/composable: `src/composables`, `src/stores`, `src/settings`
  - 应用编排: `src/features/burner/application`
  - 基础设施/协议: `src/platform/serial`, `src/protocol/beggar_socket`, `src/services`
  - 验证: `tests`, `scripts/check-architecture-deps.cjs`
- 已有架构约束: UI 不直接依赖 protocol，串口入口逐步收敛到 DeviceGateway + Transport。

## 背景与历史问题

已读取:

- `web-client/README.md`
- `web-client/docs/modules/00-overview.md`
- `web-client/docs/review-2026-04-15/summary.md`
- `web-client/docs/review-2026-04-17/summary.md`

历史缺陷中，协议层原子 `sendAndReceive`、Web/Tauri disconnect 清 handle、writer recovery、mutex 重复 release 等重点路径本轮复查后未重复报告；当前测试已覆盖其中多条路径。

## 本轮 Phase

1. 平台/连接/协议: `platform/serial`, `protocol/beggar_socket`, `device-connection-manager`, connection use case。
2. 应用操作编排: `CartBurner.vue`, `features/burner/application`, operation reset/abort/error path。
3. 视图/状态/文件/渲染: `components`, `views`, `composables`, `stores`, markdown/system notice。
4. 交叉复盘: 默认分支、异步失败、半完成状态、富文本、下载与高杠杆工具函数。

## 高风险模式预判

- 默认分支 / 未知输入 / 非法状态: 存在，主要集中在连接生命周期状态组合、文件输入扩展名过滤和 legacy facade 状态同步。
- 异步失败路径 / rejection / 协议未闭合: 存在，主要集中在 init rollback、operation 后 reset、FileReader error/abort。
- 持久化、缓存、索引、派生状态半完成: 存在，主要集中在 legacy `DeviceInfo` 与 orchestration snapshot 分叉。
- 内容渲染、富文本、导出链路: 富文本路径经 DOMPurify；下载链路仍有 object URL finally 不一致问题，但影响低于主流程协议风险。
- 隐式协议: 存在，串口 handle id、DeviceInfo 字段、FileReader 完成计数均依赖隐式约定。

## 漏检复盘

已主动复查历史 P0/P1 中的 mutex、atomic transport、disconnect handle cleanup、markdown XSS、WebSerial close/recovery 路径；未重复报告已由当前实现或测试覆盖的旧问题。
