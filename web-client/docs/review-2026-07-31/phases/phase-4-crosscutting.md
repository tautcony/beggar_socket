# Phase 4 审查报告: Cross-cutting and Verification

> 日期: 2026-07-31  
> 文件数: 运行时配置、协议/传输、Tauri 配置、测试基建  
> 发现: P0(0) / P1(0) / P2(0) / INFO(0)  
> 导航: [返回 review index](../index.md) | [查看修复 checklist](../fix-checklist.md)

## 已审查文件与结果

- `src/platform/serial/**`、`src/protocol/beggar_socket/**`: 复查 ACK/payload 原子读取、短包、超时、mutex 与 close guard；现有测试覆盖通过，未新增已确认缺陷。
- `src/features/burner/application/flow-template.ts`、`burner-session.ts`: 复查取消、busy/progress 收敛和回调失败路径；现有 416 项测试通过，未新增已确认缺陷。
- `src/utils/markdown.ts`、`SystemNotice*.vue`: 复查富文本清理；未发现新的未清理 `v-html` 路径。
- `src-tauri/src/lib.rs`、`capabilities/default.json`、`tauri.conf.json`: 原生保存命令和权限已静态检查；Rust 编译未能执行。

## 架构观察

### A-001: 双运行时与 legacy 状态仍需单一生命周期 owner

- 结论类型: 推定
- 依据: `ConnectionOrchestrationUseCase` 保存 snapshot，`DeviceConnectionManager` 还维护/投影 legacy `DeviceInfo`；同时 Web/Tauri gateway 各自负责 close。connect/disconnect 竞态会让两套状态和物理句柄不同步。
- 置信度: 高
- 待验证方式: 增加交错生命周期契约测试，并在 Web/Tauri/模拟 gateway 上复用同一状态机测试集。

### AR-001: 以“每个组件自行启动异步任务”作为页面初始化协议

- 结论类型: 事实/建议
- 违反或依赖的约束: 默认资源、用户文件、Jimp 预览和构建都在 composable 内独立启动，缺少统一的 latest-wins/cancellation owner。
- 触发变化: 网络/动态 import 延迟、用户快速操作、路由卸载。
- 影响范围: multi-menu 输入、预览和最终构建结果。
- 建议路径: 以资源任务 token + 页面 scope cancellation 收敛所有初始化和选择任务；先补失败/竞态测试，再替换实现。
- 首个验证信号: 快速选择自定义资源后，默认资源永不覆盖；卸载后无 toast/ref 写入。

## 漏检复盘

- 所有协议入口：ACK、payload、短读和 timeout 已横向复查。
- 所有异步链路：连接、文件、默认资源、构建和 UI flow 已检查 rejection/取消/上下文失效。
- 所有状态写入：legacy device、connection snapshot、ROM builder config 已交叉核对。
- 所有清理链路：command buffer finally、object URL、FileReader abort、Tauri close 已复查。
- 未新增 P0；本 phase 的残留限制是没有真实硬件和 Rust 编译环境。
