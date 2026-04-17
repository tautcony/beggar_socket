## ADDED Requirements

### Requirement: 共享样式模块
`styles/operation-panel-shared.scss` SHALL 包含按钮容器、操作按钮基础样式、disabled 状态样式和面板布局等共享 CSS 规则。

#### Scenario: GBA 面板使用共享样式
- **WHEN** `GBAOperationPanel.vue` 渲染
- **THEN** SHALL 使用 `operation-panel-shared.scss` 中的共享样式，视觉效果与重构前一致

#### Scenario: GBC 面板使用共享样式
- **WHEN** `GBCOperationPanel.vue` 渲染
- **THEN** SHALL 使用 `operation-panel-shared.scss` 中的共享样式，视觉效果与重构前一致

### Requirement: 面板组件样式精简
重构后每个操作面板组件的 `<style>` 块 SHALL 仅包含该面板特有的样式规则。

#### Scenario: 无重复 CSS 规则
- **WHEN** 对比两个面板组件的 `<style>` 块
- **THEN** SHALL 没有重复的 CSS 选择器和规则

### Requirement: 视觉一致性
重构前后的 UI 渲染 SHALL 完全一致（像素级别无变化）。

#### Scenario: 按钮样式一致
- **WHEN** 在浏览器中查看操作按钮
- **THEN** 大小、颜色、间距、hover/disabled 状态 SHALL 与重构前一致
