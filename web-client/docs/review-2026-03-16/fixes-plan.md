# 修复计划

> 基于 2026-03-16 代码审查生成
> 修复范围：web-client/
> **修复状态**：P0 修复已全部完成 (2026-03-16)

---

## 修复完成摘要

| 修复组 | 影响范围 | 状态 | Commit |
|--------|---------|------|--------|
| A — 并发安全 | 全链路 | ✅ 已完成 | `fix(P0): Group A — 并发安全` |
| B — 超时与恢复 | 协议/服务 | ✅ 已完成 | `fix(P0): Group B — 超时与恢复` |
| C — 资源泄漏 | 全应用 | ✅ 已完成 (部分为误报) | `fix(P0): Group C — 资源泄漏` |
| D — 安全防护 | 视图/Electron | ✅ 已完成 (部分为误报) | `fix(P0): Group D — 安全防护` |
| E — 类型安全与错误处理 | 多层 | ✅ 已完成 | `fix(P0): Group E — 类型安全与参数验证` |

### 误报项说明

| 原报告问题 | 实际状态 | 说明 |
|-----------|---------|------|
| SystemNoticeModal v-html XSS | ✅ 已防护 | `renderMarkdown()` 已使用 DOMPurify.sanitize() |
| SystemNoticeHistoryModal v-html XSS | ✅ 已防护 | 同上 |
| useToast 永久 event listener | ✅ 无泄漏 | 仅 dispatch 事件，不注册 listener |
| rom-assembly-store setTimeout 泄漏 | ✅ 已管理 | clearResult() 正确 clear timer |
| debug-settings setInterval 竞态 | ✅ 已管理 | cancel() 回调正确清理 interval |
| AbortController 覆盖状态泄漏 | ✅ 已处理 | startOperation() 先 abort 旧 controller |
| advanced-settings 原子性写入 | ✅ 设计正确 | setSettings() 批量更新后一次性 save |

---

## 快速决策矩阵

| 修复组 | 影响范围 | 风险 | 工作量 | 建议顺序 |
|--------|---------|------|--------|---------|
| A — 并发安全 | 全链路 | 🔴 高 | 大 | 1 |
| B — 超时与恢复 | 协议/服务 | 🔴 高 | 中 | 2 |
| C — 资源泄漏 | 全应用 | 🟡 中 | 中 | 3 |
| D — 安全防护 | 视图/Electron | 🟡 中 | 小 | 4 |
| E — 类型安全与错误处理 | 多层 | 🟡 中 | 中 | 5 |

---

## Group A — 并发安全

### A1. 引入传输层互斥锁

**文件**：`src/platform/serial/transports.ts`

**问题**：多个并发调用 `read()` / `write()` 可导致数据交错和响应错位。

**修复方案**：引入简单的 Promise-based mutex 保护读写操作。

```typescript
// src/platform/serial/mutex.ts
export class Mutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          resolve(() => {
            this._locked = false;
            const next = this._queue.shift();
            if (next) next();
          });
        } else {
          this._queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}
```

在 `WebSerialTransport` 中使用：
```typescript
private readonly mutex = new Mutex();

async sendAndReceive(data: Uint8Array, expectedLength: number): Promise<Uint8Array> {
  const release = await this.mutex.acquire();
  try {
    await this.write(data);
    return await this.read(expectedLength);
  } finally {
    release();
  }
}
```

### A2. 协议层复用传输互斥

**文件**：`src/protocol/beggar_socket/protocol-adapter.ts`

**问题**：多个协议命令并发发送会造成响应错位。

**修复方案**：协议层不需要额外锁——依赖传输层 `sendAndReceive` 原子操作即可。确保所有协议函数从独立的 `write()` + `read()` 改为调用传输层的原子 `sendAndReceive()`。

### A3. ConnectionUseCase disconnect 竞态

**文件**：`src/features/burner/application/connection-use-case.ts`

**修复方案**：添加 `isDisconnecting` 标志或使用 `AbortController` 防止重复 disconnect。

---

## Group B — 超时与恢复

### B1. 全片擦除超时保护

**文件**：`src/services/gba-adapter.ts`, `src/services/mbc5-adapter.ts`

**问题**：`while(true)` 轮询擦除状态无超时上限。

**修复方案**：

```typescript
async waitForEraseComplete(signal?: AbortSignal, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const status = await this.protocol.chipErasePoll();
    if (status === EraseStatus.Complete) return;
    await delay(500);
  }
  throw new Error('Chip erase timeout');
}
```

### B2. 流错误后恢复机制

**文件**：`src/platform/serial/transports.ts`

**问题**：WebSerialTransport reader 出错后流不可复用。

**修复方案**：捕获 read 错误后释放 reader lock 并重新获取 reader：

```typescript
private async resetReader(): Promise<void> {
  try {
    this.reader?.releaseLock();
  } catch { /* ignore */ }
  this.reader = this.port.readable?.getReader();
}
```

### B3. BurnerSession runWithTimeout 悬挂操作

**文件**：`src/features/burner/application/burner-session.ts`

**问题**：`Promise.race([task, timeout])` 中 timeout 触发后 task 仍在执行。

**修复方案**：将 `AbortSignal` 传递给底层操作，timeout 时 abort：

```typescript
async runWithTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
```

---

## Group C — 资源泄漏

### C1. SerialService openPort 资源泄漏

**文件**：`src/services/serial-service.ts`

**修复方案**：在 `openPort` 失败路径中确保释放端口：

```typescript
async openPort(options: SerialOptions): Promise<void> {
  try {
    await this.port.open(options);
  } catch (e) {
    this.port = null; // 释放引用
    throw e;
  }
}
```

### C2. Composable 生命周期管理

**文件**：
- `src/composables/cartburner/useCartBurnerSessionState.ts`
- `src/composables/useToast.ts`

**修复方案**：在 `onUnmounted` 中清理所有资源：

```typescript
// useToast.ts
onMounted(() => {
  window.addEventListener('toast', handler);
});
onUnmounted(() => {
  window.removeEventListener('toast', handler);
});
```

### C3. Store 定时器泄漏

**文件**：
- `src/stores/rom-assembly-store.ts`
- `src/settings/debug-settings.ts`

**修复方案**：保存定时器 ID 并在清理时 clear：

```typescript
// rom-assembly-store.ts
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleReset() {
  if (pendingTimeout) clearTimeout(pendingTimeout);
  pendingTimeout = setTimeout(() => { /* ... */ }, delay);
}
```

### C4. URL.createObjectURL 泄漏

**修复方案**：下载完成后调用 `URL.revokeObjectURL(url)`。

---

## Group D — 安全防护

### D1. v-html XSS 修复

**文件**：`src/components/modal/SystemNoticeModal.vue`, `SystemNoticeHistoryModal.vue`

**修复方案**：使用 DOMPurify 清理 HTML 内容：

```bash
npm install dompurify
npm install -D @types/dompurify
```

```typescript
import DOMPurify from 'dompurify';

const sanitizedContent = computed(() =>
  DOMPurify.sanitize(props.notice.content)
);
```

```html
<div v-html="sanitizedContent"></div>
```

### D2. Sentry PII 配置

**文件**：`src/utils/sentry-loader.ts`（或类似文件）

```typescript
Sentry.init({
  sendDefaultPii: false,  // 改为 false
  // ...
});
```

### D3. CSP 与 Buffer 暴露

**文件**：`electron/main.js`, `electron/preload.js`

- 移除 `'unsafe-inline'`，改用 nonce-based CSP
- 不在 preload 中全局暴露 `Buffer`，改为暴露具体的 helper 函数

---

## Group E — 类型安全与错误处理

### E1. 消除不安全类型断言

**文件**：`src/services/device-connection-manager.ts`, `src/components/CartBurner.vue`

**修复方案**：用运行时类型检查替代 `as` 断言：

```typescript
function isDeviceHandle(value: unknown): value is DeviceHandle {
  return value != null && typeof value === 'object' && 'port' in value;
}
```

### E2. AbortController 覆盖修复

**文件**：`src/features/burner/application/burner-session.ts`

**修复方案**：新操作开始前先 abort 旧 controller：

```typescript
startNewOperation() {
  this.abortController?.abort(); // 取消旧操作
  this.abortController = new AbortController();
}
```

### E3. advanced-settings 原子性写入

**文件**：`src/settings/advanced-settings.ts`

**修复方案**：构建完整对象后一次性写入 localStorage：

```typescript
function saveSettings(settings: AdvancedSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
```

### E4. 协议层参数验证

**文件**：`src/protocol/beggar_socket/protocol.ts`

**修复方案**：在 `rom_program` 等关键函数入口校验参数：

```typescript
if (data.length > bufferSize) {
  throw new RangeError(`Data length ${data.length} exceeds buffer size ${bufferSize}`);
}
```

---

## 延迟处理项

以下 P2/INFO 问题可在后续迭代中处理：

| 问题 | 类别 | 原因 |
|------|------|------|
| 魔法数字提取为常量 | P2 | 纯代码质量，无运行时风险 |
| 协议命令文档补充 | INFO | 文档改进 |
| 组件粒度拆分 | P2 | 重构工作量大，非紧急 |
| 测试覆盖率提升 | INFO | 需较大工作量 |
| romParser 可读性优化 | P2 | 功能正确，仅可读性 |
| 日志系统统一 | P2 | console.log → 统一 logger |

---

## 完成标准

修复完成后依次运行以下命令，全部通过即可提交：

```bash
cd web-client

# 1. TypeScript 类型检查
npx vue-tsc --noEmit

# 2. ESLint 检查（含架构依赖规则）
npm run lint

# 3. 单元测试
npm run test:run

# 4. 构建验证
npm run build

# 5. 架构依赖检查
npm run check:deps
```

所有命令零错误退出即视为修复完成。
