## Context

两个操作面板组件的 `<style scoped>` 块各有约 80 行 CSS，其中 60+ 行完全重复（按钮容器、操作按钮基础样式、disabled 状态、面板布局）。blank-check 操作的 UI 交互流程和错误处理也存在重复。

## Goals / Non-Goals

**Goals:**
- 提取重复 CSS 到共享文件
- 提取 blank-check 共享 UI 逻辑（如果足够）
- 减少操作面板组件间的样式不一致风险

**Non-Goals:**
- 不合并两个操作面板为单一组件（因为 GBA 和 GBC 操作集差异较大）
- 不重写面板组件的业务逻辑

## Decisions

### D1: 使用 SCSS 文件 + @use 导入

创建 `styles/operation-panel-shared.scss`，两个面板组件在 `<style>` 中 `@use` 导入。

**替代方案**: CSS 变量 + 全局样式。未采用，因为 scoped style 是项目既有模式，@use 保持了模块化。

### D2: Blank-check composable 仅在逻辑重复 >= 3 处时提取

如果 blank-check 逻辑在两个面板中仅各出现一次且差异较大，保留在各面板中不提取。

## Risks / Trade-offs

- [风险] @use 在 Vite scoped style 中的行为需验证 → 在开发环境确认热更新正常
- [取舍] 共享样式文件增加了间接层 → 比重复维护更好
