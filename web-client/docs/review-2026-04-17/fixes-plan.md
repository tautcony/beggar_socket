# 修复计划

## 批次划分

### Batch A: 低成本高收益 — 常量提取与简单去重

**目标**: 消除最明显的重复定义和魔数，不涉及架构变更。

#### A-1. 提取 DEFAULT_PROGRESS 到共享常量
- 涉及文件: `composables/cartburner/useCartBurnerSessionState.ts`, `features/burner/application/burner-session.ts`
- 建议: 在 `utils/progress/` 或 `types/` 下新建常量，两处改为 import
- 验证: `npm run type-check && npm run test:run`

#### A-2. 提取适配器共享时序常量
- 涉及文件: `services/gba-adapter.ts`, `services/mbc5-adapter.ts`
- 建议: 在 `services/cartridge-adapter.ts` 基类中定义共享常量
- 验证: `npm run type-check && npm run test:run`

#### A-3. 提取传输层超时错误构造函数
- 涉及文件: `platform/serial/transports.ts`, `platform/serial/tauri/tauri-serial-transport.ts`
- 建议: 新建 `platform/serial/transport-errors.ts`，提取 `createReadTimeoutError(metrics)` 
- 验证: `npm run test:run -- tauri-serial-transport serial-service`

#### A-4. 提取串口配置常量
- 涉及文件: `platform/serial/tauri/device-gateway.ts`, `platform/serial/web/device-gateway.ts`
- 建议: 定义 `DEFAULT_SERIAL_CONFIG` 常量
- 验证: `npm run type-check`

#### A-5. 提取 Flash 命令魔数为命名常量
- 涉及文件: `protocol/beggar_socket/protocol.ts`, `protocol/beggar_socket/protocol-utils.ts`
- 建议: 定义 `FLASH_CMD`, `FLASH_ADDR`, `PROTOCOL_ACK` 等常量
- 验证: `npm run type-check && npm run test:run`

#### A-6. 提取 ROM header 偏移量常量
- 涉及文件: `utils/parsers/rom-parser.ts`, `utils/rom/rom-editor.ts`
- 建议: 定义 `GBA_HEADER`, `GB_HEADER` 偏移量对象
- 验证: `npm run test:run -- rom-parser`

#### A-7. FileInfo 类型去重
- 涉及文件: `types/file-info.ts`, `types/rom-assembly.ts`
- 建议: `rom-assembly.ts` 中 import 而非重定义
- 验证: `npm run type-check`

#### A-8. 修正目录拼写 operaiton → operation
- 涉及文件: `components/operaiton/` 目录及所有 import
- 验证: `npm run build`

---

### Batch B: 中等规模重构 — 模式提取与方法分解

**目标**: 消除方法级和组件级的重复，改善可维护性。

#### B-1. useCartBurnerFileState ROM/RAM handler 工厂化
- 涉及文件: `composables/cartburner/useCartBurnerFileState.ts`
- 建议: 用工厂函数 `createFileHandlers('rom'|'ram')` 替代 4 对镜像函数
- 验证: `npm run test:run -- use-cartburner-file-state`

#### B-2. AdvancedSettings 数据驱动重构
- 涉及文件: `settings/advanced-settings.ts`
- 建议:
  - 定义属性描述符映射表 `{ key, field, validator, min, max }`
  - 从映射表生成 getter/setter
  - 从映射表驱动 `validateSettings()`
- 预计减少: ~150 行模板代码
- 验证: `npm run test:run -- advanced-settings`

#### B-3. 操作面板通用样式和逻辑提取
- 涉及文件: `components/operaiton/RomOperations.vue`, `RamOperations.vue`, `ChipOperations.vue`
- 建议:
  - 提取公共样式到 `styles/_operation-panels.scss`
  - 提取空白检测逻辑到 `useBlankCheck()` composable
- 验证: `npm run build` + 手动 UI 验证

#### B-4. 模拟器组件提取 BaseEmulator
- 涉及文件: `components/emulator/GBAEmulator.vue`, `GBCEmulator.vue`, `GBEmulator.vue`
- 建议:
  - 创建 `useEmulatorBase(config)` composable 封装生命周期和控制逻辑
  - 创建 `BaseEmulator.vue` 封装通用模板和样式
- 预计减少: ~200 行重复
- 验证: 手动 UI 验证

#### B-5. CFIParser.parse() 分解
- 涉及文件: `utils/parsers/cfi-parser.ts`
- 建议: 按 CFI 结构段提取 `parseQueryInfo()`, `parsePrimaryAlgorithm()`, `parseExtendedQuery()` 等子方法
- 验证: `npm run test:run -- cfi-parser`

#### B-6. rom-parser.ts 函数参数化
- 涉及文件: `utils/parsers/rom-parser.ts`
- 建议: 参数化 `validateLogo()` 和 `calculateChecksum()`，减少 GBA/GB 重复
- 验证: `npm run test:run -- rom-parser`

#### B-7. 提取设备网关 init 信号序列
- 涉及文件: `platform/serial/tauri/device-gateway.ts`, `platform/serial/web/device-gateway.ts`
- 建议: 提取 `initDeviceSignals(transport)` 共享函数
- 验证: `npm run test:run -- device-gateway`

#### B-8. GBAMultiMenuView 拆分
- 涉及文件: `views/GBAMultiMenuView.vue`
- 建议: 拆分为 `GameRomPanel`, `SaveFilePanel`, `BgImageUploader`, `RomBuildPanel` 子组件
- 验证: `npm run build` + 手动 UI 验证

---

### Batch C: 大型架构重构 — GBA/GBC 统一抽象

**目标**: 从根本上解决四层 GBA/GBC 二元镜像问题，是项目最大的技术债。

#### C-1. 定义 PlatformOps 协议抽象层
- 涉及文件: `protocol/beggar_socket/protocol.ts`
- 建议: 定义 `FlashCommandSet` 接口封装 GBA/GBC 差异（地址、编码），提取 `flashUnlock()`, `flashEraseSector()` 等通用操作
- 预计减少: ~100 行协议层重复

#### C-2. 适配器操作模板方法提取
- 涉及文件: `services/gba-adapter.ts`, `services/mbc5-adapter.ts`, `services/cartridge-adapter.ts`
- 建议:
  - 在 `CartridgeAdapter` 中实现 `readROM()`, `writeROM()`, `eraseROM()`, `verifyROM()` 模板方法
  - 子类仅实现平台特定的 `createPlatformOps()` 工厂方法
- 预计减少: ~2500 行适配器重复
- 风险: 这是最大的重构项，需充分测试
- 验证: 全部适配器测试 + 真机测试

#### C-3. PPB Unlock 核心提取
- 涉及文件: `services/tool-functions.ts`
- 建议: 定义 `PPBDeviceOps` 接口，提取 `ppbUnlockCore()` 公共流程
- 预计减少: ~210 行
- 验证: 需真机测试

#### C-4. protocol-utils.ts 与 protocol-adapter.ts 统一
- 涉及文件: `protocol/beggar_socket/protocol-utils.ts`, `protocol/beggar_socket/protocol-adapter.ts`
- 建议: 合并为单一入口层，消除双入口混淆
- 验证: `npm run type-check && npm run test:run`

---

## 实施建议

1. **Batch A** 可立即开始，每项独立，风险最低
2. **Batch B** 建议在功能稳定期推进，每项可独立完成
3. **Batch C** 建议作为专项技术债偿还计划，C-2 是核心但需要最充分的测试覆盖
4. 每个 batch 内各项可并行或按依赖关系串行
5. 优先完成 A-1 ~ A-7（纯提取、零行为变更）作为重构基础
