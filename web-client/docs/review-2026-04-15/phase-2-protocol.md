# Phase 2 审查报告: 协议层

> 日期: 2026-04-15
> 文件数: 7
> 发现: P0(0) / P1(2) / P2(2) / INFO(1)

## 已审查文件

- `protocol/beggar_socket/packet-read.ts` (重构)
- `protocol/beggar_socket/protocol-adapter.ts`
- `protocol/beggar_socket/protocol.ts`
- `protocol/beggar_socket/protocol-utils.ts`
- `protocol/beggar_socket/command.ts`
- `protocol/beggar_socket/payload-builder.ts`
- `protocol/beggar_socket/index.ts`

## Findings

### [P1] 协议函数未使用原子 sendAndReceive

- **位置**: `protocol/beggar_socket/protocol.ts` 全部协议函数
- **触发条件**: 协议层所有 `sendPackage()` + `getResult()` / `readProtocolPayload()` 对都是分开调用的（L49/50, L88/89, L107/108 等共 17 处）
- **影响**: 虽然 `sendAndReceive()` 已在 `ProtocolAdapter` 和 Transport 中实现了 mutex 保护，但实际协议函数从未调用它。如果两个协议操作被并发触发（当前由上层 adapter 的串行循环防止，但未来重构可能突破），sendPackage A → sendPackage B → getResult(A 的响应被 B 读取) 会导致响应错位。
- **当前缓解**: 上层 adapter 操作是串行的（`for` 循环内 `await`），所以当前不会触发。但这是架构脆弱性。
- **修复方向**: 将 `protocol.ts` 中的 send+read 对替换为 `sendAndReceive()` 调用，或在 `readProtocolPayload` 内部加入 mutex

### [P1] packet-read.ts 错误分类依赖字符串匹配

- **位置**: `protocol/beggar_socket/packet-read.ts` `getFailureReason()` (L7-12)
- **触发条件**: 底层错误消息格式变化（如 Tauri 插件更新后改变了超时消息文本）
- **影响**: 错误分类错误 → 上层收到错误的错误类型 → 用户看到误导性的错误信息或重试策略不正确
- **修复方向**: 使用 Error 子类或 error.code 属性代替字符串匹配：
  ```typescript
  class TimeoutError extends Error { readonly code = 'TIMEOUT'; }
  class PacketLengthError extends Error { readonly code = 'LENGTH'; }
  ```

### [P2] CRC 默认关闭

- **位置**: `protocol/beggar_socket/payload-builder.ts` `build(withCrc = false)`
- **触发条件**: 所有协议调用
- **影响**: 所有协议消息都不带 CRC 校验。固件注释说"CRC ignored by firmware"，但这意味着传输层数据损坏完全无法被检测。虽然 USB 传输本身有 CRC，但通过 USB CDC 的虚拟串口层可能引入软件侧错误
- **修复方向**: 如果固件确实忽略 CRC，可保持现状但添加文档注释说明原因

### [P2] fromLittleEndian 对超过 32 位的输入行为未定义

- **位置**: `protocol/beggar_socket/protocol-utils.ts` `fromLittleEndian()` (L18-23)
- **触发条件**: 传入超过 4 字节的 Uint8Array
- **影响**: JavaScript 位运算限制在 32 位有符号整数，超过 4 字节时结果不正确。当前使用场景均为 2-4 字节地址，但函数签名无限制
- **修复方向**: 添加参数长度检查或使用 BigInt

### [INFO] readProtocolPayload 现在有良好的错误上下文

- **位置**: `protocol/beggar_socket/packet-read.ts` (重构后)
- **影响**: 正面变化 — 错误消息现在包含 commandName、地址、失败原因和详细信息。比上次审查有显著改进

## 漏检复盘

- **默认分支 / 未知输入**: 已检查 — 命令枚举 (GBACommand, GBCCommand) 类型安全，payload-builder 限制了可用操作
- **异步失败 / 前提失效**: 发现 P1-01 非原子 send+read 的架构脆弱性
- **半完成状态 / 重建窗口**: 协议层是无状态的（每次调用独立），不存在半完成风险
- **渲染 / 导出 / 编码**: 字节序处理正确（little-endian），P2-02 指出了位运算边界
- 本 phase 仍然证据不足的点: Tauri serial plugin 的 `readBinary` 返回值是否始终为 Uint8Array 需实际测试

## 未覆盖区域

- 无
