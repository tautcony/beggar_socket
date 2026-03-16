# Phase 4 审查报告：服务层 (services)

> 审查时间：2026-03-16
> 审查文件数：21
> 发现问题数：P0(4) / P1(10) / P2(3) / INFO(2)

## 已审查文件

1. web-client/src/services/cartridge-adapter.ts
2. web-client/src/services/gba-adapter.ts
3. web-client/src/services/mbc5-adapter.ts
4. web-client/src/services/mock-adapter.ts
5. web-client/src/services/serial-service.ts
6. web-client/src/services/device-connection-manager.ts
7. web-client/src/services/debug-protocol-service.ts
8. web-client/src/services/flash-chip.ts
9. web-client/src/services/tool-functions.ts
10. web-client/src/services/system-notice-service.ts
11. web-client/src/services/index.ts
12. web-client/src/services/rtc/base-rtc.ts
13. web-client/src/services/rtc/gba-rtc.ts
14. web-client/src/services/rtc/mbc3-rtc.ts
15. web-client/src/services/rtc/index.ts
16. web-client/src/services/lk/romBuilder.ts
17. web-client/src/services/lk/imageUtils.ts
18. web-client/src/services/lk/utils.ts
19. web-client/src/services/lk/types.ts
20. web-client/src/services/lk/cli.ts
21. web-client/src/services/lk/index.ts

## 问题清单

### 🔴 P0 — [C2] 无超时控制的无限轮询 — GBA 全片擦除

**文件**：`web-client/src/services/gba-adapter.ts` — `eraseChip()`

**问题**：`while (true)` 循环轮询 `isBlank()` 无最大超时保护。若 Flash 永远无法返回全 0xFF，应用将无限期等待。

**修复建议**：添加基于 CFI 数据的超时上限。

---

### 🔴 P0 — [C2] 无超时控制的无限轮询 — MBC5 全片擦除

**文件**：`web-client/src/services/mbc5-adapter.ts` — `eraseChip()`

**问题**：同上。

---

### 🔴 P0 — [C8] 类型不安全的断言 — DeviceConnectionManager

**文件**：`web-client/src/services/device-connection-manager.ts` — `toDeviceInfo()`

**问题**：`handle.context as DeviceHandle` 无运行时验证。

**修复建议**：添加运行时类型守卫。

---

### 🔴 P0 — [C1] 资源泄漏 — SerialService openPort()

**文件**：`web-client/src/services/serial-service.ts` — `openPort()`

**问题**：若 `toLegacyDeviceInfo()` 抛出异常，已打开的连接不会被清理。连接 ID 重复时会覆盖。

**修复建议**：使用 try/catch 包裹并在异常时关闭连接。

---

### 🟡 P1 — [C5] GBA 扇区状态异常恢复缺失

**文件**：`web-client/src/services/gba-adapter.ts` — `eraseSectors()` catch 块

**问题**：GBA 的 catch 块未调用 `resetSectorsState()`，而 MBC5 版本有此调用。

**修复建议**：在 catch 块中添加状态重置。

---

### 🟡 P1 — [C1] DeviceConnectionManager 并发连接

**文件**：`web-client/src/services/device-connection-manager.ts` — `requestDevice()`

**问题**：`isConnecting` 标志防重入，但调试模式绕过了此检查。

---

### 🟡 P1 — [C7] LK romBuilder SHA1 计算可能失败

**文件**：`web-client/src/services/lk/romBuilder.ts` — `addRomData()`

**问题**：在非安全上下文（非 HTTPS）中 `crypto.subtle` 不可用，`sha1()` 会抛出未捕获异常。

**修复建议**：添加 try/catch。

---

### 🟡 P1 — [C4] MBC5 writeROM 异常处理与 5V 电源状态

**文件**：`web-client/src/services/mbc5-adapter.ts` — `writeROM()`

**问题**：异常时 `withOptional5v()` 内的 `finally` 和外层 catch 可能双重处理。

---

### 🟡 P1 — [C1] RTC GPIO 状态清理失败

**文件**：`web-client/src/services/rtc/gba-rtc.ts` — `setTime()`

**问题**：`cleanupGPIO()` 两次都失败时 GPIO 保持启用状态。

---

### 🟡 P1 — [C3] MBC3 日期边界校验缺失

**文件**：`web-client/src/services/rtc/mbc3-rtc.ts` — `setTime()`

**问题**：未检查 MBC3 9-bit 天数寄存器限制 (0-511)。

---

### 🟡 P1 — [C4] 生产代码中的大量 console.log

**文件**：`web-client/src/services/tool-functions.ts`、RTC 文件

**问题**：调试 console.log 输出在生产环境中未被禁用，泄露内部状态信息。

---

### 🟡 P1 — [C8] Flash ID 比较 — chipId 可能为 undefined

**文件**：`web-client/src/services/flash-chip.ts` — `shouldUseLargeRomPage()`

**问题**：`chipId` 为 undefined 时 `arraysEqual` 行为不可预测。

---

### 🟡 P1 — [C3] LK romBuilder ROM 尺寸计算正则

**文件**：`web-client/src/services/lk/romBuilder.ts` — `writeCompilation()`

**问题**：正则 `replace(/\.+$/, '')` 只删除末尾 `.`，中间有间隙时计算不准确。

---

### 🟡 P1 — [C2] 未处理的 Promise rejection — DeviceConnectionManager

**文件**：`web-client/src/services/device-connection-manager.ts` — `connectWithSelectedPort()`

**问题**：catch 块中 console.error + 重新 throw，异常被双重处理。

---

### 🟢 P2 — [C6] tool-functions 函数过长

**建议**：将 PPB 系列函数抽取为独立操作步骤。

---

### 🟢 P2 — [C11] LK imageUtils 大对象引用

**文件**：`web-client/src/services/lk/imageUtils.ts` — `convertToIndexedImage()`

**问题**：临时数组在函数返回后仍存活，可能导致内存压力。

---

### 🟢 P2 — [C3] LK romBuilder 时间戳截断风险

**文件**：`web-client/src/services/lk/romBuilder.ts` — `readMenuRom()`

**问题**：ISO 时间字符串长度超过 0x20 字节时被截断。

---

### ℹ️ INFO — [C10] DeviceConnectionManager 调试模式信息泄露

建议使用条件日志替代直接 console.log。

---

### ℹ️ INFO — LK imageUtils 内存优化空间

建议处理大图像时释放临时数组引用。

---

## 未覆盖区域

- system-notice-service.ts 的 XSS 防护需结合 markdown.ts 一并分析
