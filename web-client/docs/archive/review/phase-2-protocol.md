# Phase 2 审查报告：protocol/beggar_socket — 协议层

> 审查时间：2026-03-16  
> 审查文件数：7  
> 发现问题数：P0(1) / P1(2) / P2(3) / INFO(2)

## 已审查文件

- `src/protocol/beggar_socket/command.ts`
- `src/protocol/beggar_socket/payload-builder.ts`
- `src/protocol/beggar_socket/protocol.ts`
- `src/protocol/beggar_socket/protocol-adapter.ts`
- `src/protocol/beggar_socket/protocol-utils.ts`
- `src/protocol/beggar_socket/packet-read.ts`
- `src/protocol/beggar_socket/index.ts`

## 问题清单

### 🔴 P0 — [C3] `PayloadBuilder.build()` 中 `cmdSize` 包含自身 2 字节，与固件解析行为不一致可能导致误判

**文件**：`src/protocol/beggar_socket/payload-builder.ts` — `build()`

**现象**：  
```typescript
build(withCrc = false): Uint8Array {
  const payloadSize = this.offset; // offset 从 2 开始（预留 size 字段），实际 payload 内容 = offset - 2
  const totalSize = 2 + payloadSize; // totalSize = 2 + offset = 4 + (payload 内容长度)
  this.buffer[0] = totalSize & 0xFF;
  this.buffer[1] = (totalSize >> 8) & 0xFF;
  // ...
}
```

固件中 `uart_cmdHandler()` 的判定条件：
```c
if (cmdBuf_p <= 2 || cmdBuf_p < uart_cmd->cmdSize) {
    return;  // 命令不完整，等待继续接收
}
```

固件将 `cmdSize`（即包的前 2 字节）与已接收字节数 `cmdBuf_p` 比较。`cmdSize` 应等于整个包的总字节数（包括 cmdSize 自身的 2 字节）。

**分析**：

以最简命令 `ERASE_CHIP`（无 payload）为例，固件注释中给出的正确包为：`05 00 f1 61 85`

- `cmdSize = 0x0005 = 5` → cmdSize(2) + cmdCode(1) + CRC(2) = 5 ✓
- `PayloadBuilder`: `addCommand(0xf1)` 后 `offset = 3`；`build(withCrc=false)` 时 `totalSize = 2 + 3 = 5`，输出长度 = `offset + 2 = 5`

但注意 `build(withCrc=false)` 时输出的最后 2 字节是 **未初始化的零字节**（不是 CRC），固件收到的 cmdSize 仍为 5，但 `cmdBuf_p` 也是 5，所以判定条件通过。固件的 CRC 校验已被注释掉，所以不检查这两个零字节。

**问题**：  
在 `build(withCrc=false)` 路径下（当前默认路径），包末尾总是附带 2 个零字节作为 CRC 占位。`cmdSize` 字段值包含这 2 个零字节。这意味着：
1. 每个命令包都比最小必要长度多 2 字节
2. 固件在解析 payload 长度时使用 `uart_cmd->cmdSize - SIZE_CMD_HEADER - ... - SIZE_CRC` 来计算数据长度，其中 `SIZE_CRC = 2`。如果客户端发送的 `cmdSize` 已包含 CRC 占位，则固件计算的数据长度正确
3. 但如果未来启用 CRC 校验（取消注释固件中的 CRC 检查），零值 CRC 占位将无法通过校验

当前功能上可以正常工作，因为固件的 CRC 校验被注释掉了。但这依赖于固件不检查 CRC 这个前提。

**影响**：  
当前可正常通信。但如果固件启用 CRC 校验，所有不使用 `withCrc=true` 的命令都会被固件拒绝。这是一个隐藏的兼容性风险。

**修复建议**：  
- 始终使用 `build(true)` 发送带有效 CRC 的包，为固件启用 CRC 做准备
- 或者在 `build(false)` 时不附加 CRC 占位字节，相应调整 `cmdSize` 计算

---

### 🟡 P1 — [C3] `rom_erase_sector()` 中客户端侧轮询擦除状态与固件侧 `rom_erase_sector_direct()` 行为差异

**文件**：`src/protocol/beggar_socket/protocol.ts` — `rom_erase_sector()` vs `rom_erase_sector_direct()`

**现象**：  
`rom_erase_sector()` 在客户端侧实现擦除逻辑：
```typescript
export async function rom_erase_sector(input, sectorAddress) {
  const sectorWordAddress = sectorAddress >>> 1;
  // 发送解锁 + 擦除命令序列（6 次 rom_write）
  await rom_write(input, toLittleEndian(0x30, 2), sectorWordAddress);
  // 客户端轮询等待擦除完成
  while (Date.now() < deadline) {
    await timeout(20);
    const status = await rom_read(input, 2, sectorAddress); // ← 用 byte address
    if (status[0] === 0xff && status[1] === 0xff) return true;
  }
}
```

`rom_erase_sector_direct()` 使用固件侧命令 `0xf3`：
```typescript
export async function rom_erase_sector_direct(input, sectorAddress) {
  const payload = createCommandPayload(GBACommand.SECTOR_ERASE).addAddress(sectorAddress).build();
  await sendPackage(input, payload);
  const ack = await getResult(input);
}
```

**问题**：  
1. `rom_erase_sector()` 传给 `rom_write` 的地址是 `sectorWordAddress`（字地址），这是正确的，因为 `rom_write` 通过 `0xf5` 命令发送，固件的 `romWrite()` 直接使用 `baseAddress` 作为字地址
2. 但 `rom_read` 传入的是 `sectorAddress`（字节地址），固件的 `romRead()` 会执行 `wordAddress = baseAddress >> 1`——所以读取位置正确
3. **真正的问题**：固件侧 `romEraseSector()` 中地址处理为 `(desc_write->baseAddress >> 1) & 0x00ff0000`——它只保留高 8 位（sector/block 级别地址），做了额外的掩码操作。而客户端侧 `rom_erase_sector()` 发送的 `sectorWordAddress = sectorAddress >>> 1` 没有做同样的掩码。两种路径的行为在非对齐的扇区地址上可能不一致

**影响**：  
两种擦除路径（客户端轮询 vs 固件命令）在地址处理上有细微差异，可能在特定芯片/地址上导致不同行为。

**修复建议**：  
确认哪种路径是主用路径并统一行为。如果是 `rom_erase_sector_direct` 作为主路径，确保客户端侧 `rom_erase_sector` 的地址处理与固件一致；或者文档化两种路径的使用场景。

---

### 🟡 P1 — [C7] `rom_get_id()` / `gbc_rom_get_id()` 多步操作中间步骤失败时不回退

**文件**：`src/protocol/beggar_socket/protocol.ts` — `rom_get_id()`, `gbc_rom_get_id()`

**现象**：  
```typescript
export async function rom_get_id(input): Promise<Uint8Array> {
  await rom_write(input, toLittleEndian(0xaa, 2), 0x555); // 步骤1
  await rom_write(input, toLittleEndian(0x55, 2), 0x2aa); // 步骤2
  await rom_write(input, toLittleEndian(0x90, 2), 0x555); // 步骤3 - 进入 ID 模式
  const idPart1 = await rom_read(input, 4, 0x00);         // 步骤4
  const idPart2 = await rom_read(input, 4, 0x1c);         // 步骤5
  await rom_write(input, toLittleEndian(0xf0, 2), 0x00); // 步骤6 - 退出 ID 模式
  return id;
}
```

**问题**：  
如果步骤 4 或 5 失败（超时），函数抛出异常，但步骤 6（退出 ID 读取模式的 `0xf0` reset 命令）永远不会执行。这意味着 Flash 芯片仍停留在 Autoselect 模式，后续的正常 ROM 读取操作将读到错误数据（ID 信息而非 ROM 数据）。

`gbc_rom_get_id()` 有同样的问题。`rom_erase_sector()` 使用了 try/catch 但同样在失败时不发送 reset 命令。

**影响**：  
ID 读取超时后，Flash 芯片处于异常模式。后续所有读取操作将失败或返回错误数据，直到下一次 DTR/RTS 复位（重新连接）。

**修复建议**：  
将退出模式命令 (`0xf0` reset) 放入 `finally` 块，确保即使中间步骤失败也尝试恢复 Flash 到正常模式：
```typescript
try {
  // 解锁 + 读 ID
} finally {
  await rom_write(input, toLittleEndian(0xf0, 2), 0x00).catch(() => {});
}
```

---

### 🟢 P2 — [C3] `readProtocolPayload` 中原始错误信息被替换

**文件**：`src/protocol/beggar_socket/packet-read.ts` — `readProtocolPayload()`

**现象**：  
```typescript
} catch (error) {
  const reason = getFailureReason(error);
  // ...
  if (reason === 'transport') {
    throw new Error(`${prefix}, Reason: packet read transport error`);
  }
}
```

**问题**：  
`getFailureReason()` 通过字符串匹配（`includes('timeout')` / `includes('expected size')`）分类错误，然后 `readProtocolPayload` 用固定字符串替换了原始错误消息。原始错误的 stack trace 和具体信息被丢弃。

**影响**：  
调试困难——当出现非超时/非长度的传输错误时，只能看到"packet read transport error"，无法知道底层具体发生了什么。

**修复建议**：  
在新 Error 中保留原始错误作为 `cause`：`throw new Error(msg, { cause: error })`。

---

### 🟢 P2 — [C3] `gbc_rom_erase_sector()` 无超时保护的轮询循环

**文件**：`src/protocol/beggar_socket/protocol.ts` — `gbc_rom_erase_sector()`

**现象**：  
```typescript
let temp: Uint8Array;
do {
  await timeout(20);
  temp = await gbc_read(input, 1, sectorAddress);
} while (temp[0] !== 0xff);
```

**问题**：  
与 GBA 版的 `rom_erase_sector()` 不同（有 60 秒超时），GBC 版的轮询没有超时限制。如果擦除因硬件问题永远不完成，此循环将无限执行。

**影响**：  
UI 永久 loading 状态，只能通过关闭页面/断开连接恢复。

**修复建议**：  
添加与 GBA 版一致的超时检查（`deadline` 模式）。

---

### 🟢 P2 — [C6] `gbc_rom_erase_chip()` 无完成检测

**文件**：`src/protocol/beggar_socket/protocol.ts` — `gbc_rom_erase_chip()`

**现象**：  
```typescript
export async function gbc_rom_erase_chip(input: ProtocolTransportInput) {
  await gbc_write(input, new Uint8Array([0xaa]), 0xaaa);
  // ... 6 步解锁 + 擦除命令
  await gbc_write(input, new Uint8Array([0x10]), 0xaaa);
  // ← 没有等待擦除完成
}
```

**问题**：  
全片擦除是一个耗时操作（可能需要数十秒），但函数在发送擦除命令后立即返回，没有轮询检查擦除是否完成。调用方如果紧接着开始编程，可能写入到尚未完成擦除的芯片。

对比 GBA 的 `rom_erase_chip()`，它使用固件命令 `0xf1`，固件内部执行 `romWaitForDone()` 等待完成后才返回 ACK。而 GBC 版通过 `gbc_write`（`0xfa` 命令）发送擦除序列，固件只是透传写入后立即 ACK，不等待擦除完成。

**影响**：  
调用方可能在芯片未擦除完成时开始编程，导致数据损坏。

**修复建议**：  
在 `gbc_rom_erase_chip()` 末尾添加轮询检查（类似 `gbc_rom_erase_sector()` 的模式），或添加适当的延时等待。

---

### ℹ️ INFO — [C3] 命令枚举值与固件 `uart.c` 完全对齐

**文件**：`src/protocol/beggar_socket/command.ts`

**说明**：  
逐一对比了 `GBACommand` 和 `GBCCommand` 枚举值与固件 `uart.c` 中的 switch/case：

| 客户端枚举 | 固件 case | 匹配 |
|-----------|-----------|------|
| GBACommand.READ_ID (0xf0) | 0xf0 | ✓ |
| GBACommand.ERASE_CHIP (0xf1) | 0xf1 | ✓ |
| GBACommand.BLOCK_ERASE (0xf2) | 0xf2 | ✓ |
| GBACommand.SECTOR_ERASE (0xf3) | 0xf3 | ✓ |
| GBACommand.PROGRAM (0xf4) | 0xf4 | ✓ |
| GBACommand.DIRECT_WRITE (0xf5) | 0xf5 | ✓ |
| GBACommand.READ (0xf6) | 0xf6 | ✓ |
| GBACommand.RAM_WRITE (0xf7) | 0xf7 | ✓ |
| GBACommand.RAM_READ (0xf8) | 0xf8 | ✓ |
| GBACommand.RAM_WRITE_TO_FLASH (0xf9) | 0xf9 | ✓ |
| GBACommand.FRAM_WRITE (0xe7) | 0xe7 | ✓ |
| GBACommand.FRAM_READ (0xe8) | 0xe8 | ✓ |
| GBCCommand.CART_POWER (0xa0) | 未在 uart.c 中找到 | ⚠️ |
| GBCCommand.CART_PHI_DIV (0xa1) | 未在 uart.c 中找到 | ⚠️ |
| GBCCommand.DIRECT_WRITE (0xfa) | 0xfa | ✓ |
| GBCCommand.READ (0xfb) | 0xfb | ✓ |
| GBCCommand.ROM_PROGRAM (0xfc) | 0xfc | ✓ |
| GBCCommand.FRAM_WRITE (0xea) | 0xea | ✓ |
| GBCCommand.FRAM_READ (0xeb) | 0xeb | ✓ |

注意：`CART_POWER (0xa0)` 和 `CART_PHI_DIV (0xa1)` 在 `uart.c` 的 switch 中没有对应 case，它们可能由其他固件模块处理，或属于不同硬件版本的命令。发送这些命令时固件会进入 `default` 分支并执行 `uart_clearRecvBuf()`——即无操作但不报错。

---

### ℹ️ INFO — [C8] `ProtocolTransportInput` 类型允许传入 `DeviceInfo` 或 `{ transport: Transport }`

**文件**：`src/protocol/beggar_socket/protocol-utils.ts`

**说明**：  
`ProtocolTransportInput` 定义为 `DeviceInfo | { transport: Transport }`，每次调用 `sendPackage` / `getPackage` 等函数时都通过 `resolveTransport(input)` 提取 transport。这意味着如果调用方传入 `DeviceInfo` 且没有 `.transport` 属性，每次调用都可能创建新的 Transport 实例（见 Phase 1 中 `compat.ts` 的 `resolveTransport` 问题）。虽然当前使用场景中 `DeviceInfo` 通常已包含 `transport`，但类型定义允许这种风险路径存在。

---

## 未覆盖区域

无
