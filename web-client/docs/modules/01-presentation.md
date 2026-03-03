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

### `src/components`
- `CartBurner.vue`: 烧录工作台容器，调用 `BurnerFacade` 执行操作
- `DeviceConnect.vue`: 设备连接交互、端口选择模态、连接状态回传
- `modal/*`: 配置、进度、分析与结果展示
- `operaiton/*`: ROM/RAM/Chip 操作面板

### `src/composables`
- `useToast`: 基于 `CustomEvent` 的全局消息分发

## 职责
- 负责用户交互、界面状态绑定、提示反馈。
- 不处理协议封包，不直接操作串口。

## 约束
- 禁止 `components/views -> protocol`。
- 通过 `features/burner/application` 与 `services/device-connection-manager` 访问能力。
