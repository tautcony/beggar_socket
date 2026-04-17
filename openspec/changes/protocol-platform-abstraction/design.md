## Context

协议层 `protocol.ts` 是设备通信的核心，当前 GBA 和 GBC 的 flash 操作通过独立函数对实现。代码审查 (review-2026-04-17 Phase 2 P1-01) 发现 5 组函数对结构相似度 85-90%，flash 解锁序列在文件中重复 6+ 次。Phase 2 还发现传输层超时错误构造 100% 重复 (P1-02)、设备网关 init 信号跨平台重复 (P1-03)、protocol-utils.ts 与 protocol-adapter.ts 职责重叠 (P2-01)。

本变更是解决 GBA/GBC 四层镜像复制的第一步（协议层），为后续 `adapter-template-method`（适配器层）奠定基础。适配器层重构依赖本变更提供的 `FlashCommandSet` 接口。

## Goals / Non-Goals

**Goals:**
- 定义 `FlashCommandSet` 接口封装 GBA 和 GBC 的协议差异
- 提取通用 flash 操作函数，消除协议层约 200 行重复
- 统一 protocol-utils.ts 和 protocol-adapter.ts 为单一入口
- 提取传输层共享工具函数（超时错误、设备信号）
- 保持对上层适配器的调用兼容性（可提供过渡 API）

**Non-Goals:**
- 不重构适配器层（由 `adapter-template-method` 变更负责）
- 不改变协议的字节级行为
- 不优化传输性能
- 不改变设备初始化的时序参数值
- 不移除已有的公开函数签名（可在过渡期保留为委托包装）

## Decisions

### D1: FlashCommandSet 接口设计

```typescript
interface FlashCommandSet {
  /** Flash 解锁地址 1 (GBA: 0x555, GBC: 0xaaa) */
  unlockAddr1: number;
  /** Flash 解锁地址 2 (GBA: 0x2aa, GBC: 0x555) */
  unlockAddr2: number;
  /** 数据编码宽度 (GBA: 2, GBC: 1) */
  dataWidth: 1 | 2;
  /** 编码单个字节为平台格式 */
  encodeByte(value: number): Uint8Array;
  /** 底层写操作 */
  write(device: Device, address: number, data: Uint8Array): Promise<void>;
  /** 底层读操作 */
  read(device: Device, address: number, length: number): Promise<Uint8Array>;
}
```

提供 `GBA_COMMAND_SET` 和 `GBC_COMMAND_SET` 两个预定义实现。

### D2: 通用 flash 操作提取

```typescript
// 通用解锁序列
async function flashUnlockSequence(device: Device, cmdSet: FlashCommandSet, command: number): Promise<void>

// 通用 sector 擦除
async function flashEraseSector(device: Device, cmdSet: FlashCommandSet, sectorAddr: number): Promise<void>

// 通用编程
async function flashProgram(device: Device, cmdSet: FlashCommandSet, address: number, data: Uint8Array): Promise<void>

// 通用 ID 读取
async function flashGetId(device: Device, cmdSet: FlashCommandSet): Promise<Uint8Array>
```

原有的 `rom_erase_sector()`、`gbc_rom_erase_sector()` 等保留为委托包装，标记 `@deprecated`。

### D3: protocol-utils.ts 与 protocol-adapter.ts 合并

保留 `protocol-utils.ts` 作为统一入口，将 `protocol-adapter.ts` 的 `ProtocolAdapter` 类功能合并入 `protocol-utils.ts`。删除 `protocol-adapter.ts`，更新所有 import 引用。

### D4: 传输层共享工具

```typescript
// platform/serial/transport-errors.ts
function createReadTimeoutError(metrics: TimeoutMetrics): Error

// platform/serial/device-signals.ts
async function initDeviceSignals(transport: SerialTransport): Promise<void>
```

## Risks / Trade-offs

- [风险] 协议层是设备通信核心，重构可能引入字节级错误 → 依赖现有协议测试 + 真机验证
- [风险] 保留旧函数为 deprecated 包装增加过渡期代码量 → 在 adapter-template-method 完成后可清理
- [取舍] `FlashCommandSet` 使用接口而非枚举，更灵活但增加了抽象层 → 考虑到后续适配器层需要同样的接口，额外抽象是值得的
- [取舍] protocol-adapter.ts 删除而非保留 → 当前仅 42 行，合并更简洁
