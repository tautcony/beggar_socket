# Phase 0 审查报告：基线准备

> 审查时间：2026-03-16
> 审查根目录：web-client/
> 技术栈：Vue 3 + TypeScript + Vite + Pinia + Electron + WebSerial

---

## 项目概况

ChisFlash Burner Web Client 是一个多平台 GBA/GBC 卡带烧录工具的 Web 前端，支持 WebSerial API (Chrome/Edge) 和 Electron 桌面打包。

## 分层架构

```
Presentation         → src/views, src/components, src/composables
Application          → src/features/burner/application, src/features/burner/adapters
Infrastructure       → src/platform/serial, src/protocol/beggar_socket, src/services
Runtime              → electron/
Utilities            → src/utils, src/types
State                → src/stores, src/settings
```

## 技术栈特征 → 专项检查重点

| 特征 | 额外关注 |
|------|---------|
| Vue 3 Composition API | 响应式丢失、composable 副作用泄漏、v-html XSS (C9) |
| Electron | CSP、contextIsolation、IPC 输入验证 (C10) |
| WebSerial / 硬件协议 | 字节序、帧格式、锁生命周期、超时恢复 (C1, C3) |
| TypeScript strict | any 滥用、不安全类型断言 (C8) |
| 异步密集 | Promise 竞态、未捕获 rejection、资源泄漏 (C7, C11) |

## 已有质量门禁

- ESLint import/no-restricted-paths 防违规依赖
- `npm run check:deps` 架构约束脚本
- Vitest 单测覆盖协议/解析器/进度/CRC 等模块
- `vue-tsc --noEmit` 类型检查

## 已知差距（文档记录）

- `CartBurner.vue` 较大，UI 与流程编排尚未完全解耦
- `services` 中仍承载部分编排/基础设施职责，属于过渡态

## 历史审查记录

无历史审查报告（首次审查）。

## 审查计划

| Phase | 模块 | 重点类别 | 文件模式 |
|-------|------|---------|---------|
| 1 | 平台传输层 (platform/serial) | C1, C2, C4, C5 | `src/platform/serial/**/*.ts` |
| 2 | 协议层 (protocol/beggar_socket) | C3, C2, C7 | `src/protocol/beggar_socket/**/*.ts` |
| 3 | 应用/功能层 (features/burner) | C5, C2, C7, C8 | `src/features/burner/**/*.ts` |
| 4 | 服务层 (services) | C2, C4, C5, C10 | `src/services/**/*.ts` |
| 5 | 工具层 (utils) | C3, C6, C8, C10 | `src/utils/**/*.ts` |
| 6 | 状态与组合层 (stores/composables) | C9, C5, C7, C11 | `src/stores/*.ts`, `src/composables/**/*.ts` |
| 7 | 视图与组件层 (views/components) | C9, C10, C11, C6 | `src/views/*.vue`, `src/components/**/*.vue` |
| 8 | Electron 运行时层 | C10, C4, C2 | `electron/**/*.js` |
| 9 | 交叉审查 | 全类别 | 基于 Phase 1-8 综合分析 |
