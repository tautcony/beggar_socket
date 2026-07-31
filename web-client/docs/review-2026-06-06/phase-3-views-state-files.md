# Phase 3 Views State Files

范围: `src/components/**`, `src/views/**`, `src/composables/**`, `src/stores/**`, markdown/system notice 文件。

## Findings

### P2-03: FileReader 只处理 onload，读取失败/abort 会让文件选择静默卡住

- 位置: `src/components/common/FileDropZone.vue:133`, `src/composables/useMultiMenuState.ts:160`
- 触发条件: 用户选择或拖入文件后，`FileReader.readAsArrayBuffer()` 触发 `error` 或 `abort`；多文件模式下任意一个文件读取失败。
- 影响: 单文件路径没有反馈，旧文件状态可能继续显示。多文件路径 `processedCount` 永远达不到 `files.length`，整批 `file-selected` 不会 emit，ROM assembly 或操作面板表现为“上传没反应”。Multi-menu 的菜单 ROM、游戏 ROM、背景图、存档文件同样静默失败。
- 证据: `FileDropZone.vue:137-152` 和 `:156-166` 只设置 `reader.onload`；`useMultiMenuState.ts:160-236` 四个文件读取函数也只处理 onload。
- 修复方向: 抽共享 `readFileAsArrayBuffer(file, signal?)` Promise helper，处理 `onload/onerror/onabort`。多文件可选择整批失败或部分成功，但必须 emit 失败事件/toast 并结束 pending 状态。补 FileReader error/abort 测试。

### P2-04: multi-menu 背景图异步处理卸载后仍可更新状态和发 toast

- 位置: `src/composables/useMultiMenuState.ts:200`
- 触发条件: 用户选择较大背景图后立即离开页面；FileReader onload 后继续动态 import Jimp、解析、生成 indexed preview。
- 影响: 初始化 fetch 有 AbortController，但 FileReader/Jimp 链路没有 disposed 检查。组件卸载后仍可能更新 refs、设置 preview URL、发 toast，造成延迟副作用和对象 URL 生命周期不清晰。
- 证据: `useMultiMenuState.ts:203-224` 在多个 await 后无 mounted/disposed guard；`onUnmounted` 只 `cleanupBgImagePreview()` 和 abort 初始化 fetch。
- 修复方向: 维护 `disposed` 标记和当前 FileReader 引用，unmount 时 abort；每个 await 后检查 disposed，避免状态写入/toast。补卸载后不更新状态、不发 toast 的测试。

### P3-01: 部分下载链路未用 finally revoke object URL

- 位置: `src/composables/useMultiMenuState.ts:358`, `src/views/RomAssemblyView.vue:460`
- 触发条件: `a.click()` 或下载流程中途异常。
- 影响: 大 ROM Blob URL 可能泄漏；用户没有失败反馈。`useCartBurnerFileState.saveAsFile()` 已有 try/finally 和测试，说明项目已认可该失败模式。
- 修复方向: 抽通用 safe download helper，append/click/revoke 全部放 try/finally。补 object URL revoke 测试。

## 已排查未命中

- `SystemNoticeModal` / `SystemNoticeHistoryModal` 使用 `v-html`，但内容来自 `renderMarkdown()`，已先经 DOMPurify sanitize，再增强链接属性；未发现当前 XSS 缺陷。
- 主 UI 文件名、端口信息、ROM 信息展示多为 mustache/属性绑定，未见未转义 DOM 注入。
- `SectorVisualization` pending timer 和 ResizeObserver 有清理路径。
- recent-file/localStorage 读取多处有 try/catch 或低风险降级。

## 漏检复盘

本 phase 主动检查了富文本、下载、FileReader、对象 URL、延迟异步更新、持久化半完成和 UI 重入。渲染安全未新增缺陷；文件读取和卸载后异步副作用是主要缺口。
