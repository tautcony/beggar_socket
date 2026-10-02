# 当前 finding 状态（2026-10-03）

原始 phase 报告保留同步基线 `756179a` 的观察。本表记录后续 Web Client 修复；“代码完成”表示有实现及回归测试，实体设备、浏览器与性能验收单独列出。提交为本地提交，未推送或部署。

测试路径相对 web-client；workflow 路径相对仓库根。最终集成结果见[实施记录](implementation.md)，构建测量见[性能证据](performance-evidence.md)。

| 原 finding | 当前代码状态 / 提交 | 回归证据 | 保留验收或范围 |
| --- | --- | --- | --- |
| LC-01 取消/旧 finally | 完成：06e0270、785e991 | `tests/features/burner/application.test.ts`、`tests/features/burner/device-operation-owner.test.ts`、`tests/composables/cartburner/session-state.test.ts` | 实际驱动不可立即取消，仍 drain worker/cleanup |
| LC-02 查询丢句柄 | 完成：367d34e | `tests/features/burner/connection-usecase-orchestration.test.ts` | 真实枚举失败/驱动回收待验收 |
| LC-03 指定端口重连 | 完成：2e97a35 | `tests/services/device-connection-manager.test.ts`、连接 use case 单测 | close 失败不继续 open，真串口切换待验收 |
| LC-04 迟到 open | 完成：6eb586f | `tests/platform/serial/device-gateway.test.ts`、`tests/platform/serial/tauri-transport.test.ts` | 原生慢打开/失败驱动待验收 |
| LC-05 读超时语义 | 代码完成：235d155；显式 Web idle / Tauri total deadline，保留默认兼容 | `tests/platform/serial/timeout-contracts.test.ts` | 不将慢分片统一为较短总 deadline |
| LC-06 native 全局锁 | 完成：73aadf4 | `src-tauri/src/native_platform_tests.rs`（14 tests）、cargo check/test --locked | 独立 session worker；OS flush 无可移植强制中断 |
| LC-07 操作预算 | 代码完成：235d155；默认关闭、显式启用的协作预算 | `tests/features/burner/operation-budget.test.ts`、`tests/settings/operation-budget.test.ts` | timeout 请求停止，持 owner 到真实 I/O/cleanup 结束 |
| AD-01 bank 边界 | 完成：456c06d | `tests/services/adapters/bank-window-transfers.test.ts` | 实际大容量/非对齐卡带读写待验收 |
| AD-02 协议大包 | 完成：0dd7a17 | `tests/platform/serial/simulated-frame-boundaries.test.ts`、`tests/services/adapters/cartridge-chunk-size.test.ts` | host 约束不替代固件接收安全 |
| AD-03 RTC 恢复 | 完成：f2ba229 | `tests/services/rtc/rtc-failure-recovery.test.ts` | MBC3 实卡继续计时和随后存档访问待验收 |
| AD-04 RTC 真验证 | 完成：6433a48 | `tests/services/rtc/rtc-written-verification.test.ts` | GBA/MBC3 实卡写后读回待验收 |
| AD-05 RTC 输入 | 完成：e5c8e96 | `tests/services/rtc/rtc-input-contract.test.ts` | 非法输入零 I/O；真实设备另验 |
| AD-06 LK 日志隔离 | 完成：98f89e2 | `tests/lk-build-context.test.ts` | 无共享 logger，真菜单启动待验收 |
| AD-D01 重复模板 | 本批收敛：e5ec9a6 | `tests/services/adapters/rom-read-rule-transcript.test.ts` | 真实 ROM read/retry 共享；verify/write/erase/RAM 硬件流程仍独立，不以行数作为兼容验收 |
| AD-D02 错误丢失 | 完成：333f83d | `tests/services/adapters/structured-failures.test.ts`、`tests/features/burner/structured-failures.test.ts` | legacy 非结构化异常不凭空创造 cause |
| AD-D03 LK 阶段模型 | 完成：98f89e2 | `tests/lk-build-context.test.ts`、`tests/lk-rom-builder.test.ts` | 保留既有公开 phase helper 兼容 |
| AD 待验证 CFI 几何 | 补证据并修复：f6f5714、3d065b2 | `tests/utils/sector/range-planning.test.ts`、`tests/services/adapters/sector-range-transcript.test.ts` | 芯片手册转录 fixture 非物理捕获；非标准 CFI 仍需证据 |
| AD 待验证 LK 容量 | 补证据并修复：2e2a0c1 | `tests/lk-capacity-layout.test.ts` | full span/slot/item-list 校验；真菜单存档兼容待验收 |
| AR-01 CI 门禁 | 仓库工作流完成：0b665f9、73aadf4 | `tests/architecture/quality-workflow.test.ts`、`.github/workflows/check-webclient.yml` | required branch protection 管理设置未验证 |
| AR-02 操作所有权/UI | 本批完成：785e991、72dee6c | owner、`tests/features/burner/command-orchestration.test.ts`、会话 composable 单测 | 11 入口 prepare/runCommand/reset；真实浏览器工具/取消/导出 smoke 待补 |
| AR-03 多层错误包装 | 信息保留完成：333f83d | structured failures 跨 protocol/service/port/facade/UI 回归 | 保留有职责的 facade/port，没有声称删除所有转发层 |
| AR-04 设置 schema | 完成：0d63cce | `tests/settings/advanced-settings.test.ts` | 合法旧值迁移与损坏存储保留 |
| AR-05 文档/依赖漂移 | AST 完成：b1f69d4；本文档任务更新模块与清单 | `tests/architecture-deps.test.cjs`、`tests/documentation-contracts.test.ts` | 计算 import 不在静态覆盖；文案语义须 review |
| AR-06 性能缺口 | 057b78f：build snapshot + 无背景安全按需 import | `tests/lk-image-loading.test.ts`、`tests/lk-background-build.test.ts` | 未测首屏交互、浏览器图像耗时/峰值内存、模拟器 ROM/音频/控制；不宣称首屏加速 |
| AR-07 MCU 构建参数 | 未实施，本轮范围外 | 原始 phase-4 记录 Windows `$BuildType` 问题 | MCU Debug/Release、Linux/Windows 验收待独立任务 |
| AR-08 LK 测试超时 | 完成：418c06b | `tests/lk-rom-builder.test.ts`、`tests/helpers/binary-assertion.ts` | 精确线性比对保留首差异定位，不全局放宽超时 |

## 未完成的验收与排除范围

实体卡带仍需覆盖 bank 边界、异构物理 sector、部分首 sector 重试、RTC 失败后恢复/继续计时、LK 菜单启动与存档兼容。模拟测试和芯片手册转录不足以取代这些检查。

浏览器和 Tauri 窗口仍需重复点击/取消/断连、资源快速替换、导出对话框、模拟器 ROM 启动/音频/控制 smoke。性能证据仅包含 build 产物及指定构建场景；没有浏览器首屏、峰值内存或 native 二进制 IPC 测量。

固件 FW-01 至 FW-05、旧 C# FW-06/FW-07 和 AR-07 未修改；P0 接收安全问题仍待处理。host 包长/CFI 检查不能证明固件安全。用户 stash 保留未恢复；本轮不包含 push、部署、OpenSpec 归档或 GitHub 管理设置变更。
