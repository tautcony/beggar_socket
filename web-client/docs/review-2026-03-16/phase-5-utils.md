# Phase 5 审查报告：工具层 (utils)

> 审查时间：2026-03-16
> 审查文件数：22
> 发现问题数：P0(0) / P1(3) / P2(6) / INFO(2)

## 已审查文件

1. web-client/src/utils/address-utils.ts
2. web-client/src/utils/async-utils.ts
3. web-client/src/utils/compression-utils.ts
4. web-client/src/utils/crc-utils.ts
5. web-client/src/utils/electron.ts
6. web-client/src/utils/formatter-utils.ts
7. web-client/src/utils/log-viewer.ts
8. web-client/src/utils/markdown.ts
9. web-client/src/utils/port-filter.ts
10. web-client/src/utils/sector-utils.ts
11. web-client/src/utils/translation.ts
12. web-client/src/utils/parsers/cfi-parser.ts
13. web-client/src/utils/parsers/rom-parser.ts
14. web-client/src/utils/rom/rom-assembly-utils.ts
15. web-client/src/utils/rom/rom-editor.ts
16. web-client/src/utils/progress/progress-builder.ts
17. web-client/src/utils/progress/progress-reporter.ts
18. web-client/src/utils/progress/speed-calculator.ts
19. web-client/src/utils/errors/NotImplementedError.ts
20. web-client/src/utils/errors/PortSelectionRequiredError.ts
21. web-client/src/utils/monitoring/sentry-loader.ts
22. web-client/src/utils/monitoring/sentry-tracker.ts

## 问题清单

### 🟡 P1 — [C10] Sentry 配置泄露 PII 信息

**文件**：`web-client/src/utils/monitoring/sentry-loader.ts`

**问题**：`sendDefaultPii: true` 启用默认 PII 发送，IP 地址、用户代理等敏感信息会发送到 Sentry 服务器，违反 GDPR/CCPA 数据保护规范。

**修复建议**：设置 `sendDefaultPii: false`，若需要使用匿名化 ID。

---

### 🟡 P1 — [C4] CFI 解析器和压缩工具中 console.log 过度使用

**文件**：`web-client/src/utils/parsers/cfi-parser.ts`、`web-client/src/utils/compression-utils.ts`

**问题**：`printBufferAsASCII()` 直接输出到控制台，在生产环境中泄露 Flash CFI 数据和内部状态。

**修复建议**：添加条件日志，非 DEV 环境下禁用。

---

### 🟡 P1 — [C2/C10] translation.ts fetch 调用缺少超时和错误处理

**文件**：`web-client/src/utils/translation.ts` — `translateText()`

**问题**：Google Translate API 调用无超时控制，无速率限制处理，`response.json()` 解析失败可能未捕获。

**修复建议**：添加 AbortController 超时、429 状态码处理、JSON 解析防护。

---

### 🟢 P2 — [C6] CFI 解析器中的魔法数字缺乏命名常量

**文件**：`web-client/src/utils/parsers/cfi-parser.ts`

**问题**：CFI 标准偏移量（0x20, 0x22, 0x24, 0x2A, 0x36, 0x38 等）硬编码分散在代码中。

**修复建议**：提取为 `CFI_OFFSETS` 常量对象。

---

### 🟢 P2 — [C3] ROM 校验和计算缺少专项测试

**文件**：`web-client/src/utils/parsers/rom-parser.ts` — `calculateGBAChecksum()`, `calculateGBGlobalChecksum()`

**问题**：GBA 校验和 `(-(headerSum + 0x19)) & 0xFF` 的二进制补码计算逻辑复杂，未见专项测试用例覆盖。

**修复建议**：添加使用已知有效 ROM 的测试向量。

---

### 🟢 P2 — [C10] Markdown 渲染链接 rel 属性处理可优化

**文件**：`web-client/src/utils/markdown.ts` — `enhanceLinks()`

**问题**：当前依赖 DOMPurify 在前；若顺序变化可能遗漏恶意 rel 属性值。

**修复建议**：对 rel 值添加白名单检查。

---

### 🟢 P2 — [C3] Huffman 解压无下标越界保护

**文件**：`web-client/src/utils/compression-utils.ts` — `huffUnComp()`

**问题**：`readUint32LE(data, dataIndex)` 在 `dataIndex + 4 > data.length` 时可能读取越界。出错时返回部分数据而非抛出异常。

**修复建议**：添加安全的读取函数，越界时抛出明确异常。

---

### 🟢 P2 — [C3] ROM Assembly 文件放置时截断无警告

**文件**：`web-client/src/utils/rom/rom-assembly-utils.ts` — `assembleRom()`

**问题**：文件超出 ROM 边界时被静默截断，用户不知道数据丢失。

**修复建议**：超出时抛出异常或发出警告。

---

### 🟢 P2 — [C3] CFI 解析器缓冲区写入大小字节序可能错误

**文件**：`web-client/src/utils/parsers/cfi-parser.ts`

**问题**：`(workBuffer[0x56] << 8) | workBuffer[0x54]` 可能是大端序读取，而 CFI 通常使用小端序。

**修复建议**：确认 CFI 标准字节序并统一使用 `readUint16LE`。

---

### ℹ️ INFO — 错误处理可使用结构化日志

建议使用统一的 Logger 模块替代分散的 console.error。

---

### ℹ️ INFO — port-filter.ts 硬编码设备 ID

建议允许通过配置文件覆盖 STM32 VID/PID。

---

## 未覆盖区域

无
