# Phase 9 审查报告：cross-cutting — 交叉审查

> 审查时间：2026-03-16  
> 审查文件数：0（基于 Phase 1–8 发现的综合分析）  
> 发现问题数：P0(0) / P1(3) / P2(2) / INFO(2)

## 问题清单

### 🟡 P1 — [C4] WebSerial 与 Electron 串口路径的错误处理不对等

**跨模块分析**：

对比 Phase 1（WebSerial transport）与 Phase 8（Electron IPC handlers）的发现，两条串口路径存在系统性的错误传播差异：

| 场景 | WebSerial 路径 | Electron 路径 |
|------|---------------|--------------|
| 写入错误 | `WritableStream` 通过 Promise rejection 传播 | `serial-write` 在 flush 后 resolve，写入回调错误被吞（Phase 8 P1） |
| 关闭错误 | `port.close()` 返回 Promise，reject 可捕获 | `serial-close` 回调忽略 error 参数（Phase 8 P2） |
| 数据监听泄漏 | WebSerial `ReadableStream` 自动管理生命周期 | Preload `onData` 可累积重复监听器（Phase 8 P2 + Phase 1 P2 ElectronDeviceGateway singleton） |
| 超时后残留 | `withTimeout` 超时后 writer lock 泄漏（Phase 1 P1） | 无对等的超时机制（Electron 侧依赖 Node SerialPort 自身处理） |

**影响**：同一上层操作（如 ROM 写入）在 WebSerial 和 Electron 下的失败行为不一致。WebSerial 路径更可能正确传播错误，而 Electron 路径存在静默失败风险。烧录时 Electron 用户可能得到成功提示但实际写入失败。

**修复建议**：
1. 统一 Electron `serial-write` 的 resolve 时机（只在回调确认后 resolve）
2. 在 `ElectronDeviceGateway` 层面添加与 WebSerial 对等的超时保护
3. 建立跨平台集成测试，验证两条路径在相同异常场景下返回一致的错误

---

### 🟡 P1 — [C5] 连接/断开生命周期中的跨模块状态同步风险

**跨模块分析**：

设备连接/断开涉及多个层级，各层的状态管理存在缝隙：

```
DeviceConnect.vue (Phase 7) → deviceInfo 非响应式 (P2)
  ↓
DeviceConnectionManager (Phase 4) → 无并发保护 (P1)
  ↓
ConnectionOrchestrationUseCase (Phase 3) → 无并发保护 (P1)
  ↓
BurnerSession (Phase 6) → composable 无 onScopeDispose (P1)
  ↓
CartBurner.vue (Phase 7) → 无 onUnmounted 清理 (P2)
```

**具体风险场景**：
1. 用户快速点击连接/断开：`DeviceConnectionManager` 和 `ConnectionOrchestrationUseCase` 均无并发保护，可能产生双重连接或状态不一致
2. 操作中导航离开：`useCartBurnerSessionState` 无 cleanup → `BurnerSession` 的 `AbortController` 不触发 → 操作静默继续 → 可能在无 UI 反馈的情况下完成或失败
3. macOS 关闭/重开窗口（Electron）：Phase 8 P0 stale mainWindow → 重连后 IPC handlers 引用旧窗口 → 数据传递中断

**影响**：设备状态在 feature 层与 UI 层之间可能不同步，导致显示"已连接"但实际无法通信，或操作已取消但后台仍在写入。

**修复建议**：
1. 在 `DeviceConnectionManager` 和 `ConnectionOrchestrationUseCase` 添加重入锁
2. `useCartBurnerSessionState` 添加 `onScopeDispose` 清理
3. 考虑引入全局 connection state machine（如 `disconnected → connecting → connected → operating → disconnecting`），各层订阅统一状态

---

### 🟡 P1 — [C7] 主链路（连接 → 读 ID → 擦除 → 编程 → 校验）缺乏系统性回滚

**跨模块分析**：

主操作链路的每个步骤存在以下失败后果：

| 步骤 | 失败后的残留状态 | 来源 |
|------|-----------------|------|
| 连接 | 端口可能已打开，但上层状态未更新 | Phase 3 P1 |
| 读 ID | Flash 芯片停留在 Autoselect 模式，后续读写返回错误数据 | Phase 2 P1 |
| 擦除 | **不可逆**——扇区已擦除，原数据丢失 | 设计层面 |
| 编程 | 部分写入完成，ROM 内容不完整 | Phase 8 P1（Electron 写入错误丢失）|
| 校验 | 校验失败后无自动重试或回滚 | Phase 3 P2（progress 未 reset）|

最关键的场景：**擦除成功 + 编程中断**。此时卡带处于部分写入状态，用户看到错误后可能不知道需要重新完整写入。

**影响**：无法保证操作的原子性。中断（串口断开、超时、用户取消）后，卡带可能处于不可用状态且 UI 不明确提示。

**修复建议**：
1. 禁止在擦除+编程的关键路径上单独取消——只允许整体取消，取消后明确提示"卡带可能需要重新写入"
2. 编程完成后自动执行校验（当前已实现），校验失败时提供明确的"重写"按钮
3. `rom_get_id` 失败后发送 Flash reset 命令恢复读取模式

---

### 🟢 P2 — [C2] "静默失败孤岛"汇总

**跨模块分析**：

以下模块形成了错误在内部被消化、上层完全不知情的"静默失败孤岛"：

| 孤岛 | 表现 | 来源 |
|------|------|------|
| `readProtocolPayload` | catch 后重新抛出丢失原始错误信息 | Phase 2 P2 |
| Electron `serial-write` | 数据 flush 后 resolve，写入回调错误吞掉 | Phase 8 P1 |
| Electron `serial-close` | 关闭回调 error 被忽略 | Phase 8 P2 |
| `withTimeout` 超时后 | 超时的操作继续执行但结果被丢弃 | Phase 1 P1 |
| adapter erase failure | 进度条不更新，用户可能不知道擦除失败 | Phase 4 P1 |
| GBC `rom_erase_sector` | 无超时保护，擦除卡住时无上报 | Phase 2 P2 |

**影响**：系统级别的错误传播链不完整。在运气不好的情况下，多个静默失败可能叠加——如 Electron 写入错误被吞 + 校验阶段也失败但 progress 未 reset → 用户看到的 UI 状态完全不反映实际情况。

**修复建议**：
1. 建立错误传播契约：每个层级要么处理错误并更新状态，要么原样传播
2. 最低限度在 catch 块中保留 `cause` 信息（`throw new Error('...', { cause: originalError })`）
3. 关键操作（擦除、编程）添加操作审计日志

---

### 🟢 P2 — [C10] 外部输入信任边界不清晰

**跨模块分析**：

整理外部输入在系统中的验证层级：

| 输入来源 | 验证层 | 现状 | 风险 |
|----------|--------|------|------|
| **ROM 文件内容** | utils/parsers | ❌ `cfi-parser` 无边界检查（Phase 5 P1），`rom-parser` 无最小长度检查（Phase 5 P1） | 畸形文件导致 NaN/undefined 传播 |
| **设备返回数据** | protocol 层 | ⚠️ CRC 未校验（Phase 2 P0），`readProtocolPayload` 丢失错误（Phase 2 P2） | 损坏数据被当作有效处理 |
| **系统通知（远程 JSON+Markdown）** | services | ⚠️ Markdown 在 view 层经 DOMPurify 消毒（Phase 7 INFO），但 service 层返回原始内容（Phase 4 P1） | 如果绕过 view 层消费，存在 XSS 风险 |
| **用户文本输入** | views | ✅ v-html 全部经 DOMPurify 处理（Phase 7 INFO） | 安全 |
| **Electron IPC 参数** | electron | ❌ portPath、data buffer、signals 均未验证（Phase 8 P1） | 被入侵的渲染进程可访问任意设备 |
| **Google Translate API 响应** | utils | ❌ 响应结构未校验（Phase 5 P2） | API 格式变更导致崩溃 |
| **Sentry 数据** | utils | ⚠️ `sendDefaultPii: true` 无过滤（Phase 5 P1） | 隐私泄漏（输出方向） |

**影响**：信任边界不统一。ROM 文件是最高风险输入（用户可能打开任何文件），但 parser 层缺乏系统性的长度/格式校验。设备返回数据的 CRC 被忽略，意味着串口通信错误不会被检测到。

**修复建议**：
1. 在 parser 层入口统一添加最小长度和格式魔数校验
2. 在 protocol 层至少记录 CRC 不匹配的 warning（即使不阻断操作）
3. 在 IPC 层添加输入校验（白名单端口路径模式、data 类型检查）
4. `system-notice-service` 在返回前就执行 sanitize，而非依赖消费方

---

### ℹ️ INFO — [C4] Electron 与 Web 配置差异总结

| 配置项 | Web (WebSerial) | Electron |
|--------|----------------|----------|
| CSP | 取决于部署服务器 | ❌ 未设置（Phase 8 P0） |
| 串口权限 | 浏览器原生权限提示 | 直接授予 `granted: true`（Phase 8 INFO） |
| 安全策略 | 浏览器沙箱保护 | `webSecurity` 开发时禁用（Phase 8 P1） |
| DevTools | 浏览器自带，无法禁用 | 生产构建可访问（Phase 8 P1） |
| 串口数据传递 | ReadableStream 管道 | IPC + 事件（stale window 风险，Phase 8 P0） |

---

### ℹ️ INFO — [C6] 超时与重试配置全局统计

| 位置 | 默认值 | 可配置性 |
|------|--------|----------|
| `AdvancedSettings._operationTimeout` | 100000（初始）/ 30000（reset 后）— 不一致 | ✅ 用户可调 |
| `withTimeout()` in transports | 由调用方传入 | ✅ |
| `gbc_rom_erase_sector` | ⚠️ 无超时 | ❌ |
| `gbc_rom_erase_chip` | ⚠️ 无超时 | ❌ |
| `BurnerSession.runWithTimeout` | 由 `AdvancedSettings.operationTimeout` | ✅ |
| Electron SerialPort | Node SerialPort 默认 | ❌ |

建议统一超时策略，确保所有可能阻塞的操作都有上限。

## 未覆盖区域

无
