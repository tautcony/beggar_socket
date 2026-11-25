# device-profile-resolution Specification

## Purpose
定义如何注册硬件和固件，以及如何将所选配置与协议探测事实解析成稳定的会话快照，供连接、适配器和操作入口共享。

## Requirements

### Requirement: Stable variant selection provider
Core SHALL expose `SelectionProvider.read(): SelectionSnapshot`（`variantId?`、`source: 'legacy' | 'v2' | 'invalid'`）和最小 `ParameterStore` 实现及 legacy settings adapter。P1/P2 SelectionProvider SHALL be read-only and map legacy `firmware.profile` to a registered `variantId`; ParameterStore SHALL read/write values through the legacy adapter. P3 v2 migration SHALL switch these same interfaces to `selectedVariantId` and namespace storage without changing lifecycle dependencies.

#### Scenario: Lifecycle reads saved selection
- **WHEN** lifecycle starts a connection
- **THEN** it obtains the selected registered variant from the core provider without importing parameters UI modules

#### Scenario: Selection snapshot reports its source
- **WHEN** provider 分别读取 legacy `firmware.profile`、v2 `selectedVariantId` 与无效或缺失的选择
- **THEN** `source` 分别为 `legacy`、`v2`、`invalid`，调用方不需要凭日志猜测选择来自哪里

#### Scenario: Legacy selection before v2 migration
- **WHEN** lifecycle reads selection before P3 migration
- **THEN** legacy `stm`, `stc`, or `flashgbx` maps to the corresponding standard variant, and provider does not write a new selection

#### Scenario: Legacy Boost flag stays out of the provider
- **WHEN** v1 设置同时含 `firmware.profile=stm` 与 `firmware.stmBoost=true`（或 `stmBoost` 缺失）
- **THEN** provider 返回 `beggar-stm`（不再自动探测或提供 `beggar-stm-boost`）

#### Scenario: Core parameter reads before v2 migration
- **WHEN** lifecycle resolves connection baud or an operation reads settings before P3 migration
- **THEN** core ParameterStore reads schema defaults and legacy settings through one adapter without depending on parameters/UI modules

#### Scenario: Core parameter write before v2 migration
- **WHEN** a parameter is changed before P3 migration
- **THEN** the core store validates it and writes through the legacy adapter using the existing persisted field mapping

#### Scenario: Invalid selection stops without silent fallback
- **WHEN** stored selection is absent or no longer registered
- **THEN** the snapshot returns `source: 'invalid'` with empty `variantId`, and connection entry prompts the user to select a device instead of sending bytes to an unconfirmed default

### Requirement: Device and firmware registration
系统 SHALL 分别标识硬件、固件和协议，并通过 `DeviceFirmwareBinding` 显式登记每个合法组合。注册关系 SHALL 支持同一硬件搭配多个固件，以及同一固件供多个硬件使用。选择 API SHALL 接受唯一 `variantId`，拒绝未登记组合。

#### Scenario: Registered product variants
- **WHEN** 消费者枚举已注册的硬件和固件组合
- **THEN** 丐中丐关联 `beggar.stm` 与 `beggar.stm-boost`，碳酸丐关联 `beggar.stc`，GBFlash 关联 `gbflash.cfw`
- **AND** STM 与 Boost 复用 Beggar 协议和 runtime binding、共享参数 namespace；Boost runtime feature 开启传输扩展

#### Scenario: Variant is selected atomically
- **WHEN** 用户选择一个可用 variant
- **THEN** 设备、固件、匹配规则、运行时绑定和参数 namespace 均由同一 binding 解析

#### Scenario: Registry rejects invalid registration
- **WHEN** registration has duplicate device/firmware/variant IDs, unknown references, or an unresolvable runtimeBindingId
- **THEN** registry startup fails with the offending identifier before any connection begins

#### Scenario: Invalid device and firmware pair
- **WHEN** 消费者请求解析某硬件未注册支持的固件
- **THEN** 解析失败并指出该组合无效

### Requirement: Session capability resolution
解析后的能力 SHALL 由硬件门控、固件声明及 typed probe facts 决定。硬件门控只作用于 `cart.powerControl`、`cart.voltageSwitch`、`cart.presenceDetect`、`cart.audioWePin`；`HardwareTraits` 不是 `CapabilityMap`，`rom.*`、`ram.*`、`tool.*`、`profile.*` 从固件声明起步。解析后的 `CapabilitySet` 仅含 supported/unsupported。未声明即不可用；facts 只能收窄或满足已声明条件（base 缺省/unsupported 不可开启，supported 只能被收窄，conditional 只由已注册 rule ID 求值）。ProbeResult 不得提供 capability hints。Boost 传输、模式同步及模拟后端属于 runtime/transport feature，不是用户能力。

#### Scenario: Resolved capability type excludes conditional
- **WHEN** capability declarations 与 typed facts 完成解析
- **THEN** CapabilitySet 只包含 supported/unsupported，不允许 resolved status 保留 conditional

#### Scenario: Probed power capability is unavailable
- **WHEN** GBFlash 固件声明电源控制依赖握手结果，且握手报告无电源控制
- **THEN** 解析后的电源控制能力为不可用，并可查询固件声明的原因

#### Scenario: Facts cannot enable an undeclared capability
- **WHEN** typed probe facts imply an ability not declared by firmware or binding
- **THEN** the resolver leaves that capability unsupported

#### Scenario: Non-hardware capabilities do not require hardware traits
- **WHEN** 固件声明 `rom.read` 或 `tool.rumble.gba`，而对应 `HardwareTraits` 没有同名字段
- **THEN** 这些能力按固件声明解析，不因硬件特性缺项被误判为 unsupported；硬件门控只影响四个 `cart.*` 键

### Requirement: Capability matrix is normative
四种固件对每个 `CapabilityKey` 的取值 SHALL 由 core design 的「能力矩阵」逐项确定，并作为注册定义与测试中 `baseCapabilities` 的唯一依据。每个固件定义 SHALL 为矩阵中的每一行给出声明（`supported` / `unsupported` 带原因 / `conditional` 带 rule ID），不得留空；新增 `CapabilityKey` 或新增固件时 SHALL 同步更新矩阵与测试。条件能力只允许使用已注册 rule ID：`gbflash.power-control-present`、`gbflash.audio-write-enabled`、`gbflash.presence-detect-present`。没有实现证据的能力 SHALL 声明为 `unsupported` 并注明待真机确认，不得默认开启。

#### Scenario: Every capability has a per-firmware value
- **WHEN** 注册表装配四个固件定义
- **THEN** 矩阵中的每个 capability key 在四个定义中都有明确声明，测试遍历矩阵断言解析结果与声明一致

#### Scenario: New capability cannot skip the matrix
- **WHEN** 开发者新增一个 `CapabilityKey`
- **THEN** 类型检查或矩阵测试失败，直到四个固件都给出声明

#### Scenario: FlashGBX RTC remains available in matrix
- **WHEN** 解析 GBFlash 会话
- **THEN** `tool.rtc.gba` 与 `tool.rtc.mbc3` 按矩阵解析为可用（具体实现待完善，保留现有 UI 与服务行为）

### Requirement: Immutable resolved device profile
成功解析的 session profile SHALL 为不可变快照，包含 `variantId`、实际硬件与固件、能力、连接参数、最终传输 profile、verification、显示模型与 `diagnostics`。不得在公开的 `SessionProfile` 上暴露协议 raw probe facts。可变的 ROM/RAM 页大小、节流和重试等操作参数不得作为 session profile 的权威值；每次操作开始时生成独立 `OperationSettingsSnapshot`。

#### Scenario: Shared firmware resolves device-specific profile
- **WHEN** 同一固件注册到两个硬件且以其中一个硬件解析
- **THEN** 快照保留所选硬件及该组合解析后的能力和显示信息

#### Scenario: Session retains selected variant identity
- **WHEN** 同一 device/firmware pair 对应多个合法 binding 且建立其中一个 session
- **THEN** SessionProfile 保留所选 `variantId`，并只公开规范化 binding metadata

#### Scenario: Definitions reused across connections
- **WHEN** 使用同一定义和不同握手事实解析两次
- **THEN** 两个快照分别反映各自探测事实，已有快照和静态定义保持原值

#### Scenario: Operation settings change during a session
- **WHEN** 保存新的即时生效参数并开始下一次操作
- **THEN** 新操作读取新的设置快照，已开始的操作保留其原快照，session profile 不变

#### Scenario: Protocol facts remain internal
- **WHEN** 连接成功并向应用公开活动 `SessionProfile`
- **THEN** `SessionProfile` 只提供规范化能力、版本、显示信息、`diagnostics`，不包含 raw protocol facts；过渡期 `BurnerConnectionSession.probeFacts` 仍用于填充旧 `DeviceInfo.gbflashInfo` 外观，并为 GBFlash 命令客户端提供固件信息

#### Scenario: Diagnostics carry the reason, not only the log
- **WHEN** 解析期间发生端口 mismatch、探测跳过或驱动报告非致命异常
- **THEN** `SessionProfile.diagnostics` 含对应 `DeviceDiagnostic`（`code`、`severity`、`message`、`stage`），界面与调用方无需解析日志文本

### Requirement: Typed runtime binding assembly
`RuntimeBinding<TFacts>` SHALL 同时约束 `driver: ProtocolDriver<TFacts>` 与 `displayContributor: DisplayContributor<TFacts>`，使其在定义处闭合；`DisplayContributor` SHALL NOT 在 `build` 方法上使用方法级泛型。`SessionResolver.resolve<TFacts>` SHALL 保留泛型签名，不得退化为 `ProbeResult<unknown>`。

#### Scenario: Contributor only accepts its own facts
- **WHEN** 为 FlashGBX 定义 `RuntimeBinding<FlashgbxProbeFacts>`
- **THEN** 其 driver 与 display contributor 均只接受 `FlashgbxProbeFacts`，把 Beggar facts 传入时类型检查失败

### Requirement: Boost transport feature resolution
`runtimeFeatures.boostTransport` SHALL 由解析规则唯一决定，不由 connection lifecycle 手工赋值：当 `selection.variantId === 'beggar-stm-boost'` 且（`probe.verification === 'verified'` 或 `transportFacts.backend === 'simulated'`）时为 `true`，其余为 `false`。Boost variant 在真实串口上若 `verification !== 'verified'`，`resolve` SHALL 失败，不得降级为普通 STM。

#### Scenario: Verified Boost session
- **WHEN** 选择 `beggar-stm-boost` 且 Boost 握手成功
- **THEN** `SessionProfile.runtimeFeatures.boostTransport === true`，无需 lifecycle 额外补写

#### Scenario: Standard STM session
- **WHEN** 选择 `beggar-stm` 且端口验证为 `assumed`
- **THEN** `boostTransport === false`

#### Scenario: Simulated Boost session
- **WHEN** 模拟 backend 选择 `beggar-stm-boost`
- **THEN** 跳过探测且 `boostTransport === true`，其它模拟会话保持 `false`

#### Scenario: Boost variant without verification fails
- **WHEN** 选择 `beggar-stm-boost` 但真实串口探测未返回 `verified`
- **THEN** `resolve` 以验证失败结束，不发布标准 STM 会话

### Requirement: Transitional firmware profile compatibility
迁移期间，旧 profile 入口 SHALL 从注册定义或已解析会话派生旧字段，并保留 STM、STC、FlashGBX 和旧未知设备的兼容行为。

#### Scenario: Existing consumers use legacy profile access
- **WHEN** 尚未迁移的调用者读取旧 profile
- **THEN** 它取得旧格式的 ID、标签、限制和能力，新会话的固件身份仍可从解析后的 profile 取得
