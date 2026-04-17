# Phase 4 审查报告: 状态与组合层 / 视图与组件层

> 日期: 2026-04-15
> 文件数: 9
> 发现: P0(0) / P1(3) / P2(3) / INFO(2)

## 已审查文件

- `composables/cartburner/useCartBurnerFileState.ts` (重构)
- `composables/cartburner/useCartBurnerSessionState.ts` (变更)
- `composables/useEnvironment.ts` (变更)
- `components/CartBurner.vue` (变更)
- `components/DeviceConnect.vue` (变更)
- `components/modal/AboutModal.vue` (变更)
- `components/modal/ProgressDisplayModal.vue` (变更)
- `utils/tauri.ts` (新增)
- `utils/port-filter.ts` (变更)

## Findings

### [P1] useCartBurnerFileState saveAsFile Blob URL 泄漏

- **位置**: `composables/cartburner/useCartBurnerFileState.ts` `saveAsFile()`
- **触发条件**: Web 模式下 `a.click()` 抛出异常（浏览器安全策略阻止、沙箱环境）
- **影响**: `URL.createObjectURL(blob)` 创建的 Blob URL 未被释放。虽然有 `setTimeout(() => URL.revokeObjectURL(url), 100)` 在 click 之后，但如果 click 之前的 `document.body.appendChild(a)` 或 click 本身抛异常，revokeObjectURL 永远不会执行 → 内存泄漏
- **修复方向**: 将 click 和 cleanup 包裹在 try-finally 中：
  ```typescript
  const url = URL.createObjectURL(blob);
  try {
    a.href = url;
    document.body.appendChild(a);
    a.click();
  } finally {
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
  ```

### [P1] useCartBurnerFileState onRomFileSelected 空数组未处理

- **位置**: `composables/cartburner/useCartBurnerFileState.ts` `onRomFileSelected()`
- **触发条件**: 传入空数组 `[]` 时
- **影响**: `Array.isArray(fileInfo) ? fileInfo[0] : fileInfo` — 若 `fileInfo` 是空数组，`fileInfo[0]` 为 `undefined`，后续操作在 undefined 上调用属性访问 → TypeError 崩溃
- **修复方向**: 添加空数组检查：
  ```typescript
  const selected = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;
  if (!selected) return;
  ```

### [P1] DeviceConnect.vue 连接/断开竞态

- **位置**: `components/DeviceConnect.vue` `handleConnectDisconnect()`
- **触发条件**: 用户快速双击连接/断开按钮
- **影响**: 第一次点击进入 `connect()` 的 await，第二次点击时 `connected.value` 尚未更新，再次进入 `connect()`。DeviceConnectionManager 的 `isConnecting` 标志可以挡住部分情况，但如果第一次连接恰好在 `isConnecting = true` 之前完成并进入 `initializeDevice`，第二次连接会覆盖设备状态
- **修复方向**: 在组件层面添加加载状态锁：
  ```typescript
  const isProcessing = ref(false);
  async function handleConnectDisconnect() {
    if (isProcessing.value) return;
    isProcessing.value = true;
    try { ... } finally { isProcessing.value = false; }
  }
  ```

### [P2] ProgressDisplayModal timer 管理不够严密

- **位置**: `components/modal/ProgressDisplayModal.vue` watch
- **触发条件**: 组件快速 mount/unmount 或 visible 状态快速切换
- **影响**: `timer` 变量在 watch 和 onUnmounted 中都需管理。如果 watch 在 unmount 后触发（尽管 Vue 应自动停止 watch），可能留下游离 timer
- **修复方向**: 在 watch 激活时总是先 clear 旧 timer，onUnmounted 也 clear

### [P2] useEnvironment Tauri 平台检测静默失败

- **位置**: `utils/tauri.ts` `getPlatform()` / `getAppVersion()`
- **触发条件**: Tauri API 导入失败或运行时异常
- **影响**: `getName().catch(() => 'ChisFlash Burner')` 和 `getIdentifier().catch(() => 'unknown')` 静默降级。用户不知道平台检测失败，About 弹窗显示的信息可能误导
- **修复方向**: 可接受的降级策略，但建议添加 `console.warn` 记录失败

### [P2] port-filter.ts 字符串匹配过于宽松

- **位置**: `utils/port-filter.ts` 端口匹配逻辑
- **触发条件**: 制造商名称包含目标子串（如 "ST" 匹配 "STMicroelectronics" 但也匹配 "STRANGE"）
- **影响**: 可能匹配到非目标设备。对 BeggarSocket (0x0483:0x0721) 的 VID/PID 过滤是精确的，厂商名过滤仅在 VID/PID 不可用时使用，所以实际风险较低
- **修复方向**: 低优先级，可保持现状

### [INFO] Tauri 安全配置 — devCsp 使用 unsafe-inline/unsafe-eval

- **位置**: `src-tauri/tauri.conf.json` security.devCsp
- **影响**: 开发环境的 CSP 允许 `'unsafe-inline'` 和 `'unsafe-eval'`，这是 dev server (Vite HMR) 的标准需求。生产环境 CSP 不包含这些指令 ✅
- **修复方向**: 无需修复。生产 CSP 缺少 `form-action` 和 `frame-ancestors`，建议补充：
  ```
  form-action 'self'; frame-ancestors 'none';
  ```

### [INFO] Tauri capabilities 配置 — 权限范围合理

- **位置**: `src-tauri/capabilities/default.json`
- **影响**: 权限列表精确列出了所有需要的串口操作（open, close, read, write, signals 等），未包含文件系统、shell 等高危权限。配置合理 ✅

## 漏检复盘

- **默认分支 / 未知输入**: 已检查 — 发现 P1-02 空数组问题
- **异步失败 / 前提失效**: 发现 P1-01 Blob URL 泄漏、P1-03 连接竞态
- **半完成状态 / 重建窗口**: CartBurner.vue 的 adapter 初始化有 guard（已有 null check），无新问题
- **渲染 / 导出 / 编码**: 检查了 AboutModal 和 ProgressDisplayModal — 使用 `$t()` 和模板插值，无 v-html。SystemNoticeModal 的 v-html XSS 问题在上次审查中已报告
- 本 phase 仍然证据不足的点: HMR 状态恢复路径在生产环境不存在，无需关注

## 未覆盖区域

- `composables/useToast.ts` — 上次审查报告的事件监听泄漏，未在本次变更范围内
- `stores/rom-assembly-store.ts` — 未变更
- `settings/advanced-settings.ts` — 未变更
