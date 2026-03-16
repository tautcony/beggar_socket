# 代码审查汇总报告

> 审查完成时间：2026-03-16
> 审查根目录：web-client/
> 覆盖 Phase：0–9（共 10 个）
> 审查文件总数：约 120 个

---

## 统计

| 严重度 | 数量 |
|--------|------|
| 🔴 P0  | 18   |
| 🟡 P1  | 44   |
| 🟢 P2  | 27   |
| ℹ️ INFO | 13   |
| **合计** | **102** |

---

## 各 Phase 汇总

| Phase | 模块 | 文件数 | P0 | P1 | P2 | INFO | 报告 |
|-------|------|--------|----|----|----|----|------|
| 0 | 基线准备 | - | - | - | - | - | [phase-0](./phase-0-baseline.md) |
| 1 | 平台传输层 | 7 | 3 | 3 | 4 | 3 | [phase-1](./phase-1-platform-serial.md) |
| 2 | 协议层 | 8 | 1 | 7 | 3 | 2 | [phase-2](./phase-2-protocol.md) |
| 3 | 应用/功能层 | 15 | 2 | 6 | 4 | 3 | [phase-3](./phase-3-application.md) |
| 4 | 服务层 | 21 | 4 | 10 | 3 | 2 | [phase-4](./phase-4-services.md) |
| 5 | 工具层 | 22 | 0 | 3 | 6 | 2 | [phase-5](./phase-5-utils.md) |
| 6 | 状态与组合层 | 9 | 5 | 7 | 2 | 0 | [phase-6](./phase-6-state-composables.md) |
| 7 | 视图与组件层 | 30+ | 3 | 8 | 5 | 3 | [phase-7](./phase-7-views-components.md) |
| 8 | Electron 运行时 | 5 | 0 | 3 | 4 | 0 | [phase-8](./phase-8-electron.md) |
| 9 | 交叉审查 | - | - | - | - | - | [phase-9](./phase-9-crosscutting.md) |

---

## 高优先级问题（P0）

| 来源 | 问题描述 | 文件 | 类别 |
|------|---------|------|------|
| Phase 1 | 并发读取竞态导致数据损坏 | `platform/serial/transports.ts` | C1 |
| Phase 1 | ConnectionTransport 并发读取数据丢失 | `platform/serial/transports.ts` | C1 |
| Phase 1 | WebSerialTransport 流错误后无法恢复 | `platform/serial/transports.ts` | C2 |
| Phase 2 | 协议层并发竞态 — 命令响应错位 | `protocol/beggar_socket/protocol-adapter.ts` | C3/C7 |
| Phase 3 | Promise.race() 竞态导致悬挂操作 | `features/burner/application/burner-session.ts` | C7 |
| Phase 3 | AbortController 覆盖导致状态泄漏 | `features/burner/application/burner-session.ts` | C5 |
| Phase 4 | GBA 全片擦除无超时保护（while true） | `services/gba-adapter.ts` | C2 |
| Phase 4 | MBC5 全片擦除无超时保护（while true） | `services/mbc5-adapter.ts` | C2 |
| Phase 4 | DeviceConnectionManager 不安全类型断言 | `services/device-connection-manager.ts` | C8 |
| Phase 4 | SerialService openPort 资源泄漏 | `services/serial-service.ts` | C1 |
| Phase 6 | BurnerSession 生命周期管理 — 内存泄漏 | `composables/cartburner/useCartBurnerSessionState.ts` | C11 |
| Phase 6 | rom-assembly-store setTimeout 泄漏 | `stores/rom-assembly-store.ts` | C11 |
| Phase 6 | useToast 永久 event listener | `composables/useToast.ts` | C11 |
| Phase 6 | advanced-settings 原子性写入失败 | `settings/advanced-settings.ts` | C5 |
| Phase 6 | debug-settings setInterval 竞态 | `settings/debug-settings.ts` | C11 |
| Phase 7 | SystemNoticeModal v-html XSS 风险 | `components/modal/SystemNoticeModal.vue` | C10 |
| Phase 7 | SystemNoticeHistoryModal v-html XSS 风险 | `components/modal/SystemNoticeHistoryModal.vue` | C10 |
| Phase 7 | CartBurner.vue 绕过 TypeScript 类型安全 | `components/CartBurner.vue` | C8 |

---

## 分组修复建议

> 分组原则：同组内的问题强烈建议在同一次 commit 中修复，以避免半修复状态。

### Group A — 并发安全（最高优先级）
**优先级**：P0 × 4
**涉及文件**：`transports.ts`, `protocol-adapter.ts`, `connection-use-case.ts`

| 优先级 | 问题 |
|--------|------|
| P0 | WebSerialTransport 并发读取竞态 |
| P0 | ConnectionTransport 并发读取数据丢失 |
| P0 | 协议层命令响应错位 |
| P1 | ConnectionUseCase disconnect 竞态 |

### Group B — 超时与恢复（高优先级）
**优先级**：P0 × 3 + P1 × 4
**涉及文件**：`transports.ts`, `protocol.ts`, `gba-adapter.ts`, `mbc5-adapter.ts`, `burner-session.ts`

| 优先级 | 问题 |
|--------|------|
| P0 | WebSerialTransport 流错误后无法恢复 |
| P0 | GBA 全片擦除无超时保护 |
| P0 | MBC5 全片擦除无超时保护 |
| P0 | BurnerSession runWithTimeout 悬挂操作 |
| P1 | 扇区擦除轮询超时后协议状态未定义 |
| P1 | GBC 全片擦除 2 分钟 busy-wait |
| P1 | finally 块中 write 操作无超时保护 |

### Group C — 资源泄漏（高优先级）
**优先级**：P0 × 5 + P1 × 3
**涉及文件**：`web/device-gateway.ts`, `electron/device-gateway.ts`, `serial-service.ts`, 多个 composable/store

| 优先级 | 问题 |
|--------|------|
| P0 | SerialService openPort 资源泄漏 |
| P0 | BurnerSession 生命周期管理 |
| P0 | rom-assembly-store setTimeout 泄漏 |
| P0 | useToast 永久 event listener |
| P0 | debug-settings setInterval 竞态 |
| P1 | ElectronDeviceGateway 连接泄漏 |
| P1 | WebDeviceGateway 端口打开失败泄漏 |
| P1 | URL.createObjectURL 泄漏 |

### Group D — 安全防护（中优先级）
**优先级**：P0 × 2 + P1 × 4
**涉及文件**：`SystemNoticeModal.vue`, `SystemNoticeHistoryModal.vue`, `sentry-loader.ts`, `main.js`, `preload.js`

| 优先级 | 问题 |
|--------|------|
| P0 | SystemNoticeModal v-html XSS 风险 |
| P0 | SystemNoticeHistoryModal v-html XSS 风险 |
| P1 | Sentry sendDefaultPii: true |
| P1 | CSP 'unsafe-inline' |
| P1 | Buffer 全局暴露 |
| P1 | 开发模式 webSecurity 禁用 |

### Group E — 类型安全与错误处理（中优先级）
**优先级**：P0 × 2 + P1 × 6

| 优先级 | 问题 |
|--------|------|
| P0 | AbortController 覆盖导致状态泄漏 |
| P0 | advanced-settings 原子性写入失败 |
| P1 | 不安全的 as DeviceHandle 断言 |
| P1 | 错误代码推断依赖字符串匹配 |
| P1 | AbortSignal 参数设计不一致 |
| P1 | rom_program 未验证 data.length vs bufferSize |
| P1 | Payload 构建器无容量上限 |
| P1 | 地址范围验证缺失 |

---

## 跨模块系统性问题

### 1. 并发安全缺失（全栈）
全通信链路从传输层到应用层缺乏系统化的互斥/锁机制。Phase 1、2、3、4 均有发现。

### 2. 超时后状态不可恢复
超时/错误后无法将系统恢复到已知良好状态。用户遇到错误后只能重新连接或重启。

### 3. 内存与资源泄漏
connect() 操作、composable 生命周期、定时器/监听器缺少统一的生命周期管理。

### 4. 错误处理不一致
从 `.catch(() => {})` 静默忽略到字符串匹配推断错误类型，缺乏统一的错误分类体系。

### 5. 安全防护分层不完整
v-html XSS、Sentry PII、CSP 配置、Buffer 暴露等安全问题散布在不同层。

---

## 未发现问题的模块

- **i18n 国际化**：整体覆盖良好
- **TypeScript strict 配置**：tsconfig 严格模式配置正确
- **ESLint 依赖约束**：import/no-restricted-paths 规则有效
- **路由配置**：vue-router 配置正常
- **Vite 构建配置**：构建配置合理
