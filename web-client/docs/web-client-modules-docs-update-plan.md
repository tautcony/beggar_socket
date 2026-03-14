# `web-client/docs/modules` 文档同步重检计划

## 1. 文档定位

本文件不是面向未来架构的设计文档，也不是重构路线图。

本文件用于指导每一次 `web-client/docs/modules` 文档同步时的重检工作，目标只有一个：

- 基于当前仓库中已经存在、已经实现、可以读取到的代码与测试，检查模块文档说明是否与实际实现一致

因此，本文件遵循以下原则：

- 只看当前代码，不看未实施方案
- 只记录已实现事实，不推演未来状态
- 只把“文档与代码是否一致”作为判断标准
- 如果发现代码边界混乱，也只如实记录现状，不擅自写成目标架构

## 2. 使用场景

在以下场景下，应使用本文件进行一次同步重检：

1. `web-client/src` 下模块边界发生变化
2. 新增或删除了模块级目录、关键入口、关键流程
3. 主链路数据流发生变化
4. `docs/modules` 中某篇文档被修改，需要确认是否影响其他文档
5. 架构守卫、测试门禁、运行入口发生变化
6. 发布前需要确认文档与当前实现一致

## 3. 重检目标

每次同步重检应回答以下问题：

1. `docs/modules` 的模块划分，是否仍然能覆盖当前代码结构
2. 每篇模块文档中描述的职责、边界、依赖方向，是否仍与代码一致
3. `00-overview.md` 中的总览图、目录映射、质量门禁，是否仍准确
4. `08-dataflows.md` 中的关键数据流，是否仍与当前主链路一致
5. 新增代码是否落在已有文档范围内；如果没有，应补充到哪篇文档
6. 文档里是否出现了代码中已经不存在、或已经改变含义的说明

## 4. 重检范围

### 4.1 必检文档范围

- `web-client/docs/modules/README.md`
- `web-client/docs/modules/00-overview.md`
- `web-client/docs/modules/01-presentation.md`
- `web-client/docs/modules/02-application.md`
- `web-client/docs/modules/03-platform-serial.md`
- `web-client/docs/modules/04-protocol-beggar-socket.md`
- `web-client/docs/modules/05-services-adapters.md`
- `web-client/docs/modules/06-state-settings-i18n.md`
- `web-client/docs/modules/07-electron-runtime.md`
- `web-client/docs/modules/08-dataflows.md`

### 4.2 必检代码范围

用于判断文档是否准确的事实来源，至少应包括：

- `web-client/package.json`
- `web-client/src/main.ts`
- `web-client/src/App.vue`
- `web-client/src/router/index.ts`
- `web-client/src/views/**`
- `web-client/src/components/**`
- `web-client/src/composables/**`
- `web-client/src/features/**`
- `web-client/src/platform/**`
- `web-client/src/protocol/**`
- `web-client/src/services/**`
- `web-client/src/stores/**`
- `web-client/src/settings/**`
- `web-client/src/i18n/**`
- `web-client/src/types/**`
- `web-client/src/utils/**`
- `web-client/electron/**`
- `web-client/tests/**`
- `web-client/scripts/check-architecture-deps.cjs`
- `web-client/eslint.config.js`

### 4.3 联动核对范围

这些文件不一定每次都要改，但应在重检时确认是否受影响：

- `web-client/README.md`
- `web-client/docs/README.md`
- `web-client/docs/archive/*`

## 5. 按模块的文件分析范围清单

### 5.1 总览与入口

重点文件：

- `web-client/package.json`
- `web-client/src/main.ts`
- `web-client/src/App.vue`
- `web-client/src/router/index.ts`
- `web-client/scripts/check-architecture-deps.cjs`
- `web-client/eslint.config.js`

检查目标：

- 当前运行入口是否变化
- 顶层目录与模块文档映射是否变化
- 构建、类型检查、测试、依赖检查命令是否变化
- 质量门禁说明是否仍准确

### 5.2 Presentation

重点文件：

- `web-client/src/views/**`
- `web-client/src/components/**`
- `web-client/src/composables/**`
- `web-client/src/App.vue`
- `web-client/src/router/index.ts`

检查目标：

- 页面、组件、容器、通用 UI 的分层是否仍与文档一致
- 组件职责是否发生明显漂移
- 是否新增需要单独说明的页面容器或公共组件分组
- 文档中的目录覆盖是否遗漏当前组件目录

### 5.3 Application

重点文件：

- `web-client/src/features/burner/application/**`
- `web-client/src/components/CartBurner.vue`
- `web-client/src/composables/**`

检查目标：

- 当前应用编排逻辑位于何处
- `use case`、`session`、`flow template` 等描述是否仍准确
- 文档是否误把 UI 职责或底层协议职责写进应用层

### 5.4 Platform Serial

重点文件：

- `web-client/src/platform/serial/**`
- `web-client/src/types/serial.ts`
- `web-client/src/types/web-serial.d.ts`
- `web-client/src/utils/electron.ts`

检查目标：

- `Transport`、gateway、factory、compat 的结构是否变化
- Web / Electron 双运行时装配方式是否变化
- 文档中的连接、控制线、超时、错误传播说明是否仍准确

### 5.5 Protocol

重点文件：

- `web-client/src/protocol/beggar_socket/**`
- `web-client/src/services/debug-protocol-service.ts`
- 相关测试文件

检查目标：

- 命令定义、payload、协议入口是否变化
- 协议层的实际边界是否变化
- 文档中的命令矩阵、请求响应格式、兼容性说明是否仍成立

### 5.6 Services / Adapters

重点文件：

- `web-client/src/services/index.ts`
- `web-client/src/services/serial-service.ts`
- `web-client/src/services/device-connection-manager.ts`
- `web-client/src/services/cartridge-adapter.ts`
- `web-client/src/services/gba-adapter.ts`
- `web-client/src/services/mbc5-adapter.ts`
- `web-client/src/services/mock-adapter.ts`
- `web-client/src/services/flash-chip.ts`
- `web-client/src/services/system-notice-service.ts`
- `web-client/src/services/tool-functions.ts`
- `web-client/src/services/rtc/**`
- `web-client/src/services/lk/**`

检查目标：

- 当前 `services` 目录中有哪些稳定职责
- 是否新增需要单独归类说明的服务子域
- 文档是否仍把已经迁移的职责写在 `services` 中

### 5.7 State / Settings / i18n

重点文件：

- `web-client/src/stores/**`
- `web-client/src/settings/**`
- `web-client/src/i18n/**`
- `web-client/src/components/LanguageSwitcher.vue`
- 相关 modal / 调试面板组件

检查目标：

- 状态、设置、国际化的边界是否变化
- 新增 store、设置项、语言资源是否已反映到文档
- 调试设置或高级设置是否影响主链路描述

### 5.8 Electron Runtime

重点文件：

- `web-client/electron/main.js`
- `web-client/electron/preload.js`
- `web-client/electron/ipc-handlers.js`
- `web-client/electron/security-utils.js`
- `web-client/src/platform/serial/electron/device-gateway.ts`
- `web-client/src/types/electron.d.ts`

检查目标：

- Electron 主进程、preload、IPC、安全边界说明是否仍准确
- Electron 运行时与串口平台层之间的关系是否变化

### 5.9 Dataflows 与横切能力

重点文件：

- `web-client/src/utils/progress/**`
- `web-client/src/utils/parsers/**`
- `web-client/src/utils/rom/**`
- `web-client/src/utils/monitoring/**`
- `web-client/src/utils/markdown.ts`
- `web-client/src/utils/log-viewer.ts`
- `web-client/tests/**`

检查目标：

- 连接、烧录、进度、日志、通知、组装、错误传播等主链路是否变化
- 现有数据流文档是否遗漏新的横切能力

## 6. 每次同步重检的执行步骤

### 步骤 1：盘点当前模块地图

执行内容：

- 列出 `src` 顶层目录
- 识别新增、删除、重命名的目录
- 确认这些变化应映射到哪篇模块文档

产出：

- 当前模块清单
- 文档覆盖映射表

### 步骤 2：核对入口与守卫

执行内容：

- 检查入口文件、路由入口、构建命令、测试命令、依赖检查脚本
- 核对 `00-overview.md` 与 `README.md` 的总览说明

产出：

- 入口/命令/门禁变更清单

### 步骤 3：逐模块核对文档与代码

执行内容：

- 按 `01` 到 `07` 的顺序逐篇核对
- 检查目录、职责、边界、关键对象、关键流程

产出：

- 每篇文档的不一致点列表

### 步骤 4：核对关键数据流

执行内容：

- 对照 `08-dataflows.md` 核对当前实现中的关键链路
- 至少覆盖应用启动、设备连接、烧录主链路、进度/日志回传、结果回流

产出：

- 数据流差异清单

### 步骤 5：统一修正文档

执行内容：

- 仅根据当前代码修正文档
- 删除过期说明，补充缺失说明，修正错误路径和错误职责描述

产出：

- 更新后的模块文档

### 步骤 6：交叉复核

执行内容：

- 检查术语是否统一
- 检查各文档之间是否相互矛盾
- 检查同一个目录是否被重复定义或漏定义

产出：

- 最终重检结果

## 7. 重检输出格式建议

每次重检建议形成一份简短结果记录，至少包含：

1. 本次检查时间
2. 检查范围
3. 发现的不一致项
4. 已修正文档列表
5. 暂未处理项

建议的不一致项记录格式：

- 文档文件
- 对应代码文件/目录
- 不一致类型
  - 目录不匹配
  - 职责描述过期
  - 边界描述错误
  - 数据流描述过期
  - 质量门禁描述过期
- 修正建议

## 8. 每篇文档的最低检查项

### `README.md`

- 阅读顺序是否仍合理
- 模块索引是否覆盖所有主文档
- 维护说明是否仍适用

### `00-overview.md`

- 系统上下文是否仍准确
- 分层结构是否仍准确
- 依赖方向是否仍准确
- 门禁命令是否仍准确

### `01-presentation.md`

- 目录覆盖是否准确
- 页面/组件/容器职责是否准确
- UI 约束是否准确

### `02-application.md`

- 应用层目录与关键对象是否准确
- 编排职责是否准确

### `03-platform-serial.md`

- 平台层目录与抽象是否准确
- Web/Electron 区分是否准确
- 连接与传输契约是否准确

### `04-protocol-beggar-socket.md`

- 协议目录与关键对象是否准确
- 命令说明与格式说明是否准确
- 兼容性说明是否准确

### `05-services-adapters.md`

- `services` 目录覆盖是否准确
- 适配器与辅助服务分类是否准确

### `06-state-settings-i18n.md`

- store、settings、i18n 说明是否准确
- 配置项与语言资源描述是否过期

### `07-electron-runtime.md`

- Electron 目录与 IPC 链路说明是否准确
- 与平台层的桥接关系是否准确

### `08-dataflows.md`

- 关键主链路是否准确
- 横切流程是否遗漏
- 图示与文字是否一致

## 9. 验收标准

完成一次有效的同步重检后，应满足以下条件：

1. 所有模块文档都能在当前代码中找到对应事实依据。
2. 文档中不包含明显脱离当前实现的描述。
3. 新增目录、关键对象、关键流程已被映射到对应文档。
4. `00-overview.md` 与 `08-dataflows.md` 已同步反映关键变化。
5. 文档之间不存在明显相互矛盾的边界定义。

## 10. 风险与控制

### 风险 1：把主观理解写成代码事实

控制方式：

- 所有结论都要能落到具体文件、目录或测试

### 风险 2：只改单篇文档，导致总体失真

控制方式：

- 修改任一模块文档时，至少联动复核 `README.md`、`00-overview.md`、`08-dataflows.md`

### 风险 3：只看目录，不看真实调用关系

控制方式：

- 除目录外，还要核对入口文件、关键流程和测试

### 风险 4：遗留服务层描述持续失真

控制方式：

- 每次重检都单独审视 `services/**` 是否发生职责变化

## 11. 建议结论

后续可将本文件作为 `web-client/docs/modules` 的固定维护基线。

每次文档同步时，不再参考未实施的设计方案，而是严格按以下顺序执行：

1. 读取当前代码事实
2. 核对模块文档
3. 修正文档不一致项
4. 复核总览与数据流文档

这样可以保证模块文档始终服务于“描述当前实现”，而不是混入尚未落地的架构意图。
