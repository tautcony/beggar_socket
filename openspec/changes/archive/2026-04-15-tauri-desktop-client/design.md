## Context

ChisFlash Burner web 客户端当前使用 Electron 作为桌面端打包方案，通过 Node.js 的 `serialport` 模块实现串口通信。项目已实现良好的 Gateway/Transport 抽象层（`DeviceGateway` + `Transport` 接口），将平台差异隔离在 `src/platform/serial/` 目录下。Electron 相关代码集中在 `electron/` 目录（main.js, preload.js, ipc-handlers.js）和 `src/platform/serial/electron/` 目录。现需迁移至 Tauri v2 以获得更小的打包体积、更低内存占用和更好的跨平台一致性。

## Goals / Non-Goals

**Goals:**
- 用 Tauri v2 完全替换 Electron 作为桌面端运行时
- 使用 `tauri-plugin-serialplugin` (v2.22+) 提供原生串口通信能力
- 保持现有 Gateway/Transport 抽象不被破坏，仅替换实现层
- 支持 Windows、macOS、Linux 三平台打包
- 保持 Web 模式（纯浏览器 + WebSerial）继续可用，不受影响

**Non-Goals:**
- 不支持移动端（iOS/Android）
- 不对现有协议层（`src/protocol/`）做任何修改
- 不改变应用的 UI/UX 设计或业务逻辑
- 不实现自动更新机制（后续独立变更处理）
- 不迁移现有 Electron 的 CI/CD pipeline（属于独立运维变更）

## Decisions

### D1: 使用 tauri-plugin-serialplugin 而非自定义 Rust 串口命令

**选择**: 使用社区维护的 `tauri-plugin-serialplugin` (v2.22+)

**备选方案**:
- (A) 自定义 Tauri commands 直接调用 `serialport` crate — 需编写大量 Rust 胶水代码，维护成本高
- (B) 使用 WebSerial API（Tauri WebView 不一定支持）— 不可靠，Linux 的 WebKitGTK 不支持 WebSerial

**理由**: `tauri-plugin-serialplugin` 提供完整的 TypeScript API（`available_ports`、`open`、`close`、`writeBinary`、`readBinary`、`writeDataTerminalReady`、`writeRequestToSend` 等），与现有 `DeviceGateway` 接口所需的操作完全对应。它基于 Rust `serialport` crate，性能可靠，且有活跃维护（2026 年 3 月仍在更新）。

### D2: Gateway 工厂三分支策略：Tauri → Web

**选择**: Gateway 工厂检测顺序为 `isTauri()` → fallback `WebDeviceGateway`

**备选方案**:
- (A) 保留 Electron 分支做三路选择 — 增加维护负担，Electron 已被完全替换
- (B) 统一所有平台为一个 gateway — 不同平台 API 差异太大

**理由**: Tauri 环境下 `window.__TAURI_INTERNALS__` 存在可作为检测标志。Web 环境为默认 fallback。移除 Electron 分支简化代码。

### D3: TauriDeviceGateway 使用 tauri-plugin-serialplugin-api 的 SerialPort 类

**选择**: `TauriDeviceGateway` 内部通过 `tauri-plugin-serialplugin-api` 的 `SerialPort` 类进行串口操作

**实现映射**:
| DeviceGateway 方法 | tauri-plugin-serialplugin-api 映射 |
|---|---|
| `list(filter?)` | `SerialPort.available_ports()` → 转换 PortInfo 格式 → 应用 filter |
| `select(filter?)` | 前端 UI 选择 + `available_ports()` |
| `connect(selection)` | `new SerialPort({path, baudRate: 9600, ...})` → `port.open()` → `port.startListening()` |
| `init(device)` | `port.writeDataTerminalReady(false)` + `port.writeRequestToSend(false)` → 10ms delay → set true → 200ms delay |
| `disconnect(device)` | `port.cancelListen()` → `port.close()` |

**Transport 映射**:
| Transport 方法 | tauri-plugin-serialplugin-api 映射 |
|---|---|
| `send(payload)` | `port.writeBinary(payload)` |
| `read(length)` | `port.listen(callback, false)` 收集数据到 buffer，按 length 返回 |
| `setSignals(signals)` | `port.writeDataTerminalReady(dtr)` + `port.writeRequestToSend(rts)` |
| `close()` | `port.cancelListen()` → `port.close()` |

### D4: TauriSerialTransport 数据接收架构

**选择**: 使用 `listen(callback, false)` 的事件驱动模式 + 内部 buffer 累积

**理由**: `tauri-plugin-serialplugin` 不支持同步 `read(exactLength)` 模式。需通过 `startListening()` + `listen()` 注册回调，数据到达时累积到内部 `Uint8Array` buffer 中。`Transport.read(length)` 方法从 buffer 消费指定字节数，若不足则等待后续数据到达（带超时）。此模式与现有 `ConnectionTransport`（Electron）的 overflow buffer 机制一致。

### D5: Tauri 后端项目结构

**选择**: 在 `web-client/src-tauri/` 下创建标准 Tauri v2 Rust 项目

**目录结构**:
```
web-client/src-tauri/
├── Cargo.toml              # Rust 依赖（tauri, tauri-plugin-serialplugin）
├── tauri.conf.json          # Tauri 配置（窗口、安全、打包）
├── capabilities/
│   └── default.json         # 权限配置（serialplugin permissions）
├── src/
│   └── lib.rs               # Tauri 入口，注册 serialplugin
├── icons/                   # 应用图标
└── build.rs                 # Tauri 构建脚本
```

**理由**: 遵循 Tauri v2 标准项目约定，有利于社区支持和文档参照。

### D6: DeviceHandle.platform 类型变更

**选择**: `'web' | 'electron'` → `'web' | 'tauri'`

**理由**: 这是一个 **BREAKING** 变更，但 `platform` 字段仅在内部使用（compat.ts、测试 mock），无外部 API 暴露。需同步更新所有引用点。

### D7: 平台检测函数

**选择**: 新增 `isTauri()` 函数，通过检测 `window.__TAURI_INTERNALS__` 判断 Tauri 环境

```typescript
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
```

**理由**: 这是 Tauri v2 官方推荐的运行时检测方式，所有 Tauri 应用注入此全局对象。

## Risks / Trade-offs

**[R1: tauri-plugin-serialplugin 的 read 模式差异]** → 现有 Transport 的 `read(length)` 期望精确读取 N 字节。serialplugin 使用 event-driven listen 模式。需实现中间 buffer 层（类似现有 ConnectionTransport 的 overflow buffer），通过 Promise + timeout 等待足够数据到达。

**[R2: Rust 工具链构建环境要求]** → 开发者和 CI 环境需安装 Rust 工具链（rustup + cargo）。Electron 仅需 Node.js。缓解：在 README 中明确前置环境要求。

**[R3: Linux WebView 差异]** → Tauri v2 在 Linux 使用 WebKitGTK，渲染行为可能与 Windows/macOS 的 WebView2/WKWebView 略有差异。缓解：CI 中增加 Linux 构建验证。

**[R4: 串口权限]** → macOS 需要在 `Info.plist` 中声明串口访问权限。Tauri 通过 `tauri.conf.json` 的 `bundle.macOS.entitlements` 配置。需确保与现有 Electron entitlements 等效。

**[R5: Breaking change 对下游的影响]** → `DeviceHandle.platform` 类型变更会导致任何硬编码 `'electron'` 的代码编译失败。影响范围可控（仅 compat.ts 和测试文件），但需完整搜索并更新。
