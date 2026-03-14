# 模块：Services / Adapters

## 目录

### 核心适配器
- `src/services/cartridge-adapter.ts`: 适配器抽象基类（日志/进度/状态）
- `src/services/gba-adapter.ts`: GBA 卡带适配器
- `src/services/mbc5-adapter.ts`: MBC5（GBC）卡带适配器
- `src/services/mock-adapter.ts`: 模拟适配器（用于测试/调试）

### 连接管理
- `src/services/device-connection-manager.ts`: 统一连接管理（调用 `platform/serial` 网关）
- `src/services/serial-service.ts`（legacy facade）: 旧接口兼容层

### 辅助服务
- `src/services/flash-chip.ts`: Flash 芯片辅助（`shouldUseLargeRomPage` 等）
- `src/services/system-notice-service.ts`: 系统通知（从 public 获取 JSON 配置、localStorage 已读状态管理）
- `src/services/tool-functions.ts`: 工具操作（`setRTC`、RTC 数据处理等）
- `src/services/debug-protocol-service.ts`: 调试命令服务（`executeDebugCommand`、`getAvailableDebugCommands`）

### RTC 子模块（`src/services/rtc/`）
- `base-rtc.ts`: RTC 基类
- `gba-rtc.ts`: GBA RTC 实现
- `mbc3-rtc.ts`: MBC3 RTC 实现
- `index.ts`: 统一导出（`RTCManager`）

### LK 多卡菜单子模块（`src/services/lk/`）
- `romBuilder.ts`: GBA 多菜单 ROM 构建主逻辑
- `imageUtils.ts`: 背景图像处理
- `types.ts`: `BuildInput`、`BuildResult`、`GameConfig` 等类型
- `utils.ts`: 工具函数（SHA1、Sector Map 等）
- `cli.ts`: 命令行入口（供 Node 环境调用）
- `index.ts`: 统一导出

### 入口
- `src/services/index.ts`: 统一导出

## 模块设计
- `cartridge-adapter.ts`: 适配器抽象基类（日志/进度/状态）
- `gba-adapter.ts`、`mbc5-adapter.ts`、`mock-adapter.ts`：
  - 实现硬件操作细节
  - 调用 `protocol/*` 完成实际命令收发
- `device-connection-manager.ts`：
  - 调用 `platform/serial` 网关处理连接、初始化、断开
- `serial-service.ts`：
  - 旧接口 facade，内部转接 `platform/serial`（兼容存量）
- `system-notice-service.ts`：
  - 从 `public/system-notifications.json` 读取通知元数据
  - 通过 localStorage 管理已读状态
- `debug-protocol-service.ts`：
  - 暴露原始协议调试能力，供 `DebugToolModal` 使用

## 职责
- 将业务操作映射为协议命令调用。
- 处理速度/进度/日志等运行时细节。
- 连接管理统一走 `device-connection-manager`。
- RTC 读写、多卡菜单 ROM 构建、系统通知等辅助能力。

## 说明
- 该层当前是"过渡层"：同时承载适配与基础设施逻辑。
- `lk/` 与 `rtc/` 为独立子域，未来可进一步下沉或独立拆分。
