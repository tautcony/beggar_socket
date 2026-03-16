# Phase 9 审查报告：交叉审查

> 审查时间：2026-03-16
> 基于：Phase 1-8 综合分析
> 发现系统性问题：5 个

---

## 跨模块系统性问题

### 🔴 系统性问题 1：并发安全缺失 — 全栈无互斥机制

**涉及 Phase**：1（传输层）、2（协议层）、3（应用层）、4（服务层）

**现象**：
- Phase 1: WebSerialTransport/ConnectionTransport 的 `read()` 无互斥 → 并发读取数据损坏
- Phase 2: ProtocolAdapter 的 `sendPackage()` + `getResult()` 无原子性 → 命令响应错位
- Phase 3: ConnectionUseCase 的 `prepareConnection()` 和 `disconnect()` 竞争状态
- Phase 4: DeviceConnectionManager 的 `isConnecting` 标志不完整

**根因**：整个通信链路从传输层到应用层都缺乏系统化的并发控制机制。

**修复优先级**：🔴 最高 — 这是导致间歇性数据损坏和通信故障的根本原因。

**建议**：
1. 在 Transport 层实现读取互斥（Promise chain 串行化）
2. 在 ProtocolAdapter 层实现命令级锁（确保 send→receive 原子性）
3. 在 ConnectionUseCase 层统一状态修改互斥

---

### 🔴 系统性问题 2：超时后状态不可恢复 — 无恢复/重置机制

**涉及 Phase**：1（传输层）、2（协议层）、3（应用层）、4（服务层）

**现象**：
- Phase 1: WebSerialTransport 流错误后 `streamError` 永久设置，无法恢复
- Phase 2: 扇区擦除轮询超时后 MCU 状态未定义，协议层无重置能力
- Phase 3: BurnerSession `runWithTimeout()` 超时后操作继续后台执行
- Phase 4: GBA/MBC5 全片擦除 `while(true)` 无超时上限

**根因**：缺乏统一的"异常恢复"策略 — 超时/错误后如何将系统恢复到已知良好状态。

**修复优先级**：🔴 高 — 用户遇到错误后只能重新连接/重启。

**建议**：
1. 定义"连接重置"协议：Transport 清理 → 控制线复位 → pump 重启
2. 所有轮询操作添加绝对超时
3. 超时异常时自动执行连接恢复序列
4. BurnerSession 使用 AbortController 实现真正的操作取消

---

### 🟡 系统性问题 3：内存与资源泄漏 — 生命周期管理不一致

**涉及 Phase**：1（传输层）、3（应用层）、6（状态层）、7（视图层）

**现象**：
- Phase 1: WebDeviceGateway/ElectronDeviceGateway 连接失败后端口泄漏
- Phase 3: BurnerSession completeOperation() 不清理 logs/progress
- Phase 6: rom-assembly-store setTimeout 泄漏、useToast 全局 listener 未移除、debug-settings setInterval 竞态
- Phase 7: ProgressDisplayModal setInterval 管理混乱

**根因**：
1. `connect()` 操作缺乏 "成功后才注册、失败时清理" 的原子性模式
2. composable/store 生命周期与 Vue 组件生命周期不完全对齐
3. 定时器和监听器缺少统一的生命周期管理工具

**修复优先级**：🟡 高 — 长期运行会导致内存增长和不可预测行为。

**建议**：
1. 所有 `connect()` 方法使用 try/catch 确保失败时清理资源
2. 创建 `useCleanup()` composable 统一管理 timer/listener 清理
3. Store 中的定时器使用 $dispose hook 清理

---

### 🟡 系统性问题 4：错误处理不一致 — 静默失败 vs 传播 vs 字符串匹配

**涉及 Phase**：2（协议层）、3（应用层）、4（服务层）、5（工具层）、6（状态层）

**现象**：
- Phase 2: `.catch(() => {})` 静默忽略清理操作失败
- Phase 3: `inferErrorCode()` 依赖脆弱的字符串匹配推断错误类型
- Phase 4: `console.error` + 重新 throw 双重处理
- Phase 5: translation.ts fetch 无超时处理
- Phase 6: localStorage 写入静默失败

**根因**：
1. 缺乏统一的错误分类体系（自定义错误类层次结构）
2. 没有"可恢复 vs 不可恢复"错误的区分策略
3. 清理操作（finally 块）的错误处理无统一规范

**修复优先级**：🟡 中 — 影响调试效率和错误恢复能力。

**建议**：
1. 定义自定义错误类层次：`ChisFlashError` → `TimeoutError`, `ConnectionError`, `ProtocolError`, `SelectionRequiredError` 等
2. 统一 finally 块规范：清理操作使用 try/catch，至少 console.warn
3. 替代字符串匹配：使用 `instanceof` 检查

---

### 🟡 系统性问题 5：安全防护分层不完整

**涉及 Phase**：5（工具层）、7（视图层）、8（Electron 层）

**现象**：
- Phase 5: Sentry `sendDefaultPii: true` 泄露用户信息
- Phase 7: SystemNoticeModal/SystemNoticeHistoryModal `v-html` XSS 风险
- Phase 8: CSP `'unsafe-inline'`、Buffer 全局暴露、开发模式 webSecurity 禁用

**根因**：安全措施在各层独立实现，缺乏统一的安全审计清单。

**修复优先级**：🟡 中 — 当前攻击面有限（桌面应用），但应遵循纵深防御原则。

**建议**：
1. `v-html` 内容在渲染前统一经过 DOMPurify
2. Sentry 设置 `sendDefaultPii: false`
3. CSP 移除 `'unsafe-inline'`
4. 移除 Buffer 全局暴露
5. 创建安全检查脚本作为 CI 门禁

---

## 总结矩阵

| 系统性问题 | 严重度 | 涉及层数 | 修复复杂度 |
|-----------|--------|---------|-----------|
| 并发安全缺失 | 🔴 P0 | 4 层 | 高 |
| 超时后不可恢复 | 🔴 P0 | 4 层 | 中 |
| 内存与资源泄漏 | 🟡 P1 | 4 层 | 中 |
| 错误处理不一致 | 🟡 P1 | 5 层 | 中 |
| 安全防护分层不完整 | 🟡 P1 | 3 层 | 低 |

## 未发现问题的审查维度

- **i18n 完整性**：整体良好，仅少量硬编码文本
- **TypeScript strict 模式**：tsconfig 已启用所有 strict 选项
- **ESLint 依赖约束**：已有 import/no-restricted-paths 规则
- **测试覆盖**：已有基本的协议/解析器/进度测试
