## 1. 分析差异

- [ ] 1.1 对比三个 emulator 组件，整理差异清单（props、模板片段、样式）
- [ ] 1.2 确认共享逻辑边界

## 2. 创建 BaseEmulator

- [ ] 2.1 创建 `BaseEmulator.vue`，提取共享模板、script 和 style
- [ ] 2.2 定义 `EmulatorType` 类型和 props 接口
- [ ] 2.3 定义 `extra-options` named slot
- [ ] 2.4 根据 `type` prop 自动映射 i18n 键

## 3. 简化具体组件

- [ ] 3.1 将 `FlashEmulator.vue` 重写为 BaseEmulator 包装
- [ ] 3.2 将 `SRAMEmulator.vue` 重写为 BaseEmulator 包装
- [ ] 3.3 将 `EEPROMEmulator.vue` 重写为 BaseEmulator 包装

## 4. 验证

- [ ] 4.1 运行 `npm run type-check`
- [ ] 4.2 运行 `npm run test:run`
- [ ] 4.3 视觉比对三种模拟器的 UI 渲染结果
