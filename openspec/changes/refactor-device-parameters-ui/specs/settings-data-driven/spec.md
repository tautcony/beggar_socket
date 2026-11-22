## MODIFIED Requirements

### Requirement: SettingDescriptor 映射表
参数 schema SHALL 声明配置的键、类型、分组、默认值、校验、存储作用域和呈现信息。存储作用域 SHALL 使用 `scope: 'parameterNamespace' | 'global'`，与 `parametersByNamespace` / `global` 容器一一对应，不得按 binding 各存一份。固件参数 SHALL 由注册定义提供。

#### Scenario: 新增配置项只需添加描述符
- **WHEN** 注册定义新增受支持类型的配置参数
- **THEN** 通用设置读写、校验与表单均识别该参数

### Requirement: getter/setter 自动生成
迁移期间保留的 `AdvancedSettings` 配置访问器 SHALL 委托给同一参数存储与 schema。

#### Scenario: getter 返回正确值
- **WHEN** 旧调用者通过兼容访问器读取仍受支持的设置
- **THEN** 返回参数存储中的同一值或其现有默认值

#### Scenario: setter 触发验证和持久化
- **WHEN** 旧调用者通过兼容访问器写入设置
- **THEN** 系统应用对应校验并将有效值写入参数存储

### Requirement: validateSettings 数据驱动
设置验证 SHALL 使用适用的参数 schema，并继续遵守各项已有校验范围和规范化规则。

#### Scenario: 验证行为不变
- **WHEN** 用户编辑已有 ROM、RAM 页大小、超时或重试参数
- **THEN** 校验遵守对应范围、对齐和默认规则，且界面与存储使用同一声明

### Requirement: 外部 API 不变
仍在使用的通用设置契约 SHALL 通过兼容入口维持。连接、适配器与界面完成迁移后，旧固件选择、Boost 开关及 GBFlash 波特率专用别名 SHALL 由新设置模型取代。

#### Scenario: 现有调用代码无需修改
- **WHEN** 仍使用通用字段的调用者读取或写入已有设置
- **THEN** 通过兼容入口获得等价行为

#### Scenario: Obsolete firmware aliases are removed
- **WHEN** 新设备、固件和参数入口已完成迁移
- **THEN** 应用只通过新模型读写这些配置，旧固件专用别名被清理

## ADDED Requirements

### Requirement: Versioned advanced settings migration
系统 SHALL 将旧版高级设置迁移为 v2，保留可用值及迁移前原始 JSON 副本。保存单一 `selectedVariantId`，不得分别持久化可能组成非法 pair 的设备/固件字段。未知版本 SHALL 安全加载默认设置，并保留原始数据且不得覆盖源记录。

#### Scenario: Legacy STM preference
- **WHEN** 载入旧 `firmware.profile=stm`，且 `stmBoost` 为 `true`、`false` 或缺失
- **THEN** 统一选中 `beggar-stm` / `beggar.stm`，保留 STM 封包配置，不写入一次性弹窗标记，用户可在高级设置另选 Boost

#### Scenario: Legacy STC or GBFlash preference
- **WHEN** 载入旧 `firmware.profile=stc` 或 `flashgbx`
- **THEN** 分别选中 `beggar-stc` / `beggar.stc` 或 `gbflash` / `flashgbx.cfw`
- **AND** 旧 `flashgbxBaudRate` 迁移至 GBFlash 参数，缺失时使用 `auto`

#### Scenario: Unversioned settings with legacy settings fields
- **WHEN** 未版本化的旧数据包含 `profileSizes` 或仅包含 `size`，以及节流、重试或超时设置
- **THEN** 按旧优先级迁移适用的封包值和通用设置，缺失字段使用当前默认值
- **AND** 重复加载 v2 保留已迁移或后来编辑的值

#### Scenario: Unsupported storage version
- **WHEN** 读取无法识别的设置版本
- **THEN** 以内存默认设置启动，不把默认值写回 `advanced_settings`，启动流程继续

#### Scenario: Malformed JSON
- **WHEN** `advanced_settings` 不是合法 JSON
- **THEN** 以内存默认设置启动，不覆盖损坏源记录

#### Scenario: Removed variant or invalid stored variant
- **WHEN** v2 的 `selectedVariantId` 不存在或已不再注册
- **THEN** 返回无效选择（`source: 'invalid'`，空 `variantId`），连接前提示用户在高级设置重新选择设备，不向默认设备发送协议字节

### Requirement: Shared and independent packet settings
标准 STM 与 STM-Boost SHALL 共用一组封包保存值。当 `independentSizes=false` 时 STM 与 STC SHALL 同步 `beggar-sizes` 参数；当 `true` 时 SHALL 分别保存。GBFlash 的封包设置 SHALL 独立于 Beggar。

#### Scenario: Standard STM and Boost edit the same page size
- **WHEN** 用户在任一丐中丐选项下保存合法的读页或写页大小
- **THEN** 切换标准 STM 与 Boost 后都能读到同一保存值，每种固件继续应用各自有效的传输上限

#### Scenario: Linked or independent Beggar settings
- **WHEN** 用户编辑已联动的 Beggar 封包设置或编辑独立的固件设置
- **THEN** `false` 时同步对应 Beggar 参数，`true` 时分别保存，GBFlash 始终使用独立 namespace

### Requirement: Connection and operation settings apply at their configured boundary
标记为需重连的设置 SHALL 在下次建立会话时生效。可即时生效的设置 SHALL 在后续操作开始时读取，并保持当次操作的值。

#### Scenario: Connection baud and operation page size change
- **WHEN** 用户保存新的 GBFlash 波特率和有效的 ROM 读页设置
- **THEN** 活动串口波特率保持当前值直至重连，后续 ROM 读取使用新的页大小并遵守传输上限
