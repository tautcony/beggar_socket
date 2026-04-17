# Phase 0 基线准备

> 日期: 2026-04-17
> 审查范围: web-client/src/ 全目录
> 审查重点: 代码风格、重复代码、重复逻辑抽取、可维护性

## 技术栈

- Vue 3 + Composition API (`<script setup lang="ts">`)
- TypeScript (严格模式)
- Vite + Vitest
- Pinia (状态管理)
- vue-i18n (国际化)
- Tauri + Web Serial (双平台串口)

## 模块边界与职责映射

| 职责层 | 目录 | 文件数 |
|--------|------|--------|
| 接入/边界层 | `views/`, `components/`, `router/` | ~47 |
| 应用编排层 | `features/burner/application/`, `composables/cartburner/` | ~12 |
| 领域与状态层 | `features/burner/application/domain/`, `stores/`, `types/` | ~15 |
| 基础设施与集成层 | `services/`, `protocol/`, `platform/serial/` | ~30 |
| 平台与运行时层 | `platform/serial/web/`, `platform/serial/tauri/`, `main.ts` | ~8 |
| 横切保障层 | `utils/`, `settings/`, `i18n/`, `utils/monitoring/` | ~20 |
| 测试与验证层 | `tests/` | ~40 |

## 历史审查记录

- `docs/review-2026-03-16/`: 首次全面审查
- `docs/review-2026-04-15/`: 聚焦 Electron→Tauri 迁移（27 findings: 3 P0, 12 P1, 8 P2, 4 INFO）

上次审查主要关注功能缺陷和可靠性风险。本次审查聚焦**代码风格、重复代码、重复逻辑抽取**等可维护性层面，与上次审查互补。

## 本次审查 Phase 划分

由于审查重点是风格/重复/可维护性，按重复模式的集中程度划分 phase：

| Phase | 主题 | 涉及目录 |
|-------|------|---------|
| 1 | 适配器层重复代码 | `services/{gba,mbc5}-adapter.ts`, `services/tool-functions.ts`, `services/rtc/` |
| 2 | 协议与传输层重复 | `protocol/beggar_socket/`, `platform/serial/` |
| 3 | 组件与视图层重复 | `components/operaiton/`, `components/emulator/`, `views/` |
| 4 | 编排/状态/配置层重复 | `features/burner/application/`, `composables/`, `settings/`, `stores/` |
| 5 | 工具与类型层 | `utils/`, `types/` |
| 6 | 交叉审查 | 跨模块系统性问题 |

## 已识别的高风险重复模式

1. **GBA/MBC5 适配器镜像** — 两个 1600+ 行的适配器文件，核心操作逻辑 85-95% 相同
2. **PPB Unlock GBA/MBC5** — 两个 ~200 行函数，87% 结构相同
3. **协议层 GBA/GBC 函数对** — 多组函数仅在地址和数据编码上有差异
4. **传输层跨平台重复** — Web/Tauri 传输实现中的错误构造、初始化序列重复
5. **AdvancedSettings getter/setter** — 16 个属性 × 8 行的完全相同模板
6. **操作面板组件** — ROM/RAM/Chip 操作面板样式和逻辑重复
7. **模拟器组件** — GBA/GBC/GB 三个组件模板、样式、生命周期几乎相同
8. **DEFAULT_PROGRESS** — 同一常量在 2+ 处重复定义
