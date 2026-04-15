## Why

Electron 打包体积大（~150MB+）、内存占用高，且需要捆绑完整的 Chromium 和 Node.js 运行时。Tauri v2 使用系统原生 WebView + Rust 后端，打包体积可降至 ~10MB 级别，内存占用显著降低，同时 Rust 原生串口通信可带来更低延迟和更高可靠性。当前项目已具备良好的 Gateway/Transport 抽象层，迁移的核心工作集中在 IPC/命令层替换，业务逻辑影响面可控。

## What Changes

- **新增 Tauri v2 后端**：在 `web-client/src-tauri/` 下创建 Rust 项目，包含 Tauri 配置、串口命令、窗口管理、菜单等
- **新增 Tauri 串口通信层**：集成 `tauri-plugin-serialplugin`，实现端口枚举、打开/关闭、读写、信号控制等 Tauri commands
- **新增 TauriDeviceGateway**：在 `src/platform/serial/tauri/` 下实现 `DeviceGateway` 接口的 Tauri 适配，通过 `@tauri-apps/api` 的 `invoke()` 调用 Rust 后端
- **新增 Tauri 平台检测**：在 `src/utils/` 中添加 `isTauri()` 检测函数，更新 Gateway 工厂以支持 Tauri 运行时
- **更新构建系统**：新增 `tauri:dev` 和 `tauri:build` 脚本，配置三平台（Windows/macOS/Linux）打包
- **BREAKING** **移除 Electron 相关代码**：删除 `electron/` 目录、移除 `electron`/`electron-builder`/`serialport` 依赖、清理 `window.electronAPI` 类型定义和 `ElectronDeviceGateway` 实现
- **更新平台抽象层**：Gateway 工厂从 Web/Electron 二选一改为 Web/Tauri 二选一；更新 `DeviceHandle.platform` 类型（`'electron'` → `'tauri'`）
- **更新 UI 组件**：`AboutModal.vue` 和 `DeviceConnect.vue` 中的 Electron 引用替换为 Tauri 信息展示
- **更新 macOS 签名/权限**：从 Electron entitlements 迁移到 Tauri 的 `info.plist` 配置（串口访问权限等）

## Capabilities

### New Capabilities
- `tauri-runtime-integration`: Tauri v2 应用壳层集成，包括 Rust 后端初始化、窗口管理、应用菜单、CSP 安全策略、开发/生产环境路由
- `tauri-serial-gateway`: 基于 tauri-plugin-serialplugin 的串口通信网关，实现 DeviceGateway + Transport 接口的 Tauri 适配层

### Modified Capabilities
- `device-transport-gateway`: 平台枚举从 `'web' | 'electron'` 变更为 `'web' | 'tauri'`；Gateway 工厂新增 Tauri 分支；移除 Electron gateway 实现

## Impact

- **代码删除**：`electron/` 目录（main.js, preload.js, ipc-handlers.js, security-utils.js, package.json）、`src/platform/serial/electron/`、`src/types/electron.d.ts`、`src/utils/electron.ts`
- **代码修改**：`src/platform/serial/factory.ts`、`src/platform/serial/types.ts`、`src/platform/serial/compat.ts`、`src/services/device-connection-manager.ts`、`src/composables/useEnvironment.ts`、`src/components/modal/AboutModal.vue`、`src/components/DeviceConnect.vue`
- **依赖变更**：移除 `electron`、`electron-builder`、`serialport`、`concurrently`、`wait-on`；新增 `@tauri-apps/api`、`@tauri-apps/cli`、`tauri-plugin-serialplugin`
- **构建工具链**：需安装 Rust 工具链（rustc, cargo）；Tauri CLI 替代 electron-builder
- **CI/CD**：构建矩阵需更新为 Tauri 打包流程（各平台需安装 Rust + 系统依赖）
- **测试**：现有 `architecture-serial-boundary.test.ts`、`burner-port-contract.test.ts` 等需更新平台检测 mock
