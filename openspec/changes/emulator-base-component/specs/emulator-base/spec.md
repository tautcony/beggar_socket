## ADDED Requirements

### Requirement: BaseEmulator 通用组件
`BaseEmulator.vue` SHALL 接受 `type: 'flash' | 'sram' | 'eeprom'` prop，渲染共享的模拟器 UI 结构。

#### Scenario: Flash 类型渲染
- **WHEN** `BaseEmulator` 接收 `type="flash"`
- **THEN** SHALL 显示 Flash 相关标签和配置选项，UI 与原 `FlashEmulator.vue` 完全一致

#### Scenario: SRAM 类型渲染
- **WHEN** `BaseEmulator` 接收 `type="sram"`
- **THEN** SHALL 显示 SRAM 相关标签和配置选项，UI 与原 `SRAMEmulator.vue` 完全一致

#### Scenario: EEPROM 类型渲染
- **WHEN** `BaseEmulator` 接收 `type="eeprom"`
- **THEN** SHALL 显示 EEPROM 相关标签和配置选项，UI 与原 `EEPROMEmulator.vue` 完全一致

### Requirement: 具体组件轻量包装
每个具体模拟器组件 SHALL 仅包含 `<BaseEmulator>` 调用和差异 props/slots，不超过 30 行。

#### Scenario: FlashEmulator 使用 BaseEmulator
- **WHEN** `FlashEmulator.vue` 被渲染
- **THEN** SHALL 委托 `BaseEmulator` 并传入 Flash 特有配置

### Requirement: 差异通过 named slots 扩展
`BaseEmulator` SHALL 暴露 `extra-options` named slot，供具体组件注入类型特有的配置选项。

#### Scenario: Flash sector erase 选项通过 slot 注入
- **WHEN** `FlashEmulator` 需要显示 sector erase 配置
- **THEN** SHALL 通过 `extra-options` slot 注入，BaseEmulator 在正确位置渲染
