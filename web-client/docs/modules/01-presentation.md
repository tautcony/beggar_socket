# 模块：Presentation

`src/router/index.ts` 注册 Home、GBA MultiMenu、ROM Assembly 页面。`src/views/`、`src/components/` 与 `src/composables/` 负责交互、状态投影、提示和文件导出。

- `src/components/CartBurner.vue`：采集 UI 选择，操作获准后调用应用 facade 的 prepare 与 runCommand；成功投影和文件名选择由会话流程保护。
- `src/components/DeviceConnect.vue`：设备发现、选择和连接反馈，通过连接 manager/use case 执行。
- `src/composables/cartburner/useCartBurnerSessionState.ts`：绑定当前设备会话、共享 owner、progress/log；设备 identity、取消和卸载检查阻止旧任务更新新界面。
- `src/composables/cartburner/useCartBurnerFileState.ts`：加载和解析 ROM/RAM 文件。
- `src/composables/useMultiMenuState.ts`：默认资源与用户选择 latest-wins，卸载后禁止提交结果；保留默认背景与图像库预加载体验。
- `src/composables/useEnvironment.ts`：Web/Tauri 和开发/生产环境检测。
- `src/components/operaiton/contracts.ts`：操作面板 Props/Events；目录拼写沿用现有 API。

UI 不直接依赖 protocol。操作面板依赖容器合约，不能自行操作 transport。工具窗口经服务入口进入同一设备 owner。文件导出仍属于展示交互，等待导出对话框期间操作所有权仍被持有。

`src/components/LogViewer.vue` 消费会话日志；结构化 diagnostic 保留 cause identity，不通过字符串重构错误。`src/components/modal/ProgressDisplayModal.vue` 展示包级等待时间与进度。
