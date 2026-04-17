## 1. 创建共享状态 Composable

- [ ] 1.1 创建 `composables/useMultiMenuState.ts`，从 GBAMultiMenuView.vue 提取核心响应式状态（games、saveFiles、bgImage、buildConfig、buildResult、isLoading）
- [ ] 1.2 将构建逻辑（ROM assembly 调用）迁移到 composable 中
- [ ] 1.3 验证: `npm run type-check`

## 2. 提取 GameRomPanel

- [ ] 2.1 创建 `views/gba-multi-menu/GameRomPanel.vue`
- [ ] 2.2 迁移游戏 ROM 列表模板（文件拖拽区域、游戏列表、排序/删除控件）
- [ ] 2.3 迁移游戏配置编辑面板模板和逻辑
- [ ] 2.4 定义 props（games）和 emits（update:games、config-change）
- [ ] 2.5 迁移相关 scoped 样式

## 3. 提取 SaveFilePanel

- [ ] 3.1 创建 `views/gba-multi-menu/SaveFilePanel.vue`
- [ ] 3.2 迁移存档文件列表模板（拖拽区域、列表、删除控件）
- [ ] 3.3 定义 props（saveFiles）和 emits（update:saveFiles）
- [ ] 3.4 迁移相关 scoped 样式

## 4. 提取 BgImageUploader

- [ ] 4.1 创建 `views/gba-multi-menu/BgImageUploader.vue`
- [ ] 4.2 迁移背景图片配置区域模板（上传按钮、裁剪控件）
- [ ] 4.3 迁移背景图像预览 modal 模板
- [ ] 4.4 定义 props（bgImage）和 emits（update:bgImage）
- [ ] 4.5 迁移相关 scoped 样式

## 5. 提取 RomBuildPanel

- [ ] 5.1 创建 `views/gba-multi-menu/RomBuildPanel.vue`
- [ ] 5.2 迁移构建配置区域模板（基础配置组、菜单 ROM 配置）
- [ ] 5.3 迁移构建按钮和下载区域模板
- [ ] 5.4 定义 props（games、saveFiles、bgImage、buildConfig、buildResult）和 emits（build、download）
- [ ] 5.5 迁移相关 scoped 样式

## 6. 重构主视图为编排器

- [ ] 6.1 清理 GBAMultiMenuView.vue，仅保留页面头部、加载遮罩和子组件组合
- [ ] 6.2 使用 useMultiMenuState() 获取状态，通过 props/v-model 分发给子组件
- [ ] 6.3 保留全局布局样式，删除已迁移的样式
- [ ] 6.4 确认主视图不超过 250 行

## 7. 验证

- [ ] 7.1 运行 `npm run type-check` 确认无类型错误
- [ ] 7.2 运行 `npm run build` 确认构建成功
- [ ] 7.3 运行 `npm run lint` 确认代码风格无问题
- [ ] 7.4 手动 UI 验证：多合一菜单功能完整性（游戏添加/排序/配置、存档管理、背景图片、构建下载）
