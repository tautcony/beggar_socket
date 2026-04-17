## ADDED Requirements

### Requirement: Protocol constants module
`protocol/beggar_socket/constants.ts` SHALL export命名常量覆盖所有 flash 命令字节（`FLASH_CMD_UNLOCK_1`, `FLASH_CMD_UNLOCK_2` 等）、flash 地址（`GBA_FLASH_ADDR_1`, `GBA_FLASH_ADDR_2`, `GBC_FLASH_ADDR_1`, `GBC_FLASH_ADDR_2`）和协议 ACK 字节（`PROTOCOL_ACK`）。

#### Scenario: Flash command constants replace magic numbers in protocol.ts
- **WHEN** `protocol.ts` 中的 flash 操作函数执行解锁序列
- **THEN** 所有命令字节和地址 SHALL 引用 `constants.ts` 中的命名常量，不再使用字面量 `0xaa`、`0x55`、`0x555`、`0x2aa`、`0xaaa` 等

#### Scenario: PROTOCOL_ACK replaces magic byte
- **WHEN** `protocol-utils.ts` 或 `protocol-adapter.ts` 检查协议应答
- **THEN** SHALL 使用 `PROTOCOL_ACK` 常量而非字面量 `0xaa`

### Requirement: Parser offset constants
`utils/parsers/constants.ts` SHALL export `GBA_HEADER` 和 `GB_HEADER` 常量对象，包含所有 ROM header 字段偏移量。

#### Scenario: ROM parser uses named offsets
- **WHEN** `rom-parser.ts` 中 `parseGBARom()` 或 `parseGBRom()` 访问 ROM header 字段
- **THEN** SHALL 通过 `GBA_HEADER.TITLE_OFFSET`、`GB_HEADER.TITLE_OFFSET` 等常量引用偏移量

#### Scenario: ROM editor uses same offset constants
- **WHEN** `rom-editor.ts` 中 `updateGBARom()` 或 `updateGBRom()` 写入 ROM header 字段
- **THEN** SHALL 使用与 parser 相同的偏移量常量

### Requirement: Adapter shared timing constants
`CartridgeAdapter` 基类 SHALL 定义所有子类共享的时序常量（`ROM_READ_START_SETTLE_MS`、`ROM_READ_RETRY_RESET_MS` 等）。

#### Scenario: GBAAdapter and MBC5Adapter use base class constants
- **WHEN** `GBAAdapter` 或 `MBC5Adapter` 需要引用时序参数
- **THEN** SHALL 通过基类定义的常量引用，不再在各自文件中重复定义

### Requirement: Serial configuration constants
`platform/serial/constants.ts` SHALL export `DEFAULT_SERIAL_CONFIG` 对象，包含 baudRate、dataBits、parity、flowControl、stopBits、bufferSize 的默认值。

#### Scenario: Both gateways use shared config
- **WHEN** `TauriDeviceGateway` 或 `WebDeviceGateway` 打开串口
- **THEN** SHALL 从 `DEFAULT_SERIAL_CONFIG` 导出并转换为平台特定格式

### Requirement: DEFAULT_PROGRESS single source of truth
`DEFAULT_PROGRESS` 常量 SHALL 在项目中仅有一处定义。

#### Scenario: No duplicate DEFAULT_PROGRESS definitions
- **WHEN** 全项目搜索 `DEFAULT_PROGRESS` 的赋值
- **THEN** SHALL 仅在一个文件中找到定义，其他文件 SHALL 通过 import 引用

### Requirement: FileInfo type single definition
`FileInfo` 接口 SHALL 仅在 `types/file-info.ts` 中定义。

#### Scenario: rom-assembly.ts imports FileInfo
- **WHEN** `types/rom-assembly.ts` 需要 `FileInfo` 类型
- **THEN** SHALL 从 `types/file-info.ts` 导入而非重复定义
