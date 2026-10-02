# Web Client 实施记录

用户要求：Web Client 为主要范围；每项带对应单元测试，完成一项提交一项。用户 stash 保留不恢复。

后续实施方式：每项由独立 subagent 执行，主 agent 审查、验证、逐项提交。互不重叠的任务并行；依赖任务按前置提交完成后启动。

## 已完成

- 测试基线：大型二进制输出使用精确线性比较，覆盖 view offset、长度和首/中/末字节差异。LK 回归仍固定时钟并检查输入不变；10 项 focused tests 通过，耗时 1.77 秒。
- CI：Web/Tauri 共用固定运行时的质量工作流，Pages/Tauri build 依赖 quality；4 项 YAML 工作流契约通过，原有 448 项测试通过。

扩大回归：完成取消/协议/连接后，52 个文件 497 项测试通过（不含实施中的设置/bank 新回归）；类型检查曾全项目通过，最终仍需所有任务合并后的全量门禁。

## 范围与剩余工作

- 适配器共享读取规则、UI 命令编排已完成。
- 后续：超时契约和默认关闭的操作预算、性能证据与安全懒加载、当前架构文档。

固件与旧 C# 实施不在本轮范围。未验证的硬件/性能假设先补证据，不按猜测修改。

## 执行队列

| 项目 | 状态 | 提交 / 验收 |
| --- | --- | --- |
| 二进制回归测试 | 完成 | 418c06b，10 focused tests |
| CI 质量门禁 | 完成 | 0b665f9，4 workflow contracts |
| 连接查询与失败资源所有权 | 完成 | 19 项回归通过；保留失败 cleanup handle |
| Tauri 迟到 open / close 重试 | 完成 | 28 项回归通过；清理失败明确诊断 |
| 协议帧长度与模拟真实性 | 完成 | 55 focused tests；总长约束、CRC哨兵、128KiB往返 |
| 指定端口原子重连 | 完成 | 32 focused tests；close/open/init单事务；全类型检查通过 |
| bank 分块规划 | 完成 | 61 focused tests；按窗口剩余量分块、RAM绝对地址bank |
| 取消生命周期 | 完成 | 31 focused tests；取消/超时保留所有权到worker与cleanup结束 |
| 设备级操作独占与工具/断连集成 | 完成 | 53 focused tests；identity、完整事务、排队断连检查 |
| 设置 runtime schema | 完成 | 119 focused tests；原子校验、version1、保留合法旧值 |
| RTC 输入契约 | 完成 | 174 focused tests；非法输入零I/O，合法输入快照 |
| RTC 失败恢复 | 完成 | 197 focused tests；独立cleanup、Halt控制恢复、完整类型检查通过 |
| RTC 实际写后验证 | 完成 | 239 RTC tests；实际目标比较、单调容差、进位/坏BCD/恢复 |
| LK 局部构建状态与阶段模型 | 完成 | 19 focused tests；并发日志隔离、8MiB golden ROM、typed阶段 |
| 结构化失败传播 | 完成 | 177 related tests；原message/data/cause、ACK/取消分类、Vue诊断identity |
| 适配器共享读取规则 | 完成 | 95 related tests（新26）；公共读取循环/既有retry、供电/延迟/bank/progress transcript |
| UI 编排迁移 | 完成 | 106 related tests（新41）；11入口prepare/reset、admission与结果/cleanup/disposal guards |
| 超时契约与操作预算 | 完成 | 190 related tests（新31）；默认off/旧v1兼容，真实worker/reset等待，idle/total契约 |
| Native 会话锁与有界取消 | 完成 | 14 Rust tests、cargo check --locked、5 CI contracts；独立worker/真实close |
| AST 依赖门禁 | 完成 | 40 focused tests；AST/Vue/resolution/type边/runtime循环；真实图无违规 |
| CFI 几何边界证据与修复 | 完成 | 128 related tests；GL-T/AL032D/CoreCFI转录fixture，完整regions/128-byte特殊编码 |
| LK 容量边界证据与修复 | 完成 | 60 related tests；slot0/shared/import/reservations/fullspan/list容量，8MiB golden不变 |
| 异构sector区域与baseAddress | 完成 | 179 related tests；physical交集、容量尾部、两adapter partial首sector真实重试 |
| 性能证据与图像按需加载 | 完成 | 51 related tests（新6）；无背景不import，PNG/golden不变；bundle测量见performance-evidence.md |
| 架构文档与历史finding状态 | 排队 | 汇总最后代码与测量，保留未测量/硬件限制 |

集成验证（上述进行中三项收尾）：59 文件 862 项测试全部通过，完整 ESLint、vue-tsc、check:deps、production build 通过。构建保留既有 Jimp/Ionic chunk、Jimp eval 和 gbats fs externalization 提示；性能任务仍待证据评估。

最新集成（RTC 写后验证与 native 会话隔离提交后）：60 文件 905 项 Vitest 全通过，14 Rust tests、cargo check --locked、完整 lint/type/deps 与 production build 通过。RTC 提交 6433a48，native 提交 73aadf4。结构化失败传播曾受 subagent 额度错误中断，未留下生产代码改动，已继续同任务；AST 门禁由新 agent 实施。

阶段集成（适配器/UI 编排合并中）：完整 lint/type 通过，72 文件 1133 项中 1132 通过；AST 内真实 ESLint fixture 在重型检查并发时运行 26 秒，触发其 20 秒限制。该次不能记为全量通过；最终门禁应避免并发重型检查，并再次验证。原生 14 项测试再次通过。
