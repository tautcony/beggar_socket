## Why

`protocol/beggar_socket/protocol.ts`（324 行）中 GBA 和 GBC 的协议函数以复制粘贴方式成对实现，5 组核心函数对（`rom_get_id`/`gbc_rom_get_id`、`rom_erase_sector`/`gbc_rom_erase_sector`、`rom_write`/`gbc_write`、`rom_read`/`gbc_read`、`rom_program`/`gbc_rom_program`）结构相似度 85-90%，差异仅在地址映射（GBA `0x555/0x2aa` vs GBC `0xaaa/0x555`）和数据编码宽度（GBA 2 字节 vs GBC 1 字节）。Flash 解锁序列 `0xaa → addr1, 0x55 → addr2, cmd → addr1` 在文件中出现 6+ 次。此外 `protocol-utils.ts` 与 `protocol-adapter.ts` 存在职责重叠，传输层超时错误构造在两个传输实现中 100% 重复，设备网关 init 信号序列跨平台重复。

## What Changes

- 定义 `FlashCommandSet` 接口封装 GBA/GBC 协议差异（地址映射、数据编码宽度、底层读写函数）
- 提取 `flashUnlockSequence()`、`flashEraseSector()`、`flashProgram()` 等通用操作，基于 `FlashCommandSet` 参数化
- 统一 `protocol-utils.ts` 和 `protocol-adapter.ts` 为单一协议入口层
- 提取 `createReadTimeoutError(metrics)` 共享函数消除传输层超时错误构造重复
- 提取 `initDeviceSignals(transport)` 共享函数消除设备网关 init 信号重复

## Capabilities

### New Capabilities
- `flash-command-abstraction`: 定义协议层 FlashCommandSet 接口和通用 flash 操作抽象规范
- `transport-shared-utilities`: 定义传输层共享工具函数（超时错误构造、设备信号初始化）规范

### Modified Capabilities

## Impact

- `protocol/beggar_socket/protocol.ts` — 大幅重构，5 组函数对替换为参数化实现
- `protocol/beggar_socket/protocol-utils.ts` — 与 protocol-adapter.ts 合并
- `protocol/beggar_socket/protocol-adapter.ts` — 合并入 protocol-utils.ts 后删除
- `platform/serial/transports.ts` — 超时错误构造委托给共享函数
- `platform/serial/tauri/tauri-serial-transport.ts` — 超时错误构造委托给共享函数
- `platform/serial/tauri/device-gateway.ts` — init 信号委托给共享函数
- `platform/serial/web/device-gateway.ts` — init 信号委托给共享函数
- 上层适配器（`gba-adapter.ts`、`mbc5-adapter.ts`）的协议调用方式可能需要适配新接口
