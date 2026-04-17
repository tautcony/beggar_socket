## 1. 定义 FlashCommandSet 接口

- [x] 1.1 创建 `flash-command-set.ts`，定义 `FlashCommandSet` 接口 + 通用函数
- [x] 1.2 实现 `GBA_ROM_FLASH_CMD_SET`、`GBC_FLASH_CMD_SET`、`GBA_RAM_FLASH_CMD_SET` 常量

## 2. 提取通用 Flash 操作函数

- [x] 2.1 实现 `flashUnlockSequence` — 3-write 解锁序列
- [x] 2.2 实现 `flashEraseCommand` — 6-write 擦除命令序列
- [x] 2.3 实现 `flashPollUntilReady` — 擦除轮询
- [x] 2.4 实现 `flashEraseSector` — 便捷组合：flashEraseCommand + flashPollUntilReady
- [x] 2.5 实现 `flashGetId` — unlock + autoselect + read + reset
- [x] 2.6 提取 `flashProgramRom` 内部辅助函数统一 rom_program/gbc_rom_program
- [x] 2.7 重构 8 个复合 flash 函数委托给通用实现

## 3. 合并 protocol 入口层

- [x] 3.1 将 `ProtocolAdapter` 类合并入 `protocol-utils.ts`
- [x] 3.2 内联 ProtocolAdapter 逻辑到 utility 函数
- [x] 3.3 更新 `index.ts` 导出源
- [x] 3.4 删除 `protocol-adapter.ts`

## 4. 提取传输层共享工具

- [x] 4.1 创建 `platform/serial/transport-errors.ts`，实现 `createReadTimeoutError(metrics)`
- [x] 4.2 更新 `transports.ts` 使用 `createReadTimeoutError`
- [x] 4.3 更新 `tauri-serial-transport.ts` 使用 `createReadTimeoutError`

## 5. 提取设备网关信号初始化

- [x] 5.1 创建 `platform/serial/device-signals.ts`，实现 `initDeviceSignals(transport)`
- [x] 5.2 更新 `web/device-gateway.ts` 使用 `initDeviceSignals()`
- [x] 5.3 更新 `tauri/device-gateway.ts` 使用 `initDeviceSignals()` (保留 try/catch/rollback)

## 6. 最终验证

- [x] 6.1 `npm run type-check` — passed
- [x] 6.2 `npm run lint` — passed
- [x] 6.3 `npm run test:run` — 383 tests passed
- [x] 6.4 `npm run build` — passed
