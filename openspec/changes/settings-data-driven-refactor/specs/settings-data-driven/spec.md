## ADDED Requirements

### Requirement: SettingDescriptor 映射表
`AdvancedSettings` SHALL 维护一个 `SettingDescriptor[]` 数组，每个元素声明一个配置属性的 key、分组、字段名、默认值和验证函数。

#### Scenario: 新增配置项只需添加描述符
- **WHEN** 需要新增一个配置属性
- **THEN** 只需在 `SettingDescriptor[]` 数组中添加一行，不需要手写 getter/setter

### Requirement: getter/setter 自动生成
所有 16 个配置属性的 getter 和 setter SHALL 由映射表驱动生成。

#### Scenario: getter 返回正确值
- **WHEN** 外部调用 `AdvancedSettings.someProperty`
- **THEN** 返回值 SHALL 与重构前的手写 getter 行为一致

#### Scenario: setter 触发验证和持久化
- **WHEN** 外部设置 `AdvancedSettings.someProperty = value`
- **THEN** SHALL 执行对应描述符的 validator，然后调用 `saveSettings()`

### Requirement: validateSettings 数据驱动
`validateSettings()` SHALL 遍历描述符数组，对每个属性自动应用范围检查。

#### Scenario: 验证行为不变
- **WHEN** `validateSettings()` 被调用
- **THEN** 每个属性的验证结果 SHALL 与重构前完全一致

### Requirement: 外部 API 不变
所有属性名、类型签名和行为 SHALL 与重构前完全一致。

#### Scenario: 现有调用代码无需修改
- **WHEN** 任何组件或服务读写 `AdvancedSettings` 属性
- **THEN** 不需要修改任何导入或调用语法
