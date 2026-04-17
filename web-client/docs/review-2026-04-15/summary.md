# 代码审查汇总

> 日期: 2026-04-15
> 范围: web-client/ (聚焦 Electron→Tauri 迁移后的变更，4 commits, 31 files, +999/-558 行)
> Phase 数: 5 (Phase 0 基线 + Phase 1-4 审查 + Phase 5 交叉)

## 统计

| 严重度 | 数量 |
|--------|------|
| P0 | 3 |
| P1 | 12 |
| P2 | 8 |
| INFO | 4 |
| **合计** | **27** |

## 高优先级问题

| # | 严重度 | Phase | 问题描述 | 文件 |
|---|--------|-------|---------|------|
| 1 | P0 | 1 | WebSerialTransport.send() 写锁未释放 — 超时恢复路径 writer abort 与重建竞态 | `platform/serial/transports.ts` |
| 2 | P0 | 1 | Mutex 双重释放导致队列错乱 — 跳过等待者或死锁 | `platform/serial/mutex.ts` |
| 3 | P0 | 3 | MBC5 verifyROM 中 switchROMBank 缺少 mbcType 参数 — MBC3 卡带验证误判 | `services/mbc5-adapter.ts` L1085 |

## 各 Phase 摘要

| Phase | 模块 | 文件数 | P0 | P1 | P2 | INFO |
|-------|------|--------|----|----|----|----|
| 0 | 基线准备 | - | - | - | - | - |
| 1 | 平台传输层 | 9 | 2 | 4 | 3 | 1 |
| 2 | 协议层 | 7 | 0 | 2 | 2 | 1 |
| 3 | 服务与应用编排层 | 7 | 1 | 3 | 2 | 1 |
| 4 | 状态/视图/组件/配置 | 9 | 0 | 3 | 3 | 2 |
| 5 | 交叉审查 | - | 0 | 2 | 1 | 1 |

## 跨模块问题

### 1. 错误分类链全程依赖字符串匹配
从 `packet-read.ts` → `error-mapping.ts` → `device-connection-manager.ts`，三层错误分类均依赖 `message.includes()` 字符串匹配。Tauri 迁移引入新的错误消息源 (tauri-plugin-serialplugin)，增加了匹配失效风险。

### 2. close/disconnect 异常处理不一致
`TauriDeviceGateway.disconnect()` 和 `WebDeviceGateway.disconnect()` 均不捕获 transport.close() 异常，导致设备状态清理可能被跳过。

### 3. 协议层未使用原子 sendAndReceive
虽然 Transport 接口已实现 mutex-guarded `sendAndReceive`，但 `protocol.ts` 仍使用分开的 `sendPackage()` + `readProtocolPayload()`。当前由上层串行循环保护，但架构脆弱。

## 差异化反证复盘

已横向复查的模式:
- **默认分支 / 交互协议闭合**: 命令枚举类型安全 ✅，error-mapping codeMap 完整 ✅
- **异步失败 / 超时 / 取消 / 幂等**: connect 缺超时（Phase 1 P1-01），disconnect 缺异常保护（Phase 5 P1-02），send/read 有超时 ✅
- **状态写入顺序 / 半提交 / 重建窗口**: connectWithSelectedPort 的 disconnect→connect 窗口（Phase 3 P2-01），init 信号半完成（Phase 1 P1-02）
- **渲染 / 导出 / 编码 / 时间 / 摘要**: 本次变更文件无 v-html，无新 XSS 点 ✅。fromLittleEndian 32位限制（Phase 2 P2-02）

这一轮复盘未新增发现。

## 上次审查 P0 修复情况

- ✅ 已修复 (2/18): 并发读取数据丢失、流错误后无法恢复
- 🔶 部分修复 (2/18): 并发读取竞态（pump 改善但 writer 仍有问题）、openPort 泄漏（transport 关了但 port 没关）
- ❌ 未修复或未确认 (8/18): 协议层竞态、类型断言、多个 composable 泄漏
- ⬜ 不在本次变更范围 (6/18): BurnerSession、rom-assembly-store、useToast、settings、v-html XSS

## 未覆盖区域

- `features/burner/application/burner-session.ts` — 上次多个 P0 未在本次变更范围，未重新审查
- `stores/`, `settings/` — 未变更，维持上次审查结论
- `services/lk/`, `services/rtc/` — 未变更
- `components/modal/SystemNoticeModal.vue` — v-html XSS 仍在上次报告中，未修复确认
- `services/gba-adapter.ts` 全片擦除超时 — 需更深入审查确认是否修复
