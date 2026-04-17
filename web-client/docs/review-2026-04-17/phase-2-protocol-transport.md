# Phase 2 审查报告: 协议与传输层重复

> 日期: 2026-04-17
> 文件数: 10
> 发现: P0(0) / P1(3) / P2(4) / INFO(1)

## 已审查文件

- `protocol/beggar_socket/protocol.ts` (324 行)
- `protocol/beggar_socket/protocol-utils.ts` (167 行)
- `protocol/beggar_socket/protocol-adapter.ts` (42 行)
- `protocol/beggar_socket/packet-read.ts` (130 行)
- `protocol/beggar_socket/payload-builder.ts` (143 行)
- `platform/serial/transports.ts` (365 行)
- `platform/serial/tauri/tauri-serial-transport.ts` (171 行)
- `platform/serial/tauri/device-gateway.ts` (251 行)
- `platform/serial/web/device-gateway.ts` (61 行)
- `platform/serial/compat.ts` (42 行)

## Findings

### [P1-01] GBA/GBC 协议函数结构性复制

- 位置: `protocol/beggar_socket/protocol.ts` 全文件
- 触发条件: 多组 GBA/GBC 函数对承载相同的 flash 操作序列，仅在地址映射和数据编码上有差异

| 函数对 | GBA 行号 | GBC 行号 | 结构相似度 |
|--------|----------|----------|-----------|
| `rom_get_id` / `gbc_rom_get_id` | 21-39 | 242-251 | 85% |
| `rom_erase_sector` / `gbc_rom_erase_sector` | 65-97 | 311-342 | 88% |
| `rom_write` / `gbc_write` | 99-107 | 220-228 | 90% |
| `rom_read` / `gbc_read` | 109-115 | 230-236 | 90% |
| `rom_program` / `gbc_rom_program` | 53-63 | 281-291 | 85% |

- 差异本质:
  - 地址: GBA 使用 `0x555`/`0x2aa`，GBC 使用 `0xaaa`/`0x555`
  - 数据编码: GBA 使用 `toLittleEndian(0xaa, 2)` (2 字节)，GBC 使用 `new Uint8Array([0xaa])` (1 字节)
  - 读写函数: `rom_write`/`rom_read` vs `gbc_write`/`gbc_read`
- 影响: flash 解锁序列 (`0xaa → addr1, 0x55 → addr2, cmd → addr1`) 在文件中出现 6+ 次，修改解锁逻辑需逐一同步
- 修复方向:
  - 定义 `FlashCommandSet` 接口封装地址映射和编码方式
  - 提取 `flashUnlockSequence(cmdSet, input)` 等通用操作
  - 各协议函数调用通用操作

### [P1-02] 传输层超时错误消息构造 100% 重复

- 位置: `platform/serial/transports.ts` L280-295, `platform/serial/tauri/tauri-serial-transport.ts` L66-71
- 触发条件: 两个传输实现构造完全相同格式的超时错误消息字符串（含 readId、expected、received、sessionRx、totalRx、totalTx、elapsed 等字段）
- 影响: 修改错误诊断信息格式需同步两处
- 修复方向: 提取 `createReadTimeoutError(metrics)` 到 `platform/serial/` 共享工具函数

### [P1-03] 设备网关 init 信号序列跨平台重复

- 位置: `platform/serial/tauri/device-gateway.ts` L204-218, `platform/serial/web/device-gateway.ts` L48-52
- 触发条件: DTR/RTS 信号翻转序列和延时在两个 DeviceGateway 实现中手动复制
- 影响: 修改设备初始化信号时序需同步两处
- 修复方向: 提取 `initDeviceSignals(transport)` 到共享层

### [P2-01] protocol-utils.ts 与 protocol-adapter.ts 职责重叠

- 位置: `protocol/beggar_socket/protocol-utils.ts` L34-64, `protocol/beggar_socket/protocol-adapter.ts` L1-42
- 触发条件: `sendPackage()`, `getPackage()`, `sendAndReceivePackage()`, `setSignals()` 在两个文件中都存在，且都调用 `resolveTransport()` → `ProtocolAdapter.*()` 的相同模式
- 影响: 存在两套入口函数，调用方可能混用
- 修复方向: 统一为一个入口层

### [P2-02] Flash 命令魔数未提取为命名常量

- 位置: `protocol/beggar_socket/protocol.ts` 全文件
- 触发条件: Flash 解锁命令字节 (`0xaa`, `0x55`, `0x90`, `0xf0`, `0x80`, `0x30`, `0x10`, `0xa0`) 和地址 (`0x555`, `0x2aa`, `0xaaa`) 散布在 20+ 处
- 影响: 可读性差，flash 命令语义不直观
- 修复方向: 定义 `FLASH_CMD` 枚举或常量对象

### [P2-03] 串口配置参数跨平台散列

- 位置: `platform/serial/tauri/device-gateway.ts` L135-141, `platform/serial/web/device-gateway.ts` L38-43
- 触发条件: baudRate、dataBits、parity、flowControl、stopBits、bufferSize 在两个网关中独立硬编码
- 影响: 修改串口参数需同步两处

```typescript
// Tauri
{ dataBits: DataBits.Eight, parity: Parity.None, flowControl: FlowControl.None,
  stopBits: StopBits.One, baudRate: 9600, timeout: 1000, size: 4096 }

// Web
{ baudRate: 9600, dataBits: 8, bufferSize: 4096, parity: 'none', stopBits: 1,
  flowControl: 'none' }
```

- 修复方向: 提取到共享配置常量，各平台从常量转换为平台特定格式

### [P2-04] ACK 魔字节 `0xaa` 散布

- 位置: `protocol-utils.ts` L62, `protocol-adapter.ts` L41, `packet-read.ts` 隐式使用
- 触发条件: 协议 ACK 字节 `0xaa` 在多个文件中硬编码
- 影响: 如果协议 ACK 约定变更，需搜索全部使用点
- 修复方向: 定义 `PROTOCOL_ACK = 0xaa` 常量

### [INFO-01] payload-builder.ts 的 header offset `2` 硬编码

- 位置: `protocol/beggar_socket/payload-builder.ts` 构造函数、reset、build 中 4 处出现 `offset = 2`
- 触发条件: 协议包头大小为 2 字节，分散在多个位置
- 影响: 可读性可改善
- 修复方向: 定义 `PACKET_HEADER_SIZE = 2` 常量

## 漏检复盘

- 已主动复查的高风险模式:
  - 默认分支 / 未知输入: 协议层 command enum 有完整覆盖 ✓
  - 异步失败 / 前提失效: 超时处理已覆盖（但重复实现）
  - 半完成状态 / 重建窗口: 协议层无持久化，不涉及
  - 渲染 / 导出 / 编码: 不涉及
  - 命名一致性: `rom_get_id` vs `gbc_rom_get_id` 前缀顺序不一致（GBA 函数缺少平台前缀），但这是历史约定，未单独计为 finding
- 本 phase 仍然证据不足的点:
  - `packet-read.ts` 中 `executeProtocolPayloadRead()` (75 行) 内部有 4 个相似的错误抛出块，可能值得提取但需确认语义差异

## 未覆盖区域

- `protocol/beggar_socket/command.ts` — 无重复问题
- `platform/serial/mutex.ts` — 35 行，简洁无重复
- `platform/serial/factory.ts` — 18 行，简洁无重复
