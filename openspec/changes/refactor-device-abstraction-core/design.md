# Design

## Context

`types/firmware-profile.ts` 目前同时定义型号、旧能力和传输上限，`DeviceConnectionManager` 再用探测结果覆盖部分字段。设计依据见 [设备抽象层重设计](../../../docs/device-abstraction-design.md)。

## Goals / Non-Goals

- 建立可独立测试的硬件、固件、协议和解析快照边界。
- P0/P1 保持现有连接入口、设置文件和协议行为。运行路径切换由后续 change 负责。

## Decisions

### 注册关系与组装职责

在 `web-client/src/device/` 注册三种硬件、四种固件和显式 `DeviceFirmwareBinding`。Device 只保存硬件属性；Firmware 只保存协议、能力声明和参数；Binding 保存 USB 发现过滤、身份 matcher、transport 要求、参数 namespace 和 runtime binding ID。该 ID 是 driver、adapter factory、display contributor 与 mode sync strategy 的唯一实现路由来源。核心同时提供最小 `ParameterStore` 和 `SelectionProvider`；P1/P2 通过 legacy adapter 从旧 `firmware.profile` 映射 variant，选择只读，参数读写委托旧 settings。P3 完成 v2 migration 后将同一 provider/store 切换到 `selectedVariantId` 与 namespace 存储。

标准 STM 与 Boost 通过共享基础固件定义辅助函数复用共用的声明和实现，不再维护通用 `extends` 继承器与环检测。Boost 在同一硬件下注册独立固件 ID，继承 STM 的实现 ID，binding 指向共享 `beggar.stm` 参数 namespace。具体 driver、adapter、display 实例只由 composition registry 注入，纯定义不得导入 services/adapters。

### 分层：纯定义层与装配层

`src/device/` 只放类型、registry、能力规则、参数 schema 和纯数据模型；`src/device-runtime/` 放 `RuntimeCompositionRegistry`、`SessionResolver`、`drivers/`、`display-contributors/` 与 `adapters/`。driver 必然调用 `protocol/`，adapter 必然实现 `services/adapters` 的契约，因此它们不能放在被禁止依赖这些目录的 `src/device/` 里，也不为 `device/drivers/` 开任何特例。`SessionProfile` 的解析放在 `device-runtime/session-resolver.ts`，因为解析需要 runtime binding 与 typed probe facts；`DeviceRegistry` 只负责注册、选择与端口匹配。

### 解析后的值与协议事实

解析过程接收 binding、参数、协议事实和 transport facts。Capability 只表示业务操作；实现策略属于 `RuntimeFeatures`。条件能力使用注册的 rule ID。能力合成顺序固定为：`cart.*` 中与 `HardwareTraits` 有对应项的键先过硬件门控（`HardwareTraits` 不是能力表，`rom.*`/`ram.*`/`tool.*`/`profile.*` 没有硬件层）→ `FirmwareDefinition.baseCapabilities` → probe 收窄。后两步只能收窄，不能开启硬件或矩阵未允许的项。`RuntimeBinding<TFacts>` 把 driver 与 display contributor 绑定到同一 facts 类型，`InternalResolveContext<TFacts>` 只在解析阶段存在；最终 public `SessionProfile` 仅保留规范化结果与 `diagnostics`。

`SessionProfile` 固定设备/固件、能力、连接参数、传输限制、显示信息与诊断；`OperationSettingsSnapshot` 在每次操作开始从 ParameterStore 读取 ROM/RAM page size、throttle、retry 等参数。传输限幅直接来自 binding 的 `transport.packetLimits`（当前 GBFlash CH340 与 CDC 数值一致，不再按 USB variant 分表或拒绝 unknown）。public session 只暴露规范化能力、版本、display 和 diagnostics，不暴露 raw probe facts。

### Runtime binding 的类型闭环

```ts
export interface RuntimeBinding<TFacts> {
  readonly driver: ProtocolDriver<TFacts>;
  readonly displayContributor: DisplayContributor<TFacts>;
  readonly adapterFactory: AdapterFactory;
  readonly modeSyncStrategy?: ModeSyncStrategy;
}
```

泛型必须绑定在 binding 上而不是 `build<TFacts>()` 方法上：方法级泛型等于"任意 facts 都能处理"，FlashGBX contributor 与 Beggar facts 配错无法被发现；`RuntimeBinding<FlashgbxProbeFacts>` 才能在定义处闭合。`RuntimeCompositionRegistry.resolve<TFacts>(id)` 是全项目唯一的类型断言点，不再额外维护 `factsKind` 字符串交叉校验。`SessionResolver.resolve<TFacts>(selection, probe: ProbeResult<TFacts>, transportFacts, store)` 的签名保留泛型，避免在入口处退化为 `ProbeResult<unknown>`。

### `boostTransport` 的解析规则

`runtimeFeatures.boostTransport` 不由 lifecycle 手工赋值：当 `selection.variantId === 'beggar-stm-boost'` 且（`probe.verification === 'verified'` 或 `transportFacts.backend === 'simulated'`）时为 `true`，否则为 `false`；Boost variant 在真实串口上若 verification 不是 `verified`，`resolve` 直接失败而不降级为 `false`。

### 兼容门面

旧 API 优先从已有会话派生 profile。没有会话的旧调用按现有配置或推断入口得到兼容格式。Boost 在旧视图仍兼容 STM ID 及原 Boost 能力位，新的 profile 保留 Boost 固件 ID。未知设备的宽松默认值只存在于旧门面，新解析能力缺省为不可用。

把纯定义、工厂接线和类型导出分开。`types/firmware-profile.ts` 不在运行时导入依赖 `services/` 的驱动或工厂模块；`src/device/` 与 `src/device-runtime/` 也不得被 `types/` 反向依赖（仅允许 type-only）。

## 能力矩阵（规范性）

以下是四个固件对每个 `CapabilityKey` 的取值，注册定义与测试以此为准。`✗` 表示 `unsupported` 并需带原因；`条件(rule)` 表示 `conditional`；`待确认` 表示按 `unsupported` 声明并标注待真机确认。

| CapabilityKey | beggar.stm | beggar.stm-boost | beggar.stc | flashgbx.cfw |
|---|---|---|---|---|
| rom.read / rom.write / rom.verify.crc | ✓ | ✓ | ✓ | ✓ |
| rom.erase.chip | ✓ | ✓ | ✓ | ✓ |
| rom.erase.sector | ✓ | ✓ | ✓ | ✓ |
| rom.bankSwitch.32M | 待确认 | 待确认 | 待确认 | 待确认 |
| ram.read / ram.write | ✓ | ✓ | ✓ | ✓ |
| ram.fram.gba | ✓ | ✓ | ✗ | ✓ |
| ram.fram.gbc | ✓ | ✓ | ✓ | ✓ |
| cart.powerControl | ✗ | ✗ | ✓ | 条件(`gbflash.power-control-present`) |
| cart.voltageSwitch | ✗ | ✗ | ✗ | ✓ |
| cart.presenceDetect | ✗ | ✗ | ✗ | 条件(`gbflash.presence-detect-present`) |
| cart.audioWePin | ✗ | ✗ | ✗ | 条件(`gbflash.audio-write-enabled`) |
| tool.rtc.gba / tool.rtc.mbc3 | ✓ | ✓ | ✓ | ✓（具体实现待完善，保留现有 UI/服务可用） |
| tool.rumble.gba | ✓ | ✓ | ✓ | ✓ |
| tool.debug | ✓ | ✓ | ✓ | ✗ |
| tool.ppbUnlock | ✓ | ✓ | ✓ | ✗ |
| profile.flashcartDb | ✗ | ✗ | ✗ | ✓ |

`rom.bankSwitch.32M` 在适配器中已有切 bank 实现但暂未接入能力开关，P1 先声明为 `unsupported` 并标注待确认，同时不得借该键拦截现有 32 MiB 以上切 bank。

矩阵是四个固件 `baseCapabilities` 的**唯一依据**。

## 装配与解析的单一来源

- `SessionResolver.resolve(selection, probe, transportFacts, store)`（`src/device-runtime/session-resolver.ts`）是唯一的会话解析入口，只从 `binding.runtimeBindingId` 取 `RuntimeBinding`，不再额外接收 runtime 参数，避免 binding 与实例两个真源。`DeviceRegistry` 不再承担解析职责。
- 驱动不得通过探测结果改写固件身份。
- `cart.audioWePin` 等同时出现在硬件特性和能力表的项，合成顺序固定为：`cart.*` 硬件门控 → `FirmwareDefinition.baseCapabilities` → probe 收窄。硬件门控只作用于 `cart.powerControl` / `cart.voltageSwitch` / `cart.presenceDetect` / `cart.audioWePin` 这四个有硬件对应项的键；`HardwareTraits` 不是 `CapabilityMap`，`rom.*`、`ram.*`、`tool.*`、`profile.*` 直接从 `baseCapabilities` 起步。后两步都只能收窄，不能开启硬件或矩阵未允许的项。
- `TransportRequirements.packetLimits` 为所有绑定提供统一限幅来源（不再按 `ch340`/`cdc`/`default` 分表）。

## 生命周期类型补充

```ts
export interface TransportFacts {
  readonly backend: TransportBackend;
  readonly usb?: { readonly vendorId?: string; readonly productId?: string };
}

export interface PendingSession {
  readonly transport: Transport;
  readonly selection: ResolvedVariantSelection;
  readonly portInfo?: SerialPortInfo;
  readonly transportFacts: TransportFacts;
}

export interface ActiveSession {
  readonly profile: SessionProfile;
  readonly transport: Transport;
  readonly connectionId: string;
}

export interface SelectableVariant {
  readonly variantId: VariantId;
  readonly deviceName: DisplayText;
  readonly firmwareName: DisplayText;
}

export class ParameterError extends Error {
  readonly namespace: string;
  readonly key: string;
  readonly reason: string;
}

export interface SelectionSnapshot {
  readonly variantId?: VariantId;
  readonly source: 'legacy' | 'v2' | 'invalid';
}

export interface DeviceDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: DisplayText;
  readonly stage?: 'selection' | 'transport' | 'probe' | 'resolve' | 'initialize' | 'disconnect';
}
```

`SessionProfile.diagnostics` 使用 `DeviceDiagnostic`。端口 mismatch（`port-mismatch`）、模拟跳过探测（`probe-skipped`）、收尾命令失败（`teardown-failed`）都产出诊断条目；调用方与界面只读取 `SessionProfile.diagnostics`，日志是渲染结果而不是唯一记录位置。无效或未注册的已保存选择由 `SelectionProvider.read()` 返回 `source: 'invalid'` 与空 `variantId`，连接入口提示用户选择设备。

## 依赖边界

`src/device/` 是纯定义层：只可依赖 `types/` 与彼此，禁止导入 `services/`、`platform/`、`protocol/`、`components/`、`views/`、`device-runtime/`。`src/device-runtime/` 是装配层：可依赖 `device/`、`protocol/`、`platform/`、`services/adapters` 与 `types/`，禁止导入 `components/`、`views/`。

`scripts/check-architecture-deps.cjs` 现在没有覆盖这两个目录，需同时新增规则并加测试：`device/* → services|platform|protocol|components|views|device-runtime` 越界即失败；`device-runtime/* → components|views` 越界即失败；`types/*` 导入 `device/*` 或 `device-runtime/*` 仅允许 type-only。P0 建立 `device-runtime/` 骨架时就写入这条规则（该目录此时只有 `composition-registry.ts` 与 `session-resolver.ts`），P2 新增 driver 时无需再改脚本。规则与其测试属于本 change 交付物，否则 tasks 1.1 声称的"依赖方向已验证"不成立。

## Risks / Trade-offs

- 同一个字段可能同时存在于旧门面和新模型。以解析过的会话为权威来源，通过旧 profile 测试确认映射。
- 定义继承可能引入隐式行为。Boost 只覆盖已确认的差异，并验证它仍使用共用 STM 封包配置。
- 能力与设备身份易再次耦合。能力矩阵按当前功能逐项对照，协议选择留在装配策略中。
- P0 的 driver 是测试桩，可能与 P2 真实 driver 的 facts 形态不一致。P2 替换时复用同一 `RuntimeBinding<TFacts>` 契约测试。

## Migration Plan

P1 同时交付可用的最小 ParameterStore 与 legacy adapter，因此 P2 lifecycle 可独立读取波特率和连接参数。先接入旧 profile 门面，再由 P3 将底层 adapter 切换到 v2 存储格式；最后清理过渡字段。
