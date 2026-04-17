## Why

`GBAAdapter`（1658 行）和 `MBC5Adapter`（1850 行）是项目中最大的两个 TypeScript 文件，核心操作方法（readROM、writeROM、eraseSectors、verifyROM、readRAM、writeRAM、verifyRAM）85-95% 结构相同，总重复量约 3000 行。差异仅在协议调用函数（`rom_*` vs `gbc_*`）、地址计算（线性 vs bank 窗口）和少量平台特定参数。8 个时序常量在两个文件中独立定义完全相同。8+ 个操作方法重复相同的 SpeedCalculator + ProgressReporter 初始化套路。`tool-functions.ts` 中 `ppbUnlockGBA`（260 行）和 `ppbUnlockMBC5`（210 行）87% 结构相同。适配器层是项目最大的技术债，任何横切关注点的修改都需要双平台同步，是回归风险的最主要来源。

## What Changes

- 定义 `PlatformOps` 接口封装 GBA/GBC 在适配器层面的差异（协议调用、地址计算、bank 窗口参数）
- 在 `CartridgeAdapter` 基类中实现通用操作模板方法（readROM、writeROM、eraseSectors、verifyROM 等）
- GBAAdapter 和 MBC5Adapter 仅实现 `createPlatformOps()` 工厂方法，提供平台差异委托
- 提取 `createOperationProgressContext()` 工厂方法消除进度初始化重复
- 定义 `PPBDeviceOps` 接口并提取 `ppbUnlockCore()` 公共流程

## Capabilities

### New Capabilities
- `adapter-template-operations`: 定义适配器层模板方法和 PlatformOps 接口规范
- `ppb-unlock-abstraction`: 定义 PPB 解锁流程的公共抽象规范

### Modified Capabilities

## Impact

- `services/cartridge-adapter.ts` — 从 282 行扩展为包含通用模板方法的基类（约 800-1000 行）
- `services/gba-adapter.ts` — 从 1658 行缩减至约 200-300 行（仅 PlatformOps 实现和平台特定逻辑）
- `services/mbc5-adapter.ts` — 从 1850 行缩减至约 200-300 行
- `services/tool-functions.ts` — PPB 解锁函数从约 470 行缩减至约 250 行（核心 + 两个薄包装）
- 依赖 `protocol-platform-abstraction` 提供的 `FlashCommandSet` 接口
- 依赖 `shared-constants-extraction` 提供的共享时序常量
- 这是项目最大的重构项，需充分测试覆盖和真机验证
