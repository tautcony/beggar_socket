## 1. 协议层常量提取

- [x] 1.1 创建 `protocol/beggar_socket/constants.ts`，定义 `FLASH_CMD_*`、`GBA_FLASH_ADDR_*`、`GBC_FLASH_ADDR_*`、`PROTOCOL_ACK` 常量
- [x] 1.2 在 `protocol.ts` 中替换所有 flash 命令字面量为命名常量引用
- [x] 1.3 在 `protocol-utils.ts` 和 `protocol-adapter.ts` 中替换 `0xaa` 为 `PROTOCOL_ACK`
- [x] 1.4 在 `payload-builder.ts` 顶部定义 `PACKET_HEADER_SIZE = 2` 并替换文件内 4 处硬编码

## 2. 解析器偏移量常量提取

- [x] 2.1 创建 `utils/parsers/constants.ts`，定义 `GBA_HEADER` 和 `GB_HEADER` 偏移量常量对象
- [x] 2.2 在 `rom-parser.ts` 中替换 `parseGBARom()` 和 `parseGBRom()` 中的硬编码偏移量
- [x] 2.3 在 `rom-editor.ts` 中替换 `updateGBARom()` 和 `updateGBRom()` 中的硬编码偏移量

## 3. 适配器时序常量提取

- [x] 3.1 在 `CartridgeAdapter` 基类中定义 8 个共享时序常量（`ROM_READ_START_SETTLE_MS` 等）
- [x] 3.2 在 `gba-adapter.ts` 中删除重复定义，改为引用基类常量
- [x] 3.3 在 `mbc5-adapter.ts` 中删除重复定义，改为引用基类常量

## 4. 串口与进度常量提取

- [x] 4.1 创建 `platform/serial/constants.ts`，定义 `DEFAULT_SERIAL_CONFIG` 常量
- [x] 4.2 修改 `TauriDeviceGateway` 使用共享串口配置
- [x] 4.3 修改 `WebDeviceGateway` 使用共享串口配置
- [x] 4.4 将 `DEFAULT_PROGRESS` 提取到 `types/progress-info.ts`，删除 `useCartBurnerSessionState.ts` 和 `burner-session.ts` 中的重复定义

## 5. 类型去重与验证

- [x] 5.1 修改 `types/rom-assembly.ts`，删除重复的 `FileInfo` 定义，改为从 `types/file-info.ts` 导入
- [x] 5.2 运行 `npm run type-check` 确认无类型错误
- [x] 5.3 运行 `npm run test:run` 确认所有测试通过
- [x] 5.4 运行 `npm run build` 确认构建成功
