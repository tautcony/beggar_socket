# Phase 3 审查报告: 组件与视图层重复

> 日期: 2026-04-17
> 文件数: 12
> 发现: P0(0) / P1(3) / P2(4) / INFO(2)

## 已审查文件

- `views/GBAMultiMenuView.vue` (2200 行)
- `views/HomeView.vue` (500 行)
- `views/RomAssemblyView.vue` (1100 行)
- `components/operaiton/RomOperations.vue`
- `components/operaiton/RamOperations.vue`
- `components/operaiton/ChipOperations.vue`
- `components/operaiton/contracts.ts`
- `components/operaiton/index.ts`
- `components/emulator/GBAEmulator.vue`
- `components/emulator/GBCEmulator.vue`
- `components/emulator/GBEmulator.vue`
- `components/CartBurner.vue` (1300 行)

## Findings

### [P1-01] 三个模拟器组件模板/样式/生命周期几乎完全相同

- 位置: `components/emulator/GBAEmulator.vue`, `GBCEmulator.vue`, `GBEmulator.vue`
- 触发条件: 三个组件共享相同的:
  - 模板结构: header（标题 + 控制按钮）、canvas 容器、footer（键位映射帮助）— **100% 相同的 DOM 结构**
  - 样式: `.emulator-overlay`, `.emulator-container`, `.emulator-header`, `.controls-help`, `.key-mappings` — **100% 重复**
  - 生命周期: `onMounted`/`onUnmounted`/`watch(isVisible)`/`watch(romData)` 的流程框架 — **相同骨架**
  - 控制方法: `togglePause()`, `resetGame()`, `closeEmulator()` — **相同逻辑框架**
- 差异点:
  - canvas 尺寸: GBA 240×160, GBC/GB 160×144
  - 底层库: `gbats.Wrapper` vs `wasmboy.WasmBoy` vs `gameboy-emulator.Gameboy`
  - 初始化参数和键绑定实现细节
- 影响: 每次修改模拟器 UI/样式/交互模式需同步修改三个文件
- 修复方向:
  - 创建 `useEmulatorBase(config)` composable 封装通用生命周期和控制逻辑
  - 创建 `BaseEmulator.vue` 组件封装通用模板和样式，通过 slot 或 props 接收差异配置
  - 各模拟器组件仅负责初始化配置

### [P1-02] 操作面板样式和逻辑重复

- 位置: `components/operaiton/RomOperations.vue`, `RamOperations.vue`, `ChipOperations.vue`
- 触发条件:
  - **CSS 完全重复**: `.op-title-row`, `.op-title`, `.button-row`, `.selector-container`, `.section-header`, `.section` 在三个文件中定义相同
  - **空白检测对话框逻辑**: `onVerifyClick()` 和 `selectBlankPattern()` 在 ROM 和 RAM 面板中完全相同
  - **按钮行布局**: 3-4 个按钮的 flex 布局在三个面板中重复
  - **下拉选择器结构**: size/base-address/type 选择器的 HTML 结构高度相似
- 影响: 样式修改需同步三个文件，空白检测逻辑修改需同步两个文件
- 修复方向:
  - 将操作面板通用样式提取到 `_operation-panels.scss` 或共享 CSS 类
  - 将空白检测逻辑提取到 `useBlankCheck()` composable
  - 考虑创建 `<SizeSelector>` 通用组件

### [P1-03] GBAMultiMenuView.vue 极度臃肿 (2200 行)

- 位置: `views/GBAMultiMenuView.vue` 全文件
- 触发条件: 单个 Vue 文件承载 5+ 个不同职责：
  - 游戏配置管理（游戏列表、配置编辑）
  - 存档文件处理
  - 背景图片处理（上传、裁剪、预览）
  - ROM 构建逻辑
  - 结果下载
- 模板约 800 行，脚本约 1200 行
- 影响: 极难定位具体逻辑，修改一个功能可能意外影响其他功能，单元测试困难
- 修复方向: 拆分为 4-5 个子组件：
  - `<GameRomPanel>` — 游戏选择与配置
  - `<SaveFilePanel>` — 存档管理
  - `<BgImageUploader>` — 背景图片处理
  - `<RomBuildPanel>` — 构建选项与下载

### [P2-01] CartBurner.vue 过大 (1300 行) 且操作方法模板化

- 位置: `components/CartBurner.vue`
- 触发条件: 包含 9 个 async 操作方法，每个都遵循相同的 `executeOperation()` 模板：

```typescript
async function doXxx() {
  await executeOperation({
    operation: async (signal) => { ... },
    onError: (error) => { ... },
  });
}
```

- 影响: 操作方法的模板代码膨胀，但逻辑差异主要在 `operation` 回调内部
- 修复方向: 评估是否可进一步简化操作声明，但考虑到每个操作的参数组合不同，当前抽象可能已足够；优先关注文件拆分

### [P2-02] 12 个 Modal 组件重复 BaseModal 使用模式

- 位置: `components/modal/` 下 12 个文件
- 触发条件: 所有 modal 都遵循相同的模板结构：
  ```vue
  <BaseModal v-model="modelValue" :title="..." width="...">
    <template #header>...</template>
    <div class="modal-body">...</div>
    <template #footer>...</template>
  </BaseModal>
  ```
- 影响: 模式重复但不算严重，因为各 modal 内容差异大；主要问题是 header/footer 的按钮模式（关闭/确认/取消）可以进一步标准化
- 修复方向: 在 `BaseModal` 中提供 `confirmButton`/`cancelButton` props，减少 footer slot 重复

### [P2-03] defineEmits 模式不一致

- 位置: 多个组件
- 触发条件:
  - 部分组件: `defineEmits([...ROM_OPERATION_EVENTS])` (字符串数组)
  - 部分组件: `defineEmits<{ 'update:modelValue': [...] }>()` (类型定义)
- 影响: 代码风格不统一，新开发者需要判断应该使用哪种模式
- 修复方向: 统一为类型定义模式 (`defineEmits<{...}>()`)，因为它提供更好的类型推导

### [P2-04] 硬编码的中文文本

- 位置: `views/GBAMultiMenuView.vue` L51 `"返回"`, L314 `"(默认)"`
- 触发条件: UI 文本未使用 i18n
- 影响: 国际化不完整
- 修复方向: 替换为 `$t('ui.common.back')` 等 i18n key

### [INFO-01] 目录名拼写错误 `operaiton`

- 位置: `components/operaiton/` (应为 `operation`)
- 影响: 可读性降低，新开发者可能困惑
- 修复方向: 重命名目录（需更新所有 import 路径）

### [INFO-02] 组件 Prop 验证不一致

- 位置: 多个组件
- 触发条件:
  - `ChipOperations.vue`: 使用 computed 属性验证 (`chipInfoValid`)
  - `RomOperations.vue`: 不验证，依赖父组件
- 影响: 防御性编程标准不统一
- 修复方向: 确定一致的验证策略

## 漏检复盘

- 已主动复查的高风险模式:
  - 重复模板: 已覆盖 emulator、operation panel、modal 三大类
  - 重复样式: 已覆盖 button-row、selector-container、section-header
  - i18n 遗漏: 已发现 GBAMultiMenuView 的硬编码中文
  - 命名一致性: 已发现 `operaiton` 目录拼写错误
- 本 phase 仍然证据不足的点:
  - `RomAssemblyView.vue` (1100 行) 也较大，但未深入评估其拆分必要性

## 未覆盖区域

- `components/common/` — 通用组件，复用度高，不太可能有大量重复
- `components/link/` — 2 个小组件
- `components/progress/SectorVisualization.vue` — 独立组件
