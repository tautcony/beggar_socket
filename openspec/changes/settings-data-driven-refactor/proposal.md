## Why

`AdvancedSettings` 类包含 16 组完全相同模式的 getter/setter（~128 行）和 20+ 次重复的 `validateSettings()` 边界检查。每次新增配置项需手动复制 getter/setter 模板和验证块，容易遗漏 `saveSettings()` 调用或验证规则。数据驱动重构可将模板代码缩减 60% 以上。

## What Changes

- 引入属性描述符映射表，声明式定义每个配置属性的 field name、validator、min/max 范围
- 从映射表自动生成 getter/setter 逻辑，消除 16 组机械重复
- 从映射表驱动 `validateSettings()` 验证逻辑，消除 20+ 个重复检查块
- 新增配置项只需在映射表中添加一行

## Capabilities

### New Capabilities
- `settings-data-driven`: 定义 AdvancedSettings 数据驱动配置管理模式

### Modified Capabilities

## Impact

- `settings/advanced-settings.ts` — 主要改动文件
- `tests/advanced-settings.test.ts` — 验证行为不变
- 纯内部重构，不影响外部 API
