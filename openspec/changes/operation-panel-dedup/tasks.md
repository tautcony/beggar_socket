## 1. 样式提取

- [ ] 1.1 对比两个面板组件 `<style>` 块，标记完全重复的 CSS 规则
- [ ] 1.2 创建 `styles/operation-panel-shared.scss`，移入重复规则
- [ ] 1.3 在 `GBAOperationPanel.vue` 中 `@use` 导入共享样式，删除重复规则
- [ ] 1.4 在 `GBCOperationPanel.vue` 中 `@use` 导入共享样式，删除重复规则

## 2. Blank-check 逻辑评估

- [ ] 2.1 对比两个面板的 blank-check 逻辑，评估是否值得提取 composable
- [ ] 2.2 若值得提取，创建 `composables/useBlankCheck.ts` 并在两个面板中引用

## 3. 验证

- [ ] 3.1 运行 `npm run type-check`
- [ ] 3.2 运行 `npm run lint`
- [ ] 3.3 视觉比对 GBA 和 GBC 操作面板的渲染结果
