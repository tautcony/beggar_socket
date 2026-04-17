## 1. 定义 PlatformOps 接口

- [ ] 1.1 在 `services/` 下定义 `PlatformOps` 接口（platform、flashCommandSet、romBankSize、ramBankSize、toBank、switchRomBank、switchRamBank、enableRam、disableRam）
- [ ] 1.2 实现 `GBA_PLATFORM_OPS`（线性寻址、空 bank 切换）
- [ ] 1.3 实现 `MBC5_PLATFORM_OPS`（0x4000 bank 窗口、MBC5 bank 寄存器写入）
- [ ] 1.4 验证: `npm run type-check`

## 2. 提取进度初始化工厂

- [ ] 2.1 在 `CartridgeAdapter` 基类中实现 `createProgressContext()` 工厂方法
- [ ] 2.2 将 GBAAdapter 中 8+ 处 SpeedCalculator/ProgressReporter 初始化替换为 `createProgressContext()` 调用
- [ ] 2.3 将 MBC5Adapter 中 8+ 处初始化替换为 `createProgressContext()` 调用
- [ ] 2.4 验证: `npm run test:run`

## 3. Phase A — readROM 模板方法

- [ ] 3.1 在 `CartridgeAdapter` 基类中实现 `readROM()` 模板方法
- [ ] 3.2 将 GBAAdapter.readROM() 替换为基类调用 + GBA PlatformOps
- [ ] 3.3 将 MBC5Adapter.readROM() 替换为基类调用 + MBC5 PlatformOps
- [ ] 3.4 验证: `npm run test:run` + 真机 ROM 读取测试

## 4. Phase B — writeROM 模板方法

- [ ] 4.1 在基类中实现 `writeROM()` 模板方法（含 blank 采样、擦除、编程、验证流程）
- [ ] 4.2 提取 `sampleRomRegionBlank()` 和 `readROMChunkWithRetry()` 为基类方法
- [ ] 4.3 将 GBAAdapter.writeROM() 替换为基类调用
- [ ] 4.4 将 MBC5Adapter.writeROM() 替换为基类调用
- [ ] 4.5 验证: `npm run test:run` + 真机 ROM 写入测试

## 5. Phase C — eraseSectors 和 verifyROM 模板方法

- [ ] 5.1 在基类中实现 `eraseSectors()` 模板方法（含重试逻辑）
- [ ] 5.2 在基类中实现 `verifyROM()` 模板方法
- [ ] 5.3 将两个子类的 eraseSectors/verifyROM 替换为基类调用
- [ ] 5.4 验证: `npm run test:run`

## 6. Phase D — RAM 操作模板方法

- [ ] 6.1 在基类中实现 `readRAM()` 模板方法（含 enableRam/disableRam 和 bank 切换）
- [ ] 6.2 在基类中实现 `writeRAM()` 和 `verifyRAM()` 模板方法
- [ ] 6.3 将两个子类的 RAM 操作替换为基类调用
- [ ] 6.4 验证: `npm run test:run` + 真机 RAM 读写测试

## 7. Phase E — PPB 解锁核心提取

- [ ] 7.1 定义 `PPBDeviceOps` 接口
- [ ] 7.2 实现 `ppbUnlockCore(device, ops, sectorCount, onProgress, signal)` 共享函数
- [ ] 7.3 将 `ppbUnlockGBA()` 改为提供 GBA PPBDeviceOps 的薄包装
- [ ] 7.4 将 `ppbUnlockMBC5()` 改为提供 MBC5 PPBDeviceOps 的薄包装
- [ ] 7.5 验证: 需真机 PPB 解锁测试

## 8. 清理与最终验证

- [ ] 8.1 确认 GBAAdapter 不超过 350 行
- [ ] 8.2 确认 MBC5Adapter 不超过 350 行
- [ ] 8.3 删除子类中已被基类模板方法替代的死代码
- [ ] 8.4 运行 `npm run test:run` 确认所有测试通过
- [ ] 8.5 运行 `npm run type-check` 确认无类型错误
- [ ] 8.6 运行 `npm run lint` 确认代码风格无问题
- [ ] 8.7 运行 `npm run build` 确认生产构建成功
