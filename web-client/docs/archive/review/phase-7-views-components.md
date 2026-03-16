# Phase 7 审查报告：views / components — 展示层

> 审查时间：2026-03-16  
> 审查文件数：42（4 views、35 components、3 TS 辅助文件）  
> 发现问题数：P0(0) / P1(2) / P2(10) / INFO(5)

## 已审查文件

### views/
- `src/views/HomeView.vue`
- `src/views/SerialTestView.vue`
- `src/views/GBAMultiMenuView.vue`
- `src/views/CartBurnerView.vue`

### components/
- `src/components/CartBurner.vue`
- `src/components/DeviceConnect.vue`
- `src/components/MorseBorder.vue`
- `src/components/AppFooter.vue`
- `src/components/AppHeader.vue`
- `src/components/SystemNotice.vue`
- `src/components/common/AppMenu.vue`
- `src/components/common/BaseModal.vue`
- `src/components/common/FloatingLink.vue`
- `src/components/common/GlobalToast.vue`
- `src/components/common/LangSwitcher.vue`
- `src/components/common/LogViewer.vue`
- `src/components/common/ThemeSwitcher.vue`
- `src/components/common/LinkText.vue`
- `src/components/emulator/GBAEmulator.vue`
- `src/components/emulator/GBCEmulator.vue`
- `src/components/emulator/GBEmulator.vue`
- `src/components/link/LinkAnnouncementBanner.vue`
- `src/components/link/LinkDeviceCard.vue`
- `src/components/modal/CartridgeToolsModal.vue`
- `src/components/modal/FileNameSelectorModal.vue`
- `src/components/modal/GBAMultiMenuHelpModal.vue`
- `src/components/modal/PortSelectorModal.vue`
- `src/components/modal/ProgressDisplayModal.vue`
- `src/components/modal/RTCModal.vue`
- `src/components/modal/SectorVisualization.vue`
- `src/components/modal/SettingsModal.vue`
- `src/components/modal/SystemNoticeHistoryModal.vue`
- `src/components/modal/SystemNoticeModal.vue`
- `src/components/operaiton/OperationButtonGroup.vue`
- `src/components/operaiton/OperationItem.vue`
- `src/components/operaiton/OperationPanel.vue`
- `src/components/operaiton/operation-config.ts`
- `src/components/operaiton/operation-types.ts`
- `src/components/progress/ProgressBar.vue`

## 问题清单

### 🟡 P1 — [C10] `SerialTestView.vue` 导入不存在的组件，属死代码

**文件**：`src/views/SerialTestView.vue`

**现象**：导入 `@/components/SerialTest.vue`（不存在），且整个视图未注册在 `router/index.ts` 中，为完全不可达的死代码。5 个符号（`testRunning`, `testResults`, `runPerformanceTest`, `clearTestResults`, `addTestResult`）全部未使用。

**影响**：如未来恢复路由注册，构建将立即失败。

**修复建议**：移除整个视图文件，或实现缺失的组件并注册路由。

---

### 🟡 P1 — [C9] `HomeView.vue` 未使用的 store 实例化和 ref 声明

**文件**：`src/views/HomeView.vue`

**现象**：`useRomAssemblyResultStore()` 初始化后零次属性访问；`showSettings` ref 声明后模板中无引用。

**影响**：不必要地实例化 Pinia store，增加运行时开销。

**修复建议**：移除未使用的 import、store 实例和 ref。

---

### 🟢 P2 — [C4] `GBAMultiMenuView.vue` fire-and-forget 异步调用无取消机制

**文件**：`src/views/GBAMultiMenuView.vue`

**现象**：三个 `void` 异步调用（`loadDefaultBackground`, `loadDefaultMenuRom`, `preloadImageLibrary`）在 setup 作用域直接触发，无 `AbortController` 或 unmount 保护。

**影响**：用户快速导航离开时异步操作仍会继续执行并修改已卸载组件的响应式状态。

**修复建议**：使用 `AbortController` 或在 `onUnmounted` 中设置标志位跳过后续更新。

---

### 🟢 P2 — [C1] `AppMenu.vue` `clickTimer` 未在 unmount 时清理

**文件**：`src/components/common/AppMenu.vue`

**现象**：`setTimeout` 创建的定时器在组件卸载时未清除。

**影响**：组件在 3 秒内卸载时定时器回调仍会执行。影响较小。

**修复建议**：添加 `onUnmounted(() => { if (clickTimer) clearTimeout(clickTimer); })`。

---

### 🟢 P2 — [C1] `CartBurner.vue` 无 `onUnmounted` 钩子

**文件**：`src/components/CartBurner.vue`

**现象**：`gbaAdapter` 和 `mbc5Adapter` ref 持有的适配器会话未在卸载时显式置空。

**影响**：依赖 `deviceReady` watcher 间接清理可能不够及时。实际资源泄漏风险较低（适配器不拥有串口连接）。

**修复建议**：添加 `onUnmounted(() => { gbaAdapter.value = null; mbc5Adapter.value = null; })`。

---

### 🟢 P2 — [C8] `GlobalToast.vue` 全局引用未在 unmount 时清除

**文件**：`src/components/common/GlobalToast.vue`

**现象**：`onMounted` 中将 `showToast` 赋值给 `window.showToast`，但 `onUnmounted` 未清除。

**影响**：全局命名空间污染；卸载后外部调用可能引用失效闭包。

**修复建议**：在 `onUnmounted` 中 `delete (window as any).showToast;`。

---

### 🟢 P2 — [C8] `GBEmulator.vue` 模拟器清理无法释放 AudioContext

**文件**：`src/components/emulator/GBEmulator.vue`

**现象**：`cleanup()` 仅将 `gameboy` 引用置 null，无法释放底层 `AudioContext` 等资源。

**影响**：多次打开/关闭模拟器可能累积未释放的 AudioContext（浏览器限制约 6 个）。

**修复建议**：在 cleanup 中尝试调用 `AudioContext.close()` 或手动断开音频节点。

---

### 🟢 P2 — [C2] `DeviceConnect.vue` 中 `deviceInfo` 未使用 `ref()`

**文件**：`src/components/DeviceConnect.vue`

**现象**：`deviceInfo` 声明为普通 `let` 而非 `ref()`，但在模板 click handler 中作为参数传递。

**影响**：当前因闭包语义可正常工作，但若将来模板中直接展示属性将无法触发响应式更新。

**修复建议**：改为 `const deviceInfo = ref<DeviceInfo | null>(null)`。

---

### 🟢 P2 — [C2] `FileNameSelectorModal.vue` 默认文件名时间戳在组件创建时固定

**文件**：`src/components/modal/FileNameSelectorModal.vue`

**现象**：`DateTime.now()` 在 setup 作用域计算一次赋值给 `defaultFileName`。组件通过 `v-model` 控制显隐而非重新创建，因此时间戳可能过时。

**影响**：长时间运行后打开模态框时默认文件名不准确。

**修复建议**：改为 `computed` 或在 `watch(modelValue)` 打开时重新计算。

---

### 🟢 P2 — [C9] `MorseBorder.vue` 未使用的 `ref` 导入

**文件**：`src/components/MorseBorder.vue`

**修复建议**：移除未使用的 `ref` 导入。

---

### 🟢 P2 — [C9] `FloatingLink.vue` 未使用的 `useAttrs()` 导入

**文件**：`src/components/common/FloatingLink.vue`

**现象**：导入 `useAttrs()` 但未使用返回值（模板直接使用 `$attrs`）。

**修复建议**：移除 `useAttrs` 导入。

---

### 🟢 P2 — [C9] `SerialTestView.vue` 全部符号未使用

**文件**：`src/views/SerialTestView.vue`

**现象**：5 个声明的变量/函数均在模板中未引用（与 P1-01 关联）。

**修复建议**：随 P1-01 一并处理。

---

### ℹ️ INFO — [C10] `v-html` 使用已正确防护 ✅

`SystemNoticeModal.vue` 和 `SystemNoticeHistoryModal.vue` 中的 `v-html` 均通过 `renderMarkdown()` → `DOMPurify.sanitize()` 处理。翻译内容也经由同一管道渲染。**安全。**

---

### ℹ️ INFO — [C11] `PortSelectorModal.vue` 未使用 `BaseModal` 组件

自行实现 overlay 逻辑，与其余 10+ 模态框模式不一致。建议后续重构中统一。

---

### ℹ️ INFO — [C11] `operaiton/` 目录拼写错误

`src/components/operaiton/` 应为 `operation`。涉及 5 个文件的导入路径变更。

---

### ℹ️ INFO — [C1] 已具备良好清理的组件 ✅

以下组件已正确实现 `onUnmounted` 清理：`LogViewer`、`BaseModal`、`CartridgeToolsModal`、`ProgressDisplayModal`、`SectorVisualization`、`RTCModal`、`GBAEmulator`、`GBCEmulator`、`GBAMultiMenuView`。

---

### ℹ️ INFO — [C7] `DeviceConnect` / `CartBurner` HMR 状态保持

`DeviceConnect.vue` 通过 `import.meta.hot` 正确保存/恢复设备连接状态，`CartBurner.vue` 同样保持日志状态。实现合理。

## 未覆盖区域

无
