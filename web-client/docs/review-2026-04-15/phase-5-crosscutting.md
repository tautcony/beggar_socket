# Phase 5 审查报告: 交叉审查

> 日期: 2026-04-15
> 发现: P0(0) / P1(2) / P2(1) / INFO(1)

## 跨模块系统性问题

### [P1] 错误分类链全程依赖字符串匹配

- **涉及文件**:
  - `protocol/beggar_socket/packet-read.ts` `getFailureReason()` — 字符串匹配 "timeout", "expected size"
  - `features/burner/application/domain/error-mapping.ts` `inferErrorCode()` — 字符串匹配 "timeout", "selection", "not connected"
  - `services/device-connection-manager.ts` `summarizeCause()` — 字符串提取
- **触发条件**: 任何底层错误消息格式变更（Tauri plugin 升级、浏览器更新、i18n 变更）
- **影响**: 错误分类依赖从传输层 → 协议层 → 应用层的字符串传递链。任何一层修改消息文本，上层的分类逻辑就会失效。Tauri 迁移增加了一个新的错误源（tauri-plugin-serialplugin），其错误消息格式的稳定性不能保证
- **修复方向**: 定义统一的错误类型层次：
  ```
  TransportError (code: 'TIMEOUT' | 'CLOSED' | 'IO_ERROR')
  └── ProtocolError (code: 'PACKET_TIMEOUT' | 'LENGTH_MISMATCH' | 'TRANSPORT_FAILURE')
      └── BurnerDomainError (code: 'timeout' | 'not_connected' | ...)
  ```
  每层捕获下层错误时通过 `instanceof` 或 `error.code` 判断，不依赖 `.message` 内容

### [P1] close/disconnect 异常处理不一致

- **涉及文件**:
  - `TauriDeviceGateway.disconnect()` — 不捕获 close 异常，状态清理可能被跳过
  - `WebDeviceGateway.disconnect()` — 同样，close 异常冒泡
  - `DeviceConnectionManager.disconnectDevice()` — 调用 `connectionUseCase.disconnect()`，失败时抛出
  - `DeviceConnect.vue` `disconnect()` — 捕获并显示错误
- **触发条件**: 端口已被外部关闭（USB 拔除）、传输异常后端口状态异常
- **影响**: disconnect 时 transport.close() 可能抛异常，导致后续 `device.port = null` 等清理步骤被跳过。设备状态卡在"已连接"，用户无法重新连接
- **修复方向**: disconnect 中的 close 操作必须用 try-catch 包裹，确保状态清理始终执行

### [P2] Tauri/Web 平台行为差异未充分文档化

- **涉及文件**: `platform/serial/types.ts`, `platform/serial/factory.ts`
- **影响**: Transport 接口中 `flushInput?` 和 `close?` 是可选的，但 TauriSerialTransport 和 WebSerialTransport 的行为差异较大：
  - Web: close 需要 cancel reader → await pump → close port（复杂）
  - Tauri: close 只需 close serialPort（简单但无重入保护）
  - Web: flushInput 只清空内存 buffer
  - Tauri: flushInput 调用 `clearBuffer(ClearBuffer.Input)`（真正清理硬件缓冲区）
  
  上层代码不知道这些差异，可能假设 flushInput 在两个平台效果相同
- **修复方向**: 至少在接口文档中说明 flushInput 的语义差异

### [INFO] 上次审查 P0 修复情况评估

对比上次审查的 18 个 P0：

| 上次 P0 | 状态 | 说明 |
|---------|------|------|
| WebSerialTransport 并发读取竞态 | **部分修复** | pump 模式重构改善了读取竞态，但 send 中 writer 管理仍有问题 |
| ConnectionTransport 并发读取数据丢失 | **已修复** | pump buffer 模式替代了直接 reader 竞争 |
| WebSerialTransport 流错误后无法恢复 | **已修复** | `resetPumpState()` + error recovery 已实现 |
| 协议层并发竞态 | **未修复** | `sendAndReceive` 已实现但未被协议层调用 |
| Promise.race() 竞态导致悬挂操作 | **未确认** | 需检查 burner-session.ts |
| AbortController 覆盖导致状态泄漏 | **未确认** | 需检查 burner-session.ts |
| GBA 全片擦除无超时保护 | **未确认** | 需完整审查 gba-adapter.ts |
| MBC5 全片擦除无超时保护 | **未确认** | 需完整审查 mbc5-adapter.ts |
| DeviceConnectionManager 不安全类型断言 | **仍存在** | `ctx as DeviceHandle` 仍在使用 |
| SerialService openPort 资源泄漏 | **部分修复** | 添加了 transport close，但缺少 port close |
| BurnerSession 生命周期管理 | **未在本次变更范围** | — |
| rom-assembly-store setTimeout 泄漏 | **未在本次变更范围** | — |
| useToast 永久 event listener | **未在本次变更范围** | — |
| advanced-settings 原子性写入失败 | **未在本次变更范围** | — |
| debug-settings setInterval 竞态 | **未在本次变更范围** | — |
| SystemNoticeModal v-html XSS | **未在本次变更范围** | — |
| SystemNoticeHistoryModal v-html XSS | **未在本次变更范围** | — |
| CartBurner.vue 绕过 TypeScript 类型安全 | **未确认** | 需检查最新 CartBurner.vue |

## 差异化反证审查

- **所有分发入口 / 命令入口 / 协议入口是否都有默认分支**: protocol.ts 的命令函数通过类型系统约束（GBACommand/GBCCommand enum），无需 switch default。但 error-mapping 的 codeMap 覆盖了所有 lifecycleStage 值 ✅
- **所有异步链路是否都检查失败、取消、超时**: send 有超时 ✅，read 有超时 ✅，connect 无超时 ❌（P1-03 已报告），disconnect 无异常保护 ❌（P1-02 已报告）
- **所有状态写入链路是否存在半完成状态**: connectWithSelectedPort 的 disconnect→connect 序列已标记（Phase 3 P2-01）
- **所有高杠杆工具函数是否检查过编码、时间、摘要碰撞**: fromLittleEndian 32 位限制已标记（Phase 2 P2-02），port-filter 字符串匹配已标记（Phase 4 P2-03）

## 漏检复盘

- 已复查但未发现新问题的模式:
  - 内容渲染点（本次变更文件无 v-html）
  - Tauri IPC 参数校验（Tauri v2 的 capability 系统已处理权限边界）
  - 定时器泄漏（ProgressDisplayModal 的 timer 有 cleanup ✅）
