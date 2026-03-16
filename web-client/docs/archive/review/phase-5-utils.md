# Phase 5 审查报告：utils — 工具层

> 审查时间：2026-03-16  
> 审查文件数：22  
> 发现问题数：P0(0) / P1(3) / P2(4) / INFO(3)

## 已审查文件

- `src/utils/async-utils.ts`
- `src/utils/address-utils.ts`
- `src/utils/compression-utils.ts`
- `src/utils/crc-utils.ts`
- `src/utils/formatter-utils.ts`
- `src/utils/port-filter.ts`
- `src/utils/sector-utils.ts`
- `src/utils/translation.ts`
- `src/utils/log-viewer.ts`
- `src/utils/markdown.ts`
- `src/utils/electron.ts`
- `src/utils/errors/NotImplementedError.ts`
- `src/utils/errors/PortSelectionRequiredError.ts`
- `src/utils/monitoring/sentry-loader.ts`
- `src/utils/monitoring/sentry-tracker.ts`
- `src/utils/parsers/cfi-parser.ts`
- `src/utils/parsers/rom-parser.ts`
- `src/utils/progress/progress-builder.ts`
- `src/utils/progress/progress-reporter.ts`
- `src/utils/progress/speed-calculator.ts`
- `src/utils/rom/rom-assembly-utils.ts`
- `src/utils/rom/rom-editor.ts`

## 问题清单

### 🟡 P1 — [C3] `cfi-parser.ts` 中多处 `workBuffer[offset]` 无边界检查

**文件**：`src/utils/parsers/cfi-parser.ts` — `generateInfoString()`

**现象**：  
```typescript
let priAddress = (workBuffer[0x2A] | (workBuffer[0x2C] << 8)) * 2;
// ...
const priP = pickAscii(workBuffer[priAddress], workBuffer[priAddress + 1]);
// ...
if (workBuffer[priAddress + 0x1E] !== 0 && ...) {
  info.tbBootSectorRaw = workBuffer[priAddress + 0x1E];
```

以及扇区区域解析：
```typescript
for (let i = 0; i < Math.min(4, info.eraseSectorRegions); i++) {
  const sectorCount = ((workBuffer[0x5C + (i * 8)] << 8) | workBuffer[0x5A + (i * 8)]) + 1;
```

**问题**：  
- `priAddress` 由 workBuffer 中的数据计算得出（`(workBuffer[0x2A] | (workBuffer[0x2C] << 8)) * 2`），如果 CFI 数据损坏，`priAddress` 可能指向 workBuffer 之外。后续 `workBuffer[priAddress + 0x1E]` 等访问会返回 `undefined`（不抛异常），导致后续计算产生 `NaN`
- 扇区区域循环中 `eraseSectorRegions` 来自 workBuffer，虽然限制了 `Math.min(4, ...)`，但最大索引 `0x5C + 3*8 = 0x74` 时访问 `workBuffer[0x74]`——如果输入数据长度不足，同样会读到 `undefined`
- JavaScript 的 `Uint8Array` 越界读取返回 `undefined` 而非抛异常，这使得错误难以发现

**影响**：  
畸形 CFI 数据导致解析结果包含 `NaN` 或错误值，可能影响后续扇区擦除地址计算。

**修复建议**：  
在 `priAddress` 计算后验证范围：
```typescript
if (priAddress + 0x1E >= workBuffer.length) return false;
```
在循环前验证 `workBuffer.length >= 0x5A + eraseSectorRegions * 8 + 6`。

---

### 🟡 P1 — [C11] Sentry 配置 `sendDefaultPii: true` 且无 PII 过滤

**文件**：`src/utils/monitoring/sentry-loader.ts` — `loadSentry()`

**现象**：  
```typescript
Sentry.init({
  // ...
  sendDefaultPii: true,
  beforeSend(event) {
    if (import.meta.env.DEV) {
      console.log('Sentry event (dev mode):', event);
      const isEnabled = config.enabled ?? import.meta.env.VITE_SENTRY_ENABLED === 'true';
      return isEnabled ? event : null;
    }
    return event;
  },
});
```

**问题**：  
1. `sendDefaultPii: true` 会让 Sentry 自动收集 IP 地址、User-Agent、cookies 等个人识别信息
2. `beforeSend` 钩子在生产环境下直接返回 `event`，不做任何 PII 过滤或数据脱敏
3. 对于一个硬件编程工具，错误上下文中可能包含文件路径、ROM 文件名等用户敏感信息

注意：Sentry 仅在 `VITE_SENTRY_ENABLED === 'true'` 时加载，所以本地开发和没有配置 DSN 的部署不受影响。但一旦启用，所有 PII 都会发送。

**影响**：  
隐私合规风险——用户的个人信息（IP、文件名）可能被发送到 Sentry 服务器。

**修复建议**：  
- 将 `sendDefaultPii` 设为 `false`
- 在 `beforeSend` 中过滤敏感数据（如文件路径、ROM 文件名）
- 或至少在文档中明确告知用户数据收集范围

---

### 🟡 P1 — [C3] `rom-parser.ts` 中 ROM header 解析未验证最小长度

**文件**：`src/utils/parsers/rom-parser.ts`

**现象**：  
GBA ROM header 解析读取 `0x00`–`0xBC` 范围的数据，GB ROM header 读取 `0x100`–`0x14F` 范围。如果用户上传的文件小于这些偏移量，`Uint8Array` 访问越界返回 `undefined`，导致 `TextDecoder.decode()` 收到包含 `undefined` 值的数组。

`TextDecoder.decode()` 在默认 `fatal: false` 模式下对无效字节会用替换字符（U+FFFD），不会抛异常——但解析出的标题、校验和等信息将变得无意义。

**问题**：  
缺少 `if (data.length < MINIMUM_HEADER_SIZE)` 的前置校验。

**影响**：  
小文件（如用户误选了非 ROM 文件）不会报错，而是返回包含乱码的 `RomInfo`，`isValid` 字段可能仍为 `true`。

**修复建议**：  
在 `parseRom()` 入口添加最小长度检查。GBA 至少需要 `0xC0` 字节，GB 至少需要 `0x150` 字节。

---

### 🟢 P2 — [C10] `markdown.ts` 渲染流程安全但链接增强存在细微问题

**文件**：`src/utils/markdown.ts` — `renderMarkdown()` / `enhanceLinks()`

**现象**：  
```typescript
export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown) as string;
  const sanitized = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] });
  return enhanceLinks(sanitized);
}
```

**问题**：  
渲染流程整体是安全的：`marked` 解析 → `DOMPurify` 消毒 → `enhanceLinks` 增强链接。DOMPurify 正确地消除了 XSS 风险。

但 `enhanceLinks()` 使用 `DOMParser` 重新解析已消毒的 HTML，然后修改 DOM 并通过 `doc.body.innerHTML` 输出。这个二次解析理论上是安全的（因为输入已经是消毒后的），但如果未来有人修改了流程顺序（如 `enhanceLinks` 在 `DOMPurify` 之前执行），就会引入 XSS 风险。

此外，`shouldForceDownload()` 中使用 `new URL(href, window.location.href)` 解析 URL，如果 `href` 是 `javascript:` 开头但不在协议白名单 `['http:', 'https:']` 中，会被正确拒绝。

**影响**：  
当前安全。但流程的隐式安全依赖（DOMPurify 必须在 enhanceLinks 之前）未在代码注释中明确说明。

**修复建议**：  
添加注释说明安全依赖关系：`// SECURITY: DOMPurify must run BEFORE enhanceLinks`。

---

### 🟢 P2 — [C6] `speed-calculator.ts` 中 `reset()` 后 `startTime` 为 null 的行为

**文件**：`src/utils/progress/speed-calculator.ts`

**现象**：  
构造函数中：
```typescript
constructor(timeWindowMs = 3000) {
  this.timeWindow = timeWindowMs;
  this.startTime = Date.now();
}
```

`addDataPoint()` 中：
```typescript
this.startTime ??= timestamp;
```

**问题**：  
构造时 `startTime` 被设为 `Date.now()`，但如果调用了 `reset()`（假设存在），`startTime` 变为 `null`。后续第一个 `addDataPoint` 通过 `??=` 将 `startTime` 设为数据点时间戳。这意味着 reset 后的平均速度计算不包含从 reset 到第一个数据点之间的空闲时间。

代码注释已说明这是有意设计（重试等待时间不计入），但构造时又将 `startTime` 设为当前时间（包含操作建立耗时），两种行为不一致。

**影响**：  
平均速度计算在首次操作和 reset 后行为不完全一致。在大多数情况下差异可忽略。

**修复建议**：  
统一行为——要么构造时也用 `null`（通过 `??=` 延迟设定），要么 reset 时也设为 `Date.now()`。在注释中明确说明设计选择。

---

### 🟢 P2 — [C8] `rom-assembly-utils.ts` 中 `placeFileInSlots()` 缺少连续空闲槽位的预检查

**文件**：`src/utils/rom/rom-assembly-utils.ts`

**现象**：  
基于 subagent 分析，`placeFileInSlots()` 在分配文件到槽位时，先计算所需槽位数，然后寻找连续空闲位置。但在实际放置前没有原子性保证——如果中途失败（如槽位状态被其他逻辑修改），部分槽位可能已被标记但数据未写入。

**问题**：  
在当前单线程 JavaScript 环境下不会出现真正的竞态条件，但缺少预检验证（验证所有目标槽位都确实为空）可能导致在代码修改后引入 bug。

**影响**：  
当前安全。如果未来引入异步槽位操作，可能产生不一致。

**修复建议**：  
在放置前添加 `assert` 验证所有目标槽位状态。

---

### 🟢 P2 — [C2] `translation.ts` 中 Google Translate API 响应未校验格式

**文件**：`src/utils/translation.ts` — `translateText()`

**现象**：  
翻译函数调用 Google Translate API 后直接按 `data[0][0][0]` 访问结果，未验证响应结构。如果 API 响应格式变更或返回异常数据，会抛出 `TypeError`。

**问题**：  
外部 API 响应属于不可控输入，应在信任边界进行结构验证。

**影响**：  
API 格式变更导致翻译功能崩溃，但不影响核心功能（翻译是辅助功能）。

**修复建议**：  
添加结构校验：`if (!Array.isArray(data?.[0]?.[0])) throw new Error('Invalid response')`。

---

### ℹ️ INFO — [C3] `crc-utils.ts` CRC16 实现与固件一致

**文件**：`src/utils/crc-utils.ts`

**说明**：  
CRC16 使用 Modbus CRC16 算法（初始值 0xFFFF，多项式 0xA001），与固件 `uart.c` 中的 `modbusCRC16()` 实现一致。lookup table 版本 `modbusCRC16_lut()` 是标准 Modbus CRC16 查找表优化，结果与固件逐位计算版本等价。虽然固件当前不校验 CRC，但实现本身是正确的。

---

### ℹ️ INFO — [C10] `markdown.ts` XSS 防护有效

**文件**：`src/utils/markdown.ts`

**说明**：  
`renderMarkdown()` 使用 `DOMPurify.sanitize()` 对 `marked` 的输出进行 HTML 消毒，有效防止 XSS 攻击。`enhanceLinks()` 为所有外链添加 `target="_blank"` 和 `rel="noopener noreferrer"`，正确防止了 reverse-tabnabbing。`shouldForceDownload()` 限制了只对同源的常见 ROM 文件扩展名触发下载。安全实现良好。

---

### ℹ️ INFO — [C6] `sector-utils.ts` 数值范围安全

**文件**：`src/utils/sector-utils.ts`

**说明**：  
GBA ROM 最大 128MB（0x08000000），GBC ROM 最大 32MB。JavaScript Number 的安全整数范围为 2^53（约 9PB），远超 ROM 操作中可能涉及的数值范围。扇区地址计算和乘法操作在 GBA/GBC 场景下不会溢出。

---

## 未覆盖区域

无
