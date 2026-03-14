# 模块：Presentation

## 目录
- `src/views`
- `src/components`
- `src/composables`

## 模块设计

### `src/views`
- `HomeView.vue`: 应用主入口，编排 `DeviceConnect + CartBurner + DebugPanel`
- `RomAssemblyView.vue`: ROM 组装 UI 与交互
- `GBAMultiMenuView.vue`: 多菜单构建 UI
- `SerialTestView.vue`: 串口调试与环境检测页面（仅直接访问，不在路由中注册）

路由注册（`src/router/index.ts`，hash 模式）：
- `/` → `HomeView`
- `/gba-multi-menu` → `GBAMultiMenuView`
- `/rom-assembly` → `RomAssemblyView`

### `src/components`
- `CartBurner.vue`: 烧录工作台容器，调用 `BurnerFacade` 执行操作
- `DeviceConnect.vue`: 设备连接交互、端口选择模态、连接状态回传
- `DebugPanel.vue`: 调试信息面板
- `LogViewer.vue`: 日志查看组件
- `MorseBorder.vue`: 装饰性摩尔斯码边框组件
- `LanguageSwitcher.vue`: 语言切换
- `common/`: 通用 UI 基础组件
  - `AppMenu.vue`: 顶部菜单
  - `BaseButton.vue`: 通用按钮
  - `BaseModal.vue`: 通用模态框基础
  - `FileDropZone.vue`: 文件拖放上传
  - `FloatingLink.vue`: 浮动链接
  - `GlobalToast.vue`: 全局提示
  - `RomInfoPanel.vue`: ROM 信息展示面板
  - `ToggleSwitch.vue`: 开关组件
- `emulator/`: 游戏模拟器组件
  - `GBAEmulator.vue`: GBA 模拟器
  - `GBCEmulator.vue`: GBC 模拟器
  - `GBEmulator.vue`: GB 模拟器
- `link/`: 链接类组件
  - `DebugLink.vue`: 调试链接
  - `GitHubLink.vue`: GitHub 链接
- `modal/`: 模态框组件
  - `AboutModal.vue`: 关于对话框
  - `AdvancedSettingsModal.vue`: 高级设置
  - `CartridgeToolsModal.vue`: 卡带工具
  - `DebugToolModal.vue`: 调试工具（含原始命令收发）
  - `FileNameSelectorModal.vue`: 文件名选择
  - `MultiCartResultModal.vue`: 多卡烧录结果
  - `PortSelectorModal.vue`: 端口选择
  - `ProgressDisplayModal.vue`: 烧录进度展示
  - `RomAnalyzerModal.vue`: ROM 分析
  - `RTCModal.vue`: RTC 时间设置
  - `SystemNoticeHistoryModal.vue`: 系统通知历史
  - `SystemNoticeModal.vue`: 系统通知
- `operaiton/`: （注意：目录名含拼写错误 `operaiton`）操作面板组件
  - `ChipOperations.vue`: Flash Chip 操作（读 ID、擦除、MBC 配置）
  - `RomOperations.vue`: ROM 读写操作
  - `RamOperations.vue`: RAM 读写操作
  - `contracts.ts`: 操作面板 Props/Events 接口定义
  - `index.ts`: 统一导出
- `progress/`: 进度可视化
  - `SectorVisualization.vue`: Sector 级别烧录进度可视化

### `src/composables`
- `useToast.ts`: 基于 `CustomEvent` 的全局消息分发
- `useEnvironment.ts`（`Environment` 类）: 环境检测（Electron/Web/Dev/Prod）
- `cartburner/`: 烧录器状态管理 composables
  - `useCartBurnerFileState.ts`: 文件加载与解析状态
  - `useCartBurnerSessionState.ts`: 烧录会话状态（busy/progress/log）
  - `index.ts`: 统一导出

## 职责
- 负责用户交互、界面状态绑定、提示反馈。
- 不处理协议封包，不直接操作串口。

## 约束
- 禁止 `components/views -> protocol`。
- `components/operaiton` 只能依赖容器合约（`contracts.ts`），不能直接导入 platform/services 内部实现。
- 通过 `features/burner/application` 与 `services/device-connection-manager` 访问能力。
