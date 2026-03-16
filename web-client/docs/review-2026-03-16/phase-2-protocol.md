# Phase 2 审查报告：协议层 (protocol/beggar_socket)

> 审查时间：2026-03-16
> 审查文件数：8
> 发现问题数：P0(1) / P1(7) / P2(3) / INFO(2)

## 已审查文件

1. web-client/src/protocol/beggar_socket/command.ts
2. web-client/src/protocol/beggar_socket/protocol.ts
3. web-client/src/protocol/beggar_socket/protocol-adapter.ts
4. web-client/src/protocol/beggar_socket/protocol-utils.ts
5. web-client/src/protocol/beggar_socket/payload-builder.ts
6. web-client/src/protocol/beggar_socket/packet-read.ts
7. web-client/src/protocol/beggar_socket/index.ts
8. web-client/src/protocol/index.ts

## 问题清单

### 🔴 P0 — [C3/C7] 协议层并发竞态条件 - 多命令响应错位

**文件**：`web-client/src/protocol/beggar_socket/protocol-adapter.ts` — `sendPackage()`, `getResult()`

**问题**：protocol-adapter 中的 `sendPackage` 和 `getResult` 无原子性保证。当多个协议命令并行执行时，命令 A 发送→命令 B 发送→B 收到响应→A 收到 B 的响应。

**影响**：数据损坏（错误的 ID 识别导致错误的编程参数），协议状态混乱。

**修复建议**：在 ProtocolAdapter 中添加互斥锁，确保命令序列的原子性。

---

### 🟡 P1 — [C6] Payload 构建器无容量上限检查

**文件**：`web-client/src/protocol/beggar_socket/payload-builder.ts` — `ensureCapacity()`

**问题**：翻倍扩容无上限，恶意或错误输入可导致 OOM。

**修复建议**：添加 MAX_BUFFER_SIZE 限制（如 1MB）。

---

### 🟡 P1 — [C3] ROM 命令缺少地址范围验证

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts` — `rom_read()`, `rom_program()`, `rom_write()`, `rom_erase_sector()`

**问题**：未验证 baseAddress 是否超过 Flash 大小，address + size 是否溢出。

**修复建议**：在每个 ROM 操作中添加范围检查。

---

### 🟡 P1 — [C3] rom_program 未验证 data.length vs bufferSize 匹配

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts` — `rom_program()`

**问题**：调用者可传递 `bufferSize=512, data.length=256`，导致 MCU 期望字节数与实际不符，通信失步。

**修复建议**：添加 `data.length !== bufferSize` 检查。

---

### 🟡 P1 — [C2/C5] 扇区擦除轮询超时后协议状态未定义

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts` — `rom_erase_sector()`, `gbc_rom_erase_sector()`, `gbc_rom_erase_chip()`

**问题**：轮询超时时，MCU 内 Flash 擦除操作仍在进行，抛出异常后下一条命令发送时 MCU 仍在处理前一个命令。

**修复建议**：超时时发送复位命令或增加协议状态恢复机制。

---

### 🟡 P1 — [C8] readProtocolPayload 中的可选链遮盖错误

**文件**：`web-client/src/protocol/beggar_socket/packet-read.ts` — `readProtocolPayload()`

**问题**：`response.data?.byteLength ?? 0` 在 data 为 null 时正确处理，但后续 `response.data.slice(2)` 可能 NPE。

**修复建议**：统一使用安全访问模式。

---

### 🟡 P1 — [C2/C7] 长持续轮询导致 UI 无响应

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts` — `gbc_rom_erase_chip()`

**问题**：2 分钟的 busy-wait 轮询（GBC_CHIP_ERASE_TIMEOUT_MS = 120,000ms），用户无法取消操作。

**修复建议**：重构为可取消的异步操作，接受 AbortSignal 参数。

---

### 🟡 P1 — [C2] finally 块中的 write 操作无超时保护

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts` — `rom_get_id()`, `gbc_rom_get_id()`

**问题**：finally 块中 `rom_write().catch(() => {})` 可能超时导致额外 30 秒延迟，被静默忽略。

**修复建议**：为清理操作设置较短的独立超时。

---

### 🟢 P2 — [C2] 过度使用 .catch(() => {}) 静默忽略错误

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts`

**问题**：清理逻辑中空 catch 导致失败信息完全丢失，调试困难。

**修复建议**：至少添加 `console.debug` 记录。

---

### 🟢 P2 — [C3] withCrc 默认值与协议文档不一致

**文件**：`web-client/src/protocol/beggar_socket/payload-builder.ts` — `build()`

**问题**：`build(withCrc = false)` 默认不计算 CRC，但协议文档说包含 CRC。

**修复建议**：统一默认值或更新文档。

---

### 🟢 P2 — [C3] getResult 响应验证不完整

**文件**：`web-client/src/protocol/beggar_socket/protocol-adapter.ts` — `getResult()`

**问题**：只检查首字节是否为 0xaa，未检查响应长度是否正好为 1。

**修复建议**：添加长度检查 `result.data?.byteLength === 1`。

---

### ℹ️ INFO — [C6] 地址对齐假设未文档化

**文件**：`web-client/src/protocol/beggar_socket/protocol.ts`

**建议**：补充地址对齐的文档注释，说明 GBA Flash 以字为单位编址的原因。

---

### ℹ️ INFO — 建议为 transport 对象添加健康检查

**文件**：`web-client/src/protocol/beggar_socket/protocol-adapter.ts`

**建议**：在首次使用 transport 前检查连接是否仍然活跃。

---

## 未覆盖区域

1. 协议版本兼容性 — 未发现固件版本检查
2. 错误恢复策略 — 没有系统化的重试策略
3. protocol 层没有可配置的日志
