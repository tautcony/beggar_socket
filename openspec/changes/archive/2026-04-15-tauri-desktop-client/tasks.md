## 1. Tauri 项目初始化

- [x] 1.1 在 `web-client/src-tauri/` 下初始化 Tauri v2 Rust 项目，包含 `Cargo.toml`、`tauri.conf.json`、`src/lib.rs`、`build.rs`
- [x] 1.2 在 `Cargo.toml` 中添加 `tauri` 和 `tauri-plugin-serialplugin` 依赖
- [x] 1.3 在 `src/lib.rs` 中注册 `tauri_plugin_serialplugin::init()` 插件
- [x] 1.4 配置 `tauri.conf.json`：窗口标题 "ChisFlash Burner"、默认尺寸、CSP 安全策略、前端 dev/build URL
- [x] 1.5 创建 `capabilities/default.json`，授予 serialplugin 所需权限（available-ports、open、close、read、write、write-binary、read-binary、write-dtr、write-rts、start-listening、stop-listening、cancel-read）
- [x] 1.6 配置 macOS entitlements（串口访问权限）和平台特定打包选项

## 2. 前端依赖与构建脚本

- [x] 2.1 安装前端依赖：`@tauri-apps/cli`（devDependency）、`@tauri-apps/api`、`tauri-plugin-serialplugin-api`
- [x] 2.2 在 `package.json` 中添加 `tauri:dev` 和 `tauri:build` 脚本
- [x] 2.3 移除 Electron 相关依赖：`electron`、`electron-builder`、`serialport`、`concurrently`、`wait-on`、`web-serial-polyfill`
- [x] 2.4 移除 Electron 相关 npm scripts：`electron:dev`、`electron:build`、`electron:build:mac`、`electron:build:mac:universal`
- [x] 2.5 移除 `package.json` 中的 `build`（electron-builder）配置段

## 3. 平台检测层替换

- [x] 3.1 创建 `src/utils/tauri.ts`，实现 `isTauri()` 函数（检测 `window.__TAURI_INTERNALS__`）及平台信息获取函数（`getPlatform()`、`getAppVersion()`）
- [x] 3.2 删除 `src/utils/electron.ts`
- [x] 3.3 更新 `src/composables/useEnvironment.ts`：将 `isElectron` 替换为 `isTauri`，更新 `description` 返回 "Tauri" 或 "Web"

## 4. Tauri Gateway 与 Transport 实现

- [x] 4.1 创建 `src/platform/serial/tauri/device-gateway.ts`，实现 `TauriDeviceGateway` 类（`list`、`select`、`connect`、`init`、`disconnect` 方法）
- [x] 4.2 创建 `src/platform/serial/tauri/tauri-serial-transport.ts`，实现 `TauriSerialTransport` 类（`send`、`read`、`sendAndReceive`、`setSignals`、`close` + 内部 buffer 累积 + mutex）
- [x] 4.3 实现 serialplugin `PortInfo` → 应用 `SerialPortInfo` 的转换函数（VID/PID 数值映射）

## 5. Gateway 工厂与类型更新

- [x] 5.1 更新 `src/platform/serial/factory.ts`：导入 `isTauri` 替换 `isElectron`，`TauriDeviceGateway` 替换 `ElectronDeviceGateway`
- [x] 5.2 更新 `src/platform/serial/types.ts`：`DeviceHandle.platform` 类型从 `'web' | 'electron'` 改为 `'web' | 'tauri'`
- [x] 5.3 更新 `src/platform/serial/compat.ts`：`isElectron()` 引用替换为 `isTauri()`，platform 值改为 `'tauri'`

## 6. Electron 代码清理

- [x] 6.1 删除 `electron/` 目录（main.js、preload.js、ipc-handlers.js、security-utils.js、package.json）
- [x] 6.2 删除 `src/platform/serial/electron/` 目录（device-gateway.ts 及其导出）
- [x] 6.3 删除 `src/types/electron.d.ts`
- [x] 6.4 删除 `build/entitlements.mac.plist`（被 Tauri 的 entitlements 配置替代）

## 7. UI 组件更新

- [x] 7.1 更新 `src/components/modal/AboutModal.vue`：将 Electron 版本信息替换为 Tauri 运行时信息展示
- [x] 7.2 更新 `src/components/DeviceConnect.vue`：将 Electron 引用替换为 Tauri 平台信息

## 8. 服务层适配

- [x] 8.1 更新 `src/services/device-connection-manager.ts`：将 `isElectron()` 引用替换为 `isTauri()`，确保 Tauri 下的端口过滤和自动选择逻辑正确
- [x] 8.2 更新 `src/platform/serial/transports.ts`：移除 `ConnectionTransport` 类（Electron 专用），保留 `WebSerialTransport`

## 9. 类型声明更新

- [x] 9.1 创建 `src/types/tauri.d.ts`，声明 `window.__TAURI_INTERNALS__` 全局类型
- [x] 9.2 检查并更新 `src/types/serial.ts` 中 `SerialConnection` 的引用（若仅被 Electron gateway 使用则清理）

## 10. 测试更新

- [x] 10.1 更新 `tests/architecture-serial-boundary.test.ts`：将 Electron 相关测试用例替换为 Tauri 场景
- [x] 10.2 更新 `tests/burner-port-contract.test.ts`：mock 中的 platform 值从 `'electron'` 改为 `'tauri'`
- [x] 10.3 添加 `TauriDeviceGateway` 单元测试：验证 list/select/connect/init/disconnect 的契约行为
- [x] 10.4 添加 `TauriSerialTransport` 单元测试：验证 send/read/timeout/buffer/mutex 语义
- [x] 10.5 运行全量测试套件确认无回归

## 11. 文档与配置收尾

- [x] 11.1 更新 `web-client/README.md`：Tauri 开发环境要求（Rust 工具链）、新的 dev/build 命令
- [x] 11.2 更新 `.github/copilot-instructions.md`：将 Electron 相关说明替换为 Tauri
- [x] 11.3 验证 `scripts/check-architecture-deps.cjs` 的依赖规则是否需要适配 Tauri 导入路径
