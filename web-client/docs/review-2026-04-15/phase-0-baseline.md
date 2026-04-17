# Phase 0 审查基线

> 日期: 2026-04-15
> 审查范围: web-client/
> 主要变更: Electron → Tauri 迁移 (4 commits since 2026-03-16)

## 变更概述

自上次审查 (2026-03-16) 以来，主要变更为从 Electron 迁移至 Tauri v2：

- **删除**: `electron/` 目录（main.js, preload.js, ipc-handlers.js, security-utils.js）
- **删除**: `src/platform/serial/electron/device-gateway.ts`, `src/types/electron.d.ts`, `src/utils/electron.ts`
- **新增**: `src-tauri/`（tauri.conf.json, capabilities/default.json）
- **新增**: `src/platform/serial/tauri/device-gateway.ts`, `src/platform/serial/tauri/tauri-serial-transport.ts`
- **新增**: `src/utils/tauri.ts`, `src/types/tauri.d.ts`
- **重构**: `transports.ts`（207 行变更）, `device-connection-manager.ts`（93 行新增）, `mbc5-adapter.ts`（142 行新增）
- **变更**: 31 个文件, +999 / -558 行

## 技术栈

- Vue 3 + TypeScript + Vite + Pinia
- Tauri v2 (替代 Electron)
- WebSerial API (浏览器模式)
- tauri-plugin-serialplugin-api (Tauri 模式)

## 模块边界

| 层 | 目录 | 职责 |
|---|---|---|
| 接入/边界 | `views/`, `components/` | 用户交互入口 |
| 应用编排 | `features/burner/`, `composables/cartburner/` | 烧录会话编排 |
| 领域与状态 | `stores/`, `settings/` | 状态管理 |
| 协议 | `protocol/beggar_socket/` | 硬件通信协议 |
| 基础设施 | `services/`, `platform/serial/` | 设备连接、串口传输 |
| 平台与运行时 | `src-tauri/`, `utils/tauri.ts` | Tauri 配置与检测 |
| 横切 | `utils/`, `types/`, `i18n/` | 工具、类型、国际化 |

## 历史审查参考

上次审查发现 102 个问题（P0: 18, P1: 44, P2: 27, INFO: 13）。主要系统性问题：
1. 并发安全缺失
2. 超时后状态不可恢复
3. 内存与资源泄漏
4. 错误处理不一致
5. 安全防护不完整

本次审查重点关注 Tauri 迁移引入的新问题，以及上次 P0 问题是否已修复。

## 本次高风险区域

1. **新 Tauri 传输层** — 全新代码，需完整审查
2. **WebSerialTransport 重构** — 大量改动，可能引入新竞态
3. **MBC5 适配器扩展** — 142 行新增，验证/擦除逻辑
4. **设备连接管理器** — 显著扩展，新增 Tauri 分支逻辑
5. **Tauri 安全配置** — CSP、权限模型需审查

## 容易漏检的风险类型

- ☑ 默认分支 / 未知输入 / 非法状态
- ☑ 异步失败路径 / rejection / 协议未闭合
- ☑ 持久化、缓存、索引、派生状态之间的"半完成状态"窗口
- ☑ 内容渲染、富文本、导出链路
- ☑ 隐式协议：字段约定、键格式、时间、编码、摘要、命名和兼容性前提
