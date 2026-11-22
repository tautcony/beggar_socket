# Design

## Context

`AdvancedSettings` 当前将旧设备选择、按 profile 的页大小和通用设置保存到 `localStorage` 的 `advanced_settings`。现有快照可能未显式版本化，也可能只有旧 `size` 字段。依据见 [设计文档 §4.5 与 §7](../../../docs/device-abstraction-design.md)。

## Goals / Non-Goals

- 将保存的设备、固件和连接参数交给同一设置入口，以 schema 驱动参数校验和表单。
- 维持现有有效参数、操作行为、五种语言和 Tauri 命令契约。v2 为单向迁移。

## Decisions

### 参数 schema 与生效时机

沿用已有校验和默认值规则，将设备参数声明放到注册定义。参数存储提供 binding namespace（`parametersByNamespace`）和全局（`global`）作用域，STM 与 Boost 通过 binding 的 `parameterNamespace: beggar.stm` 读取同一份参数。`independentSizes=false` 时 STM/STC 通过 schema `linkGroup=beggar-sizes` 同步，`true` 时分别保存，GBFlash 保留独立值。

活动会话绑定建立时的 variant、设备、固件和实际波特率。SessionProfile 只固定连接生命周期值。为兼容 ROM 读页即时生效契约，页大小、throttle、retry 等在每次操作开始时生成 `OperationSettingsSnapshot`，再结合 session 的能力和 ResolvedTransportProfile 解析；已开始操作持有自己的快照。运行中的操作保留其读取到的值。表单以 schema 校验输入，兼容 API 保留已有规范化行为。

### 存储迁移

v2 保存单一 `selectedVariantId`（对应 `DeviceFirmwareBinding.id`）、`parametersByNamespace`（固件参数）、`global`（`throttle` / `retry` / `timeout` 通用设置）和 `independentSizes`（联动状态，现有默认 `false`）。识别无版本旧数据和 v2。旧 `profileSizes` 优先于 `size`，沿用旧默认页归一化逻辑。保留有效节流、重试、超时和波特率，并在缺少值时应用默认值。旧 `stmBoost` 不再保留运行时探测或一次性弹窗标记，任何旧 STM 选项直接迁移为标准 STM，由 Boost 用户在高级设置手动选择「丐中丐（Boost）」。

参数 descriptor 的存储作用域字段为 `scope: 'parameterNamespace' | 'global'`，与 `parametersByNamespace` / `global` 两个容器一一对应；不得实现为"每个 binding 一份"，因为 STM 与 Boost 共享同一 namespace。

迁移时尽力将旧 JSON 备份至 `advanced_settings_v1_backup`（失败忽略）并写入 v2。遇到损坏 JSON 或未知版本直接以内存默认值运行，不阻断启动或写回损坏源；迁移和重复加载不得覆盖后来保存的设置。

### 会话驱动的界面

高级设置提供四个选项及重连提示，并同时展示真实活动会话配置。操作面板查询能力及不可用理由。服务层沿用同一判定，按 GBA/DMG 模式和会话能力保留 RTC、震动、PPB、FRAM、供电控制和烧录卡 profile 的现有可用性。烧录卡 profile 改用数据库能力判断，电压与 AUDIO/VIN 写使能校验继续保留。迁移完成后移除旧设备分支和专用标志，并用现有架构检查验证依赖方向。

## Risks / Trade-offs

- 旧 Boost 自动探测用户升级后需要明确选定 Boost。迁移测试和高级设置提示覆盖这一变化。
- 设置的显示值、实际协议上限和宿主推荐值可能不同。GBFlash 封包输入仍允许 `0x2000`，实际传输继续按 CH340/CDC 帧限制。
- 旧兼容字段易形成第二份状态。用同一存储和会话提供兼容视图，待所有调用方迁移完再移除专用别名。

## Migration Plan

依赖 core 中的 SelectionProvider 和 lifecycle 的活动 session；lifecycle 不依赖此 UI/schema change，因此三项变更可按 core → lifecycle → parameters/UI 顺序交付。通过旧格式测试夹具、五种语言检查和 Web/Tauri 回归验证后清理兼容字段。原始 JSON 仅用于异常恢复。
