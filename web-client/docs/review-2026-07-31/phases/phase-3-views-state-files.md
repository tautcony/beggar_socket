# Phase 3 审查报告: Views, Async State and Files

> 日期: 2026-07-31  
> 文件数: 12  
> 发现: P0(0) / P1(1) / P2(2) / INFO(0)  
> 导航: [返回 review index](../index.md) | [查看修复 checklist](../fix-checklist.md)

## 已审查文件

- `src/composables/useMultiMenuState.ts`
- `src/utils/file-io.ts`
- `src/components/common/FileDropZone.vue`
- `src/composables/cartburner/useCartBurnerFileState.ts`
- `src/views/RomAssemblyView.vue`
- `src/views/gba-multi-menu/*.vue`
- 相关 `file-io`、容器状态和视图测试

## Findings

### P1-P3-1: [P1] 默认资源加载没有 latest-wins 保护，会覆盖用户刚选的文件并在卸载后产生副作用

- 位置: `src/composables/useMultiMenuState.ts:89-103, 106-160, 419-431`
- 触发条件: 页面 setup 启动的 `loadDefaultBackground()`/`loadDefaultMenuRom()` 尚未完成时，用户选择自定义背景或菜单 ROM；或者 fetch 已完成但 Jimp 动态导入仍 pending 时卸载页面。
- 影响: 默认资源完成后无 generation/disposed 检查，可能覆盖用户选择、把构建输入恢复成默认文件，并在组件已卸载后更新 refs 或显示 toast。当前 `disposed`/AbortController 只保护用户文件读取和 fetch 本身，不能取消后续 `blob.arrayBuffer()`、动态 import/Jimp 链路。
- 证据: 静态路径；历史审查只覆盖了用户文件读取的卸载保护，现有测试没有默认资源与用户选择的交错场景。
- 置信度: 高。
- 修复方向: 为每类资源维护 generation/token；用户选择时使默认任务失效，所有 await 后检查 token/disposed；卸载时统一取消并禁止 toast/ref 写入。

### P2-P3-2: [P2] 文件读取失败在 FileDropZone 中被吞掉，用户无法知道选择为何没有生效

- 位置: `src/components/common/FileDropZone.vue:143-167`
- 触发条件: FileReader 触发 error/abort，或输入文件无法读取。
- 影响: 单文件路径只 `console.warn`，多文件路径静默丢弃 rejected 项且只在开发控制台记录；组件不 emit 错误、不显示 toast，用户看到的仍是旧文件/空状态，无法判断是否需要重试。
- 证据: 静态路径；`file-io.test.ts` 只验证 helper reject，没有组件行为测试。
- 置信度: 高。
- 修复方向: 增加 `file-error` 事件或注入 toast，定义多文件“部分成功”反馈；回归测试 error/abort 的 UI 状态和事件。

### P2-P3-3: [P2] 图像/菜单文件多次快速选择时旧任务也可回写，产生混合状态

- 位置: `src/composables/useMultiMenuState.ts:163-242`
- 触发条件: 用户连续选择两个背景图，或连续选择菜单 ROM；两个任务共享同一个 AbortController，但新选择不会取消旧任务，也没有 request id 检查。
- 影响: 旧文件的读取/Jimp 处理可能最后完成，覆盖新文件的 dimensions/processed preview 或 menu data，显示文件名与实际构建输入不一致。
- 证据: 静态路径；同一问题可由异步完成顺序触发，现有测试未覆盖。
- 置信度: 中。
- 修复方向: 每次选择递增 request id 并在每个 await 后校验；或为当前任务持有独立 AbortController。

## 漏检复盘

- 默认分支/未知输入: 文件选择空列表、单/多文件路径均已检查。
- 异步失败/前提失效: 已检查 FileReader error/abort、卸载、默认资源和重复选择；发现上述三项。
- 半完成状态: 下载 helper 已使用 try/finally 回收 anchor/object URL；未发现新的 URL 泄漏。
- 渲染/导出/编码: `v-html` 仅见 DOMPurify 路径；文件名仅进入 download 属性，未发现 HTML 注入。

## 未覆盖区域

- Tauri 原生保存对话框未在本机运行验证；浏览器 anchor 下载路径已做静态复读。
