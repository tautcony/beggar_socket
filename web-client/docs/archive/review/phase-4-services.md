# Phase 4 审查报告：services — 服务与适配器层

> 审查时间：2026-03-16  
> 审查文件数：17  
> 发现问题数：P0(1) / P1(3) / P2(5) / INFO(2)

## 已审查文件

- `src/services/cartridge-adapter.ts`
- `src/services/gba-adapter.ts`
- `src/services/mbc5-adapter.ts`
- `src/services/mock-adapter.ts`
- `src/services/device-connection-manager.ts`
- `src/services/serial-service.ts`
- `src/services/flash-chip.ts`
- `src/services/system-notice-service.ts`
- `src/services/tool-functions.ts`
- `src/services/debug-protocol-service.ts`
- `src/services/rtc/base-rtc.ts`
- `src/services/rtc/gba-rtc.ts`
- `src/services/rtc/mbc3-rtc.ts`
- `src/services/lk/romBuilder.ts`
- `src/services/lk/imageUtils.ts`
- `src/services/lk/utils.ts`
- `src/services/index.ts`

## 问题清单

### 🔴 P0 — [C7] `romBuilder.ts` 中 `addRomData()` 对 `compilation.set(rom, offset)` 无越界检查

**文件**：`src/services/lk/romBuilder.ts` — `addRomData()`

**现象**：  
```typescript
const canFit = sector_map.slice(i, i + (game.sector_count ?? 0)).every(s => s === '.');
if (canFit) {
  updateSectorMap(sector_map, i, game.sector_count ?? 0, 'r');
  const romData = romFiles.get(game.file);
  if (romData) {
    const rom = arrayBufferToUint8Array(romData);
    compilation.set(rom, i * sector_size);  // ← 可能越界
```

**问题**：  
`canFit` 检查的是 `sector_map` 中有足够的空闲扇区，但 `compilation.set(rom, offset)` 的安全性依赖于 `rom.length` 不超过 `compilation.length - offset`。如果 ROM 文件实际大小与计算的 `sector_count * sector_size` 不一致（例如 ROM 文件未对齐到扇区边界就计算了更大的 `size`），`set()` 可能写入到 compilation 缓冲区之外。

虽然 `Uint8Array.set()` 在越界时会抛出 `RangeError` 而非静默损坏，但此处没有 try/catch 保护，异常会中断整个构建流程且不提供有意义的错误消息。

此外，`prepareCompilation()` 中 `cartridgeTypes[cartridge_type]` 无边界检查——如果 `cartridge_type` 无效则直接 TypeError。

**影响**：  
ROM 构建在 ROM 文件大于预期时崩溃，错误信息不友好。无效 cartridge_type 导致不明确的 TypeError。

**修复建议**：  
在 `compilation.set()` 前添加边界校验：
```typescript
const writeOffset = i * sector_size;
if (writeOffset + rom.length > compilation.length) {
  throw new Error(`ROM "${game.file}" exceeds flash size`);
}
```
同时在 `prepareCompilation()` 入口验证 `cartridge_type` 范围。

---

### 🟡 P1 — [C7] `DeviceConnectionManager.requestDevice()` 无并发保护

**文件**：`src/services/device-connection-manager.ts` — `requestDevice()`

**现象**：  
```typescript
async requestDevice(_filter?: PortFilter): Promise<DeviceInfo> {
  // ...
  const result = await this.connectionUseCase.prepareConnection();
  // ...
}
```

**问题**：  
`DeviceConnectionManager` 是单例，但 `requestDevice()` 没有互斥保护。如果用户快速点击两次连接按钮，两次 `prepareConnection()` 可能并发执行：
1. 两次调用各自建立连接，但只有一个被跟踪
2. 另一个成为"孤儿连接"——已打开的串口永远不会被关闭

与 Phase 3 中发现的 `ConnectionOrchestrationUseCase` 并发问题叠加——两层都不做并发控制。

**影响**：  
串口泄漏和连接状态不一致。

**修复建议**：  
在 `DeviceConnectionManager` 层添加连接锁（如 `isConnecting` flag），在连接进行中时拒绝新的连接请求或排队等待。

---

### 🟡 P1 — [C2] GBA/MBC5 Adapter 中 erase 失败时进度报告不完整

**文件**：`src/services/gba-adapter.ts`、`src/services/mbc5-adapter.ts` — `eraseSectors()`

**现象**：  
在 `eraseSectors()` 中，如果擦除过程中某个扇区失败抛出异常，异常会被上层 catch 捕获并创建新的 ProgressReporter 报告错误。但在异常抛出的瞬间和被 catch 处理之间，原有的 progressReporter 仍显示最后一次成功的进度（如 "45%"），UI 可能短暂显示过期状态。

**问题**：  
`writeROM()` 流程中 erase → program → verify 如果任一步骤失败：
1. 当前操作的 progressReporter 可能停留在最后报告的状态
2. catch 块创建新的 ProgressReporter 报告最终错误
3. `currentSectorProgress[]`（扇区可视化状态）不会被重置

**影响**：  
失败后扇区可视化状态可能残留上次操作的进度。下次操作前如果不重置，UI 显示不正确。

**修复建议**：  
在 catch 块中先将原 progressReporter 更新为错误状态，然后重置 `currentSectorProgress`。

---

### 🟡 P1 — [C10] `system-notice-service.ts` 返回的外部 markdown 内容未标记需要 sanitize

**文件**：`src/services/system-notice-service.ts` — `fetchSystemNoticeMarkdown()`

**现象**：  
```typescript
export async function fetchSystemNoticeMarkdown(contentPath: string): Promise<string | null> {
  const response = await fetch(resolvePublicUrl(contentPath), { cache: 'no-store' });
  if (!response.ok) return null;
  return await response.text();  // ← 原始 markdown 直接返回
}
```

**问题**：  
从 `public/system-notifications/` 目录获取的 markdown 内容直接返回给调用方。如果该 JSON 配置文件被篡改（如 CDN 被攻破、供应链攻击），返回的 markdown 可能包含恶意 HTML/JS。是否存在 XSS 风险取决于 Vue 组件如何渲染——如果使用 `v-html` 渲染则有 XSS 风险（将在 Phase 7 验证）。

注意 `resolvePublicUrl()` 使用 `new URL(path, baseUrl)` 构造 URL，`contentPath` 来自 JSON 配置文件中的 `contentPath` 字段。如果攻击者能控制该字段，可能导致 SSRF（将 URL 指向外部服务器），但由于这是客户端 `fetch`，影响限于浏览器侧。

**影响**：  
如果配置文件被篡改且渲染组件使用 `v-html`，可能导致 XSS。

**修复建议**：  
1. 在 `fetchSystemNoticeMarkdown` 中限制 `contentPath` 只能是相对路径（不允许 `//`、`http://` 等绝对 URL）
2. 渲染端使用 DOMPurify sanitize markdown 生成的 HTML

---

### 🟢 P2 — [C6] `flash-chip.ts` 仅识别单一芯片型号

**文件**：`src/services/flash-chip.ts` — `shouldUseLargeRomPage()`

**现象**：  
```typescript
export function shouldUseLargeRomPage(chipId?: number[]): boolean {
  return arraysEqual(chipId, getFlashId('S29GL256N'));
}
```

**问题**：  
`shouldUseLargeRomPage()` 仅识别 `S29GL256N` 一个芯片型号。`SUPPORTED_FLASH_TYPES` 中定义了 8 种芯片（S29GL256、JS28F256、S29GL01、S70GL02、MX29LV640EB/ET 等），但除 S29GL256N 外的芯片是否需要 large page 未在此处体现。如果其他芯片也需要 large page（如 S29GL01、S70GL02 是更大的变体），返回 `false` 可能导致使用错误的编程参数。

**影响**：  
特定芯片型号可能使用不最佳的编程参数。

**修复建议**：  
将所有需要 large page 的芯片 ID 列入检查列表，或根据 CFI 数据中的 buffer write size 动态判断。

---

### 🟢 P2 — [C3] RTC handler 中验证循环缺少失败处理

**文件**：`src/services/rtc/gba-rtc.ts`、`src/services/rtc/mbc3-rtc.ts`

**现象**：  
GBA RTC 和 MBC3 RTC 的验证方法在执行读取验证时，如果某次 `rom_read()` / `gbc_read()` 失败，异常会直接向上传播，但不会记录哪个字段验证失败。

**问题**：  
验证是逐字段进行的（年、月、日、时、分、秒），如果中间某个字段读取失败，用户无法知道是哪个字段出了问题。

**影响**：  
调试困难——RTC 验证失败时缺少定位信息。

**修复建议**：  
在异常中包含当前正在验证的字段名称。

---

### 🟢 P2 — [C7] `romBuilder.ts` 中 `importSaveDataAndAddRom` 中存档搜索逻辑过于宽松

**文件**：`src/services/lk/romBuilder.ts` — `importSaveDataAndAddRom()`

**现象**：  
```typescript
if (!saveData) {
  for (const [fileName, data] of saveFiles.entries()) {
    if (fileName.includes(parsePath(game.file).name)) {
      saveData = data;
      break;
    }
  }
}
```

**问题**：  
存档文件的模糊匹配使用 `includes()`——如果 ROM 文件名为 "game"，则任何包含 "game" 的存档文件都会被匹配（如 "my_game_v2.sav"、"endgame.sav"）。这可能导致错误的存档被关联到 ROM。

**影响**：  
存档文件可能被错误匹配，导致错误的存档数据写入卡带。

**修复建议**：  
使用更精确的匹配策略（如精确文件名匹配，不含扩展名）。

---

### 🟢 P2 — [C8] `DeviceConnectionManager.toDeviceInfo()` 使用 `as DeviceHandle` 不安全断言

**文件**：`src/services/device-connection-manager.ts` — `toDeviceInfo()`

**现象**：  
```typescript
private toDeviceInfo(handle: BurnerConnectionHandle): DeviceInfo {
  return toLegacyDeviceInfo(handle.context as DeviceHandle);
}
```

**问题**：  
与 Phase 3 中发现的 `unwrapHandle` 相同模式——`handle.context` 是 `unknown` 类型，通过 `as DeviceHandle` 强转。在 `DeviceConnectionManager` 这里又出现了同样的不安全转换。

**影响**：  
类型安全层面的系统性问题，但在当前单一实现下不会触发运行时错误。

**修复建议**：  
参见 Phase 3 建议——使用 branded type 或运行时校验。

---

### 🟢 P2 — [C6] `romBuilder.ts` 中大量魔法数字

**文件**：`src/services/lk/romBuilder.ts`

**现象**：  
代码中存在大量未命名的常量：
- `0x40000`（对齐大小）、`0x1000`（状态区域大小）、`0x30`（标题长度）
- `0xFF`（擦除值）、`0x400000`（4MB 边界）、`0x80000`
- `0x20`（时间戳区域大小）、`0x10`（对齐单位）

**问题**：  
这些重复出现的常量含义隐式，需要读者具备 GBA ROM 格式的背景知识才能理解。

**影响**：  
代码可维护性降低，修改时容易遗漏关联位置。

**修复建议**：  
将常量提取为命名常量（如 `SECTOR_SIZE`, `MIN_ROM_SIZE`, `ERASED_BYTE`）。

---

### ℹ️ INFO — [C4] `serial-service.ts` 为 legacy facade，仍被引用

**文件**：`src/services/serial-service.ts`

**说明**：  
`serial-service.ts` 作为兼容 facade 存在，其功能已被 `DeviceConnectionManager` 和 `ConnectionOrchestrationUseCase` 替代。但仍通过 `services/index.ts` 导出。在向新架构过渡期间保留是合理的，但应有计划逐步移除。

---

### ℹ️ INFO — [C3] RTC BCD 格式与固件对齐

**文件**：`src/services/rtc/gba-rtc.ts`、`src/services/rtc/mbc3-rtc.ts`

**说明**：  
GBA RTC 使用 S3511 芯片的 BCD 格式，MBC3 RTC 使用 MBC3 RTC 格式。两者的位掩码（如月份 `& 0x1f`、日 `& 0x3f`）符合对应芯片规格。BCD 编解码逻辑（`Math.floor(val / 10) * 16 + val % 10`）正确。建议在代码中添加芯片规格引用以便维护。

---

## 未覆盖区域

无
