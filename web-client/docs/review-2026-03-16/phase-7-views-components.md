# Phase 7 审查报告：视图与组件层 (views/components)

> 审查时间：2026-03-16
> 审查文件数：30+（10 主要文件 + 20 子目录组件）
> 发现问题数：P0(3) / P1(8) / P2(5) / INFO(3)

## 已审查文件

### 主要视图与组件
1. web-client/src/views/HomeView.vue
2. web-client/src/views/RomAssemblyView.vue
3. web-client/src/views/GBAMultiMenuView.vue
4. web-client/src/components/CartBurner.vue
5. web-client/src/components/DeviceConnect.vue
6. web-client/src/components/DebugPanel.vue
7. web-client/src/components/LanguageSwitcher.vue
8. web-client/src/components/LogViewer.vue
9. web-client/src/components/MorseBorder.vue
10. web-client/src/App.vue

### 子目录组件
- common/: AppMenu, BaseButton, BaseModal, FileDropZone, FloatingLink, GlobalToast, RomInfoPanel, ToggleSwitch
- emulator/: GBAEmulator, GBCEmulator, GBEmulator
- link/: DebugLink, GitHubLink
- modal/: AboutModal, AdvancedSettingsModal, CartridgeToolsModal, DebugToolModal, FileNameSelectorModal, MultiCartResultModal, PortSelectorModal, ProgressDisplayModal, RTCModal, RomAnalyzerModal, SystemNoticeHistoryModal, SystemNoticeModal
- operaiton/: ChipOperations, RamOperations, RomOperations, contracts, index
- progress/: SectorVisualization

## 问题清单

### 🔴 P0 — [C10] SystemNoticeModal — 未验证的 v-html 使用

**文件**：`web-client/src/components/modal/SystemNoticeModal.vue`

**问题**：直接渲染 HTML 到 DOM (`v-html="displayContentHtml"`)，如果内容来自不受信任的源（API、用户输入），可执行恶意脚本。

**影响**：XSS 攻击风险。

**修复建议**：确认 HTML 来源经过 DOMPurify 消毒；添加 `DOMPurify.sanitize(html)` 调用。

**相关**：SystemNoticeHistoryModal.vue 同样问题。

---

### 🔴 P0 — [C10] SystemNoticeHistoryModal — 同上 v-html XSS 风险

**文件**：`web-client/src/components/modal/SystemNoticeHistoryModal.vue`

---

### 🔴 P0 — [C8/C10] CartBurner.vue — 绕过 TypeScript 类型安全

**文件**：`web-client/src/components/CartBurner.vue`

**问题**：使用 `eslint-disable @typescript-eslint/no-unsafe-member-access` 绕过类型检查访问未声明的方法 (`deviceConnectRef.value.connect()`)。

**修复建议**：使用 `defineExpose` 显式声明公开方法。

---

### 🟡 P1 — [C6] RomOperations.vue — ROM 大小魔法数字

**问题**：ROM 大小范围 (`0x00040000` 等) 硬编码在组件中，缺少常量定义。

---

### 🟡 P1 — [C6] GBAMultiMenuView — 硬编码字体选项和存档槽位

**问题**：字体选项 (1, 2) 和存档槽位范围 (1-10) 直接硬编码。

---

### 🟡 P1 — [C9] LogViewer.vue — 双重 nextTick 复杂滚动逻辑

**问题**：使用双重 `await nextTick()` 确保 DOM 更新，表示逻辑复杂度过高。

**修复建议**：使用 `flush: 'post'` watch 选项。

---

### 🟡 P1 — [C9/C11] ProgressDisplayModal — 计时器状态管理混乱

**问题**：`setInterval` 在 watch 中创建，状态变化时可能未正确清理。

---

### 🟡 P1 — [C9] CartBurner.vue — 组件过大，UI 与编排未完全解耦

**问题**：已知差距，CartBurner.vue 承担了过多的职责。

---

### 🟡 P1 — [C6] 多处 i18n 不完整

**问题**：部分组件中存在硬编码的英文文本（如 "Font 1", "Font 2"），未使用 `$t()` 国际化。

---

### 🟡 P1 — [C11] AdvancedSettingsModal — 表单重置不完整

**问题**：关闭弹窗时表单状态可能残留。

---

### 🟡 P1 — [C9] RomAssemblyView — 大量 slots 的性能问题

**问题**：当 ROM 槽位数量较多时（如 16MB 卡带），UI 渲染可能较慢。

**修复建议**：使用虚拟列表或分页。

---

### 🟢 P2 — operaiton 目录名拼写错误

**问题**：`operaiton` 应为 `operation`。

---

### 🟢 P2 — Emulator 组件缺少加载状态反馈

**问题**：GBAEmulator/GBCEmulator/GBEmulator 加载 WASM 时无 loading 指示。

---

### 🟢 P2 — BaseModal 缺少 keyboard 快捷键

**问题**：弹窗不支持 ESC 关闭。

---

### 🟢 P2 — SectorVisualization 性能优化

**问题**：大量扇区时 DOM 节点数可能很多。

**修复建议**：使用 Canvas 替代大量 DOM 节点。

---

### 🟢 P2 — FileDropZone 缺少文件类型验证提示

**问题**：拖放非支持的文件类型时无清晰错误提示。

---

### ℹ️ INFO — 建议使用 `<Suspense>` 包裹异步组件

---

### ℹ️ INFO — 建议统一 emit 事件命名规范

---

### ℹ️ INFO — 建议为大型组件添加性能监控

---

## 未覆盖区域

- 部分 modal 组件（如 CartridgeToolsModal、DebugToolModal）内容较多，仅快速扫描
