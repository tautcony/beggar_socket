# Phase 6 审查报告：stores / settings / composables — 状态与组合层

> 审查时间：2026-03-16  
> 审查文件数：9  
> 发现问题数：P0(1) / P1(5) / P2(7) / INFO(5)

## 已审查文件

- `src/stores/recent-file-names-store.ts`
- `src/stores/rom-assembly-store.ts`
- `src/settings/advanced-settings.ts`
- `src/settings/debug-settings.ts`
- `src/composables/useEnvironment.ts`
- `src/composables/useToast.ts`
- `src/composables/cartburner/index.ts`
- `src/composables/cartburner/useCartBurnerFileState.ts`
- `src/composables/cartburner/useCartBurnerSessionState.ts`

## 问题清单

### 🔴 P0 — [C11] `createMockSerialPort()` 中 `setInterval` 永不清除

**文件**：`src/settings/debug-settings.ts` — `createMockSerialPort()`

**现象**：
```typescript
setInterval(() => {
  if (responseIndex < mockResponses.length) {
    controller.enqueue(mockResponses[responseIndex]);
    responseIndex++;
  }
}, 100);
```

`ReadableStream.start()` 回调中创建了 `setInterval`，但没有在任何地方调用 `clearInterval`——既不在 stream 的 `cancel()` 中，也不在 port 的 `close()` 中，也不在所有 response 发送完毕后。

**影响**：每次调用 `createMockSerialPort()` 都会泄漏一个永久运行的定时器。在反复 connect/disconnect 的调试流程中，定时器会无限累积。此外，stream 被取消后 `controller.enqueue()` 会抛出异常。

**修复建议**：保存 interval ID，在 stream 的 `cancel()` 和所有 response 发送完后清除。或改用 `setTimeout` 链式调用。

---

### 🟡 P1 — [C6] `_operationTimeout` 初始值与 `resetToDefaults()` 不一致

**文件**：`src/settings/advanced-settings.ts`

**现象**：
```typescript
private static _operationTimeout = 100000;  // 字段声明：100 秒
// ...
static resetToDefaults(): void {
  this._operationTimeout = 30000;           // 重置：30 秒
}
```

**影响**：首次加载（无 localStorage）使用 100 秒超时；用户点击「恢复默认」后变为 30 秒。两种行为不一致，可能掩盖超时相关的 bug。

**修复建议**：统一两个值（应为 `30000`）。

---

### 🟡 P1 — [C5] `romAssemblyResult` store 持有大型 Uint8Array 且无自动释放

**文件**：`src/stores/rom-assembly-store.ts` — `setResult()` / `consumeResult()`

**现象**：`setResult()` 将完整 ROM `Uint8Array`（GBA 最大 32 MiB）存入 Pinia 响应式状态。数据只在 `consumeResult()` 或 `clearResult()` 时释放。如果用户在不触发消费的情况下离开页面（如浏览器后退、路由守卫、错误），大型 buffer 将无限期驻留内存。

**影响**：最大 32 MiB 无法回收的 RAM（因 Pinia reactive proxy 持有引用）。在低内存设备或重复操作时可能导致性能下降。

**修复建议**：添加过期检查（如 `Date.now() - timestamp > 60000` 时自动清除），或在消费页面的 `onBeforeRouteLeave` 中清除。

---

### 🟡 P1 — [C9] `useCartBurnerSessionState` 创建 `BurnerSession` 无清理

**文件**：`src/composables/cartburner/useCartBurnerSessionState.ts`

**现象**：
```typescript
export function useCartBurnerSessionState(translate: (key: string) => string) {
  const burnerSession = new BurnerSession();
  // ... 无 onUnmounted / onScopeDispose 清理
}
```

`BurnerSession` 拥有 `AbortController` 并累积日志（最多 500 条），但其所属 composable 没有注册 cleanup。

**影响**：组件在操作进行中被销毁时（如用户在 ROM 写入期间导航离开），`AbortController` 不被触发，操作静默继续。session 实例及其日志在 GC 前驻留内存（可能因闭包而延迟回收）。

**修复建议**：添加 `onScopeDispose(() => burnerSession.abortOperation())`。

---

### 🟡 P1 — [C4] `useEnvironment.ts` 使用 `process.env.NODE_ENV` 而非 Vite 惯例

**文件**：`src/composables/useEnvironment.ts`

**现象**：
```typescript
static get isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
```

项目其余部分一致使用 `import.meta.env.DEV` / `import.meta.env.PROD`。虽然 Vite 会替换 `process.env.NODE_ENV`，但这是非标准做法，在更严格的 Vite 配置或 SSR 上下文中可能失效。

**影响**：与代码库不一致。如果 Vite 配置变更可能静默失效。

**修复建议**：替换为 `import.meta.env.DEV` 和 `import.meta.env.PROD`。

---

### 🟡 P1 — [C6] `AdvancedSettings` 每个 setter 都触发 `saveSettings()`

**文件**：`src/settings/advanced-settings.ts` — `setSettings()` / 各属性 setter

**现象**：
```typescript
static set romPageSize(value: number) {
  this._romPageSize = this.validatePageSize(value);
  this.saveSettings();  // 每个 setter 都触发一次
}
```

当 `setSettings()` 设置 12 个属性时，会触发 12 次 `JSON.stringify + localStorage.setItem`。

**影响**：不必要的 I/O 开销。同步 localStorage 在低速设备上可能导致可感知的卡顿。更重要的是，如果中途出错，部分状态已持久化。

**修复建议**：添加批量模式标志，或让 `setSettings()` 直接设置私有字段（带验证），最后统一调用一次 `saveSettings()`。

---

### 🟢 P2 — [C9] `useToast` 通过 `CustomEvent` 在 `window` 上分发，无类型安全

**文件**：`src/composables/useToast.ts`

**现象**：
```typescript
const event = new CustomEvent('show-toast', {
  detail: { message, type, duration },
});
window.dispatchEvent(event);
```

**问题**：Toast 消息通过无类型的全局 `CustomEvent` 分发。消费者必须手动管理 `addEventListener`/`removeEventListener`。`CustomEvent.detail` 无编译时类型检查。

**影响**：listener 组件卸载时未移除监听器会导致旧回调被调用。

**修复建议**：添加类型化事件接口，或提供带 `onUnmounted` 清理的 `useToastListener` composable，或改用共享 reactive state。

---

### 🟢 P2 — [C8] `useCartBurnerFileState` 中 `parseInt(hexSize, 16)` 可能返回 NaN

**文件**：`src/composables/cartburner/useCartBurnerFileState.ts` — `onRomSizeChange()` / `onRamSizeChange()`

**现象**：
```typescript
function onRomSizeChange(hexSize: string) {
  selectedRomSize.value = hexSize;
  log(translate('messages.rom.sizeChanged', { size: formatBytes(parseInt(hexSize, 16)) }));
}
```

**问题**：`hexSize` 若为空或非法 hex，`parseInt` 返回 `NaN`，`formatBytes(NaN)` 产生乱码日志。

**影响**：实际中 hex 字符串来自受控下拉选项，风险较低。

**修复建议**：添加 `const size = parseInt(hexSize, 16); if (isNaN(size)) return;`。

---

### 🟢 P2 — [C5] `recentFileNamesStore` 无持久化——刷新后数据丢失

**文件**：`src/stores/recent-file-names-store.ts`

**问题**：store 未配置持久化插件，也无手动 `localStorage` 读写。关闭/刷新页面后最近文件名列表丢失。

**影响**：功能可用性大幅降低。

**修复建议**：添加 localStorage 持久化（通过 Pinia persist 插件或手动实现）。

---

### 🟢 P2 — [C8] `createMockSerialPort()` 使用 `as SerialPort` 类型断言

**文件**：`src/settings/debug-settings.ts`

**现象**：`return { ... } as SerialPort;`

**问题**：mock 对象可能缺少真实 `SerialPort` 接口上的属性。`as` 断言在编译时隐藏了类型不匹配。

**影响**：debug 专用代码，风险较低。如果代码检查 mock 上不存在的属性，会静默失败。

**修复建议**：使用 `satisfies SerialPort` 或创建实现接口的 mock 类。

---

### 🟢 P2 — [C11] `saveAsFile()` 创建 `<a>` 元素未附加到 DOM

**文件**：`src/composables/cartburner/useCartBurnerFileState.ts` — `saveAsFile()`

**现象**：
```typescript
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

**问题**：部分浏览器（Safari/WebKit）要求元素在 DOM 中才能触发 `click()` 下载。

**修复建议**：在 click 前 `document.body.appendChild(a)`，click 后 `document.body.removeChild(a)`。

---

### 🟢 P2 — [C9] `useEnvironment.ts` 是静态类而非 composable，命名误导

**文件**：`src/composables/useEnvironment.ts`

**问题**：命名为 `useEnvironment`（暗示 Vue composable），但导出的是无响应式状态的静态 `Environment` 类。位于 `composables/` 目录。代码库中无消费者，可能为死代码。

**修复建议**：移至 `utils/environment.ts`，或如果不再使用则移除。

---

### 🟢 P2 — [C6] `DebugSettings.init()` 作为模块副作用执行

**文件**：`src/settings/debug-settings.ts` — 第 228 行

**现象**：`DebugSettings.init();` 在模块顶层调用，导入该模块的任何文件都会触发 `localStorage` 读取。

**影响**：测试环境或 SSR 上下文中可能导致 `localStorage` 访问异常。Tree-shaking 无法消除此副作用。

**修复建议**：移除自动初始化，在应用引导代码（如 `main.ts`）中显式调用。

---

### ℹ️ INFO — [C8] `FileInfo` 类型重复定义

`types/file-info.ts` 和 `types/rom-assembly.ts` 中都定义了 `FileInfo`。composable 正确导入自 `types/file-info.ts`。`rom-assembly.ts` 中的定义可能是遗留代码。

---

### ℹ️ INFO — [C5] `recentFileNamesStore.getFileNames()` 返回副本，但 `fileNames` 仍可直接访问

`getFileNames()` 返回 `[...this.fileNames]`（防御性副本），但消费者可通过 `store.fileNames` 直接访问可变数组。这是标准 Pinia 行为，不算 bug。

---

### ℹ️ INFO — [C6] `validateRetryCount()` 先检查后截断

`Math.trunc(count)` 在边界检查之后调用（`3.9` 通过 `> MAX_RETRY_COUNT(10)` 检查后被截断为 `3`）。行为正确但与其他校验器（`validateThrottle` 先截断）顺序不一致。

---

### ℹ️ INFO — [C9] `useCartBurnerSessionState` 手动同步 BurnerSession → Vue refs

composable 通过 `syncSessionState()` / `syncProgressState()` / `syncLogsState()` 从 `BurnerSession.snapshot` 手动拷贝到 Vue `ref()`。这是有意设计（session 是普通类非响应式），但如果某次 session 变更后遗漏 `sync*` 调用会导致 UI 过时。当前 `runBurnerFlow` 模板在 try 和 finally 中都正确调用了 sync。

---

### ℹ️ INFO — [C5] `BurnerSession.snapshot` 直接返回内部状态对象

`snapshot` getter 返回 `this.state` 而非防御性副本。composable 同步时始终使用展开（`{ ...DEFAULT_PROGRESS, ...snapshot.progress }`），实际安全——但 "snapshot" 命名暗示不可变性，类级别并非如此。

## 未覆盖区域

无
