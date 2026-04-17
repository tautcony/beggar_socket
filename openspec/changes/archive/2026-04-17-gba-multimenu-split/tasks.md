## 1. 创建共享状态 Composable

- [x] 1.1 创建 `composables/useMultiMenuState.ts`，提取核心响应式状态和所有业务逻辑
- [x] 1.2 实现 provide/inject 模式 (`MULTI_MENU_KEY` + `useMultiMenu()`) 用于子组件访问状态
- [x] 1.3 验证: `npm run type-check` — passed

## 2. 提取 GameRomPanel

- [x] 2.1 创建 `views/gba-multi-menu/GameRomPanel.vue`
- [x] 2.2 迁移游戏 ROM 列表模板（文件拖拽区域、游戏列表、排序/删除控件、配置面板）
- [x] 2.3 本地保留拖拽处理逻辑（draggedIndex、handleDragStart/handleDrop）
- [x] 2.4 迁移相关 scoped 样式

## 3. 提取 SaveFilePanel

- [x] 3.1 创建 `views/gba-multi-menu/SaveFilePanel.vue`
- [x] 3.2 迁移存档文件列表模板（拖拽区域、列表、删除控件）
- [x] 3.3 迁移相关 scoped 样式

## 4. 提取 RomBuildPanel (合并 BgImageUploader)

- [x] 4.1 创建 `views/gba-multi-menu/RomBuildPanel.vue`
- [x] 4.2 迁移配置区域（卡带类型、输出名、电池、菜单ROM、背景图片）
- [x] 4.3 迁移构建按钮和下载区域
- [x] 4.4 迁移背景图像预览 overlay
- [x] 4.5 迁移相关 scoped 样式

## 5. 重构主视图为编排器

- [x] 5.1 GBAMultiMenuView.vue 缩减为 ~200 行的布局编排器
- [x] 5.2 使用 useMultiMenuState() + provide(MULTI_MENU_KEY) 分发状态
- [x] 5.3 仅保留页面头部、加载遮罩、布局框架和子组件组合

## 6. 验证

- [x] 6.1 运行 `npm run type-check` — passed
- [x] 6.2 运行 `npm run lint` — passed (auto-fixed import sorting)
- [x] 6.3 运行 `npm run test:run` — 383 tests passed
- [x] 6.4 运行 `npm run build` — passed
