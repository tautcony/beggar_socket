# Phase 6 审查报告：状态与组合层 (stores/composables/settings)

> 审查时间：2026-03-16
> 审查文件数：9
> 发现问题数：P0(5) / P1(7) / P2(2) / INFO(0)

## 已审查文件

1. web-client/src/stores/rom-assembly-store.ts
2. web-client/src/stores/recent-file-names-store.ts
3. web-client/src/composables/cartburner/index.ts
4. web-client/src/composables/cartburner/useCartBurnerFileState.ts
5. web-client/src/composables/cartburner/useCartBurnerSessionState.ts
6. web-client/src/composables/useEnvironment.ts
7. web-client/src/composables/useToast.ts
8. web-client/src/settings/advanced-settings.ts
9. web-client/src/settings/debug-settings.ts

## 问题清单

### 🔴 P0 — [C11] useCartBurnerSessionState — BurnerSession 生命周期管理

**文件**：`web-client/src/composables/cartburner/useCartBurnerSessionState.ts`

**问题**：`BurnerSession` 在 composable 重新挂载时复用，卸载时仅 abort 不清除内部状态（logs、progressInfo），导致旧数据残留和内存积累。

**修复建议**：`onScopeDispose` 中调用 `clearLogs()` 和 `resetProgress()`。

---

### 🔴 P0 — [C11] rom-assembly-store — setTimeout 泄漏与 Pinia 重实例化

**文件**：`web-client/src/stores/rom-assembly-store.ts`

**问题**：模块级 `cleanupTimer` 在 Pinia `createPinia()` 重新创建时不会重置，定时器可能引用已销毁的 store。32MB assembledRom 可能被定时器持有无法 GC。

**修复建议**：将 `cleanupTimer` 移入 store state 中。

---

### 🔴 P0 — [C11] useToast — 永久 event listener

**文件**：`web-client/src/composables/useToast.ts`

**问题**：`window.addEventListener('show-toast', ...)` 全局绑定后未在组件卸载时移除。

**修复建议**：在 App.vue 中通过 `onBeforeUnmount` 清除全局监听器。

---

### 🔴 P0 — [C5] advanced-settings — 原子性写入失败

**文件**：`web-client/src/settings/advanced-settings.ts` — `setSettings()`

**问题**：内存状态逐个更新后尝试保存到 localStorage。若 `saveSettings()` 因 QuotaExceededError 失败，内存状态已修改但持久化失败，导致不一致。

**修复建议**：先验证所有值和容量，通过后再一次性更新内存状态。

---

### 🔴 P0 — [C11] debug-settings — setInterval 竞态未安全清除

**文件**：`web-client/src/settings/debug-settings.ts` — `createMockSerialPort()`

**问题**：`cancel()` 可能在 `start()` 设置 `intervalId` 前被调用，导致 `clearInterval(undefined)` 无效，定时器继续运行。

**修复建议**：使用 `stopped` 标记确保定时器不会在已取消后启动。

---

### 🟡 P1 — [C7] useCartBurnerSessionState — Promise 链中 AbortSignal 传播

**问题**：`executeOperation` 传递 signal 给 operation，但 operation 中的 Promise 链未必检查信号状态。

---

### 🟡 P1 — [C11/C5] useCartBurnerFileState — URL.createObjectURL 泄漏

**文件**：`web-client/src/composables/cartburner/useCartBurnerFileState.ts` — `saveAsFile()`

**问题**：`a.click()` 异步触发下载时，`URL.revokeObjectURL()` 可能在下载完成前执行。

---

### 🟡 P1 — [C9] rom-assembly-store — 消费后无 watch 更新 UI

**问题**：assembledRom 被消费后无 watch 监听变化，消费页面必须手动调用 `consumeResult()` 并处理 null。

---

### 🟡 P1 — [C9] recent-file-names-store — localStorage 写入静默失败

**问题**：私密模式下 localStorage 写入失败被静默忽略。

---

### 🟡 P1 — [C9/C11] advanced-settings — 每个 setter 频繁写 localStorage

**问题**：设置 10 个参数会调用 `localStorage.setItem()` 10 次，移动设备上显著延迟。

**修复建议**：使用 debounce 或批量保存。

---

### 🟡 P1 — [C9] useCartBurnerSessionState — computed 竞态条件

**问题**：`showProgressModal` computed 在快速操作时可能返回不一致结果。

---

### 🟡 P1 — [C5] debug-settings — generateRandomData 参数验证缺失

**问题**：`size` 为负数或 Infinity 时会导致异常。

---

### 🟢 P2 — useEnvironment 缓存优化

**建议**：`import.meta.env.DEV` 编译时替换，可缓存在模块级别。

---

### 🟢 P2 — advanced-settings 版本迁移机制缺失

**建议**：添加 schema 版本号支持设置格式升级。

---

## 未覆盖区域

无
