## Why

web-client 中超过 100 个硬编码魔数和重复常量散布在适配器、协议、解析器和工具层。多个文件独立定义相同的值（如 `DEFAULT_PROGRESS` 定义 2 次、8 个时序常量在 GBA/MBC5 适配器中各定义一次、Flash 命令字节 `0xaa`/`0x55` 在协议层出现 20+ 次、ROM header 偏移量在 parser 和 editor 中散列 30+ 处）。每次修改需在多处同步，是回归风险的常见来源。

## What Changes

- 提取 `DEFAULT_PROGRESS` 常量到共享位置，消除 `useCartBurnerSessionState.ts` 和 `burner-session.ts` 中的重复定义
- 提取 8 个适配器共享时序常量（`ROM_READ_START_SETTLE_MS` 等）到 `CartridgeAdapter` 基类
- 定义 `FLASH_CMD`、`FLASH_ADDR`、`PROTOCOL_ACK` 等协议命令常量，替换 `protocol.ts` 和 `protocol-utils.ts` 中的魔数
- 定义 `GBA_HEADER_OFFSETS`、`GB_HEADER_OFFSETS` 常量对象，替换 `rom-parser.ts` 和 `rom-editor.ts` 中的硬编码偏移量
- 提取串口配置常量 `DEFAULT_SERIAL_CONFIG`，统一 Tauri 和 Web 网关的串口参数
- 修复 `types/rom-assembly.ts` 中重复的 `FileInfo` 定义，改为从 `types/file-info.ts` 导入
- 提取 `PACKET_HEADER_SIZE = 2` 常量替换 `payload-builder.ts` 中的硬编码

## Capabilities

### New Capabilities
- `shared-constants`: 定义 web-client 中跨模块共享常量的组织方式和存放位置

### Modified Capabilities

## Impact

- `services/gba-adapter.ts`, `services/mbc5-adapter.ts` — 常量引用方式变更
- `services/cartridge-adapter.ts` — 新增共享常量定义
- `protocol/beggar_socket/protocol.ts`, `protocol-utils.ts` — 魔数替换为命名常量
- `utils/parsers/rom-parser.ts`, `utils/rom/rom-editor.ts` — 偏移量替换为常量对象
- `platform/serial/tauri/device-gateway.ts`, `platform/serial/web/device-gateway.ts` — 串口配置统一
- `composables/cartburner/useCartBurnerSessionState.ts`, `features/burner/application/burner-session.ts` — DEFAULT_PROGRESS 去重
- `types/rom-assembly.ts`, `types/file-info.ts` — FileInfo 类型去重
- 纯提取重构，零行为变更，所有现有测试应继续通过
