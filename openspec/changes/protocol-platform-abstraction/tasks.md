## 1. 定义 FlashCommandSet 接口

- [ ] 1.1 在 `protocol/beggar_socket/` 下创建 `flash-command-set.ts`，定义 `FlashCommandSet` 接口
- [ ] 1.2 实现 `GBA_COMMAND_SET` 常量（unlockAddr1=0x555, unlockAddr2=0x2aa, dataWidth=2）
- [ ] 1.3 实现 `GBC_COMMAND_SET` 常量（unlockAddr1=0xaaa, unlockAddr2=0x555, dataWidth=1）

## 2. 提取通用 Flash 操作函数

- [ ] 2.1 实现 `flashUnlockSequence(device, cmdSet, command)` — 通用解锁序列
- [ ] 2.2 实现 `flashEraseSector(device, cmdSet, sectorAddr)` — 通用 sector 擦除
- [ ] 2.3 实现 `flashProgram(device, cmdSet, address, data)` — 通用编程
- [ ] 2.4 实现 `flashGetId(device, cmdSet)` — 通用 ID 读取
- [ ] 2.5 将原有 `rom_*` 和 `gbc_*` 函数改为委托给通用实现的 deprecated 包装
- [ ] 2.6 验证: `npm run test:run -- protocol`

## 3. 合并 protocol 入口层

- [ ] 3.1 将 `protocol-adapter.ts` 的功能合并入 `protocol-utils.ts`
- [ ] 3.2 更新所有从 `protocol-adapter.ts` 的 import 引用指向 `protocol-utils.ts`
- [ ] 3.3 删除 `protocol-adapter.ts`
- [ ] 3.4 验证: `npm run type-check`

## 4. 提取传输层共享工具

- [ ] 4.1 创建 `platform/serial/transport-errors.ts`，实现 `createReadTimeoutError(metrics)`
- [ ] 4.2 更新 `transports.ts` 中的超时错误构造为 `createReadTimeoutError()` 调用
- [ ] 4.3 更新 `tauri-serial-transport.ts` 中的超时错误构造为 `createReadTimeoutError()` 调用
- [ ] 4.4 验证: `npm run test:run -- tauri-serial-transport serial-service`

## 5. 提取设备网关信号初始化

- [ ] 5.1 创建 `platform/serial/device-signals.ts`，实现 `initDeviceSignals(transport)`
- [ ] 5.2 更新 `tauri/device-gateway.ts` 的 init 信号逻辑为 `initDeviceSignals()` 调用
- [ ] 5.3 更新 `web/device-gateway.ts` 的 init 信号逻辑为 `initDeviceSignals()` 调用
- [ ] 5.4 验证: `npm run test:run -- device-gateway`

## 6. 最终验证

- [ ] 6.1 运行 `npm run test:run` 确认所有测试通过
- [ ] 6.2 运行 `npm run type-check` 确认无类型错误
- [ ] 6.3 运行 `npm run lint` 确认代码风格无问题
