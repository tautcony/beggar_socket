# Implementation Notes — refactor-device-abstraction-core

> 本文件记录本次实施的交付清单、与 `design.md` 的偏差、验证证据与待确认决策。
> 它不替代 `spec.md` / `design.md`：spec 描述「应该是什么」，本文件描述「实际做了什么、为什么」。
>
> - 状态：实现完成，待复核（verify）
> - 最后更新：2026-11-22
> - 关联：`proposal.md`、`design.md`、`specs/device-profile-resolution/spec.md`、`tasks.md`

## 1. 状态快照

| 项目 | 结果 |
|---|---|
| tasks 进度 | 9/9（`openspec instructions apply` → `state: all_done`） |
| 规格校验 | `openspec validate refactor-device-abstraction-core` 通过 |
| `npm run type-check` | 通过 |
| `npm run check:deps` | 无违规（矩阵含 `device -> types (type)`、`device-runtime -> device`） |
| `npm run test:run` | 98 文件 / 1209 用例全部通过（基线 90 / 1136，+8 文件 / +73 用例） |
| `npm run lint` | 全仓 0 error |
| git | 未提交，改动全部在工作区 |

## 2. 交付清单

### 2.1 新增：纯定义层 `web-client/src/device/`（17 文件 / 1900 行）

| 文件 | 职责 |
|---|---|
| `types.ts` | Device / Firmware / Binding、`VariantId`、`SelectableVariant`、`ResolvedVariantSelection`、`SelectionSnapshot/Provider`、`DeviceRegistry` 契约；Firmware 不含 implementation id，`binding.runtimeBindingId` 是唯一实现来源 |
| `usb-identity.ts` | `normalizeUsbId` / `matchUsbIdentity` / `formatUsbIds` / `describeIdentityMatchers`；registry 与解析器共用同一套匹配语义（见 §8 W1） |
| `capabilities.ts` | 20 个 `CapabilityKey`、三态声明（available / conditional / unsupported）、3 个 rule ID、单向合成（`cart.*` 硬件门控 → baseCapabilities → probe 收窄）、`RuntimeFeatures` |
| `parameters.ts` | Parameter schema / descriptor、`ParameterError`、legacy-backed `ParameterStore`、`OperationSettingsSnapshot`、14 个 global 参数 |
| `session.ts` | `TransportFacts`、`PendingSession`、`ActiveSession`、`ProtocolDriver`、`ProbeResult`（含驱动非致命 `diagnostics`）、`SessionProfile`、`DeviceDiagnostic`、`DisplayContributor` |
| `registry.ts` | 注册、校验（variant↔device↔firmware 组合）、USB 过滤、端口匹配、namespace schema 解析 |
| `selection.ts` | legacy 只读 `SelectionProvider`（`source: 'legacy' \| 'v2' \| 'invalid'`） |
| `display.ts` / `hardware.ts` | `DeviceDisplayModel`、`HardwareTraits`（明确不是能力表） |
| `definitions/` | 3 设备 / 4 固件 / 4 binding，能力矩阵逐键声明；Boost 复用 `beggar.stm` namespace 与 `beggar` runtime，仅 `maxReadChunk`（0x2000）不同 |
| `definitions/packet-limits.ts` | 按宿主 × 固件的包长表（单一来源，同时供旧 `platform-packet-policy` 读取） |
| `compat/firmware-profile.ts` | 旧 `FirmwareProfile` 门面，从注册定义派生；未知设备的宽松能力只存在于此 |
| `index.ts` | 公共出口 |

### 2.2 新增：装配层 `web-client/src/device-runtime/`（9 文件 / 613 行）

| 文件 | 职责 |
|---|---|
| `composition-registry.ts` | `RuntimeCompositionRegistry`、`RuntimeBinding<TFacts>`，泛型在定义处闭合；`resolve()` 是全项目唯一类型断言点 |
| `session-resolver.ts` | `SessionResolver.resolve(selection, probe, transportFacts, store)` 单一解析入口；`boostTransport` 派生规则；`port-mismatch` / `probe-skipped` 与驱动诊断汇入 `diagnostics`；profile 冻结 |
| `runtime-bindings.ts` | `beggar` / `flashgbx` 两个 runtime 的绑定与注入 |
| `drivers/` | `beggar-driver.ts`、`flashgbx-driver.ts`（P0 阶段为测试桩，见 §5） |
| `display-contributors/` | `beggar.ts`、`gbflash.ts` |
| `adapters/legacy-settings-adapter.ts` | 把旧 `AdvancedSettings` 适配成 `ParameterStore` |
| `index.ts` | 装配根 `createDeviceRuntime()` |

### 2.3 既有文件改动（26 文件，+171 / −255）

| 文件 | 改动 | 目的 |
|---|---|---|
| `scripts/check-architecture-deps.cjs` | `checkViolation` 增加导入 `kind`（`type` / `runtime`），新增 3 条规则 | 让两层依赖方向可验证，而非口头约定 |
| `src/types/firmware-profile.ts` | 190 → 30 行，只保留 `FirmwareProfile*` 类型 | 满足 `types/*` 不得运行时依赖 `device/*` |
| `src/types/host-platform.ts`（新增，17 行） | `HostPlatform` / `PlatformPacketLimits` / `HostPacketLimits` | 让 device 定义可声明宿主相关的包长而不反向依赖 `platform/` |
| `src/platform/serial/platform-packet-policy.ts` | 删除三张表，改为从 `device/definitions/packet-limits` 引用；宿主类型改为 re-export | 包长数值单一来源（P4 删除此桥） |
| `src/settings/advanced-settings.ts` | 新增 `setProfileSize()`（+18 行） | 允许写非激活 profile 的尺寸，参数 schema 默认值需要 |
| `src/services/*`（5 文件） | 仅改导入路径（`types/firmware-profile` → `device/compat/firmware-profile`），类型单独 type-import | 旧读取入口接到兼容门面，断言零改动 |
| `src/components/CartBurner.vue`、`modal/AdvancedSettingsModal.vue` | 仅改导入路径 | 同上 |
| 13 个既有测试文件 | 仅改导入路径 | 同上；`beggar-boost.test.ts` 因排序多 8 行 |

### 2.4 新增测试（8 文件 / 1244 行 + 1 helper 92 行 + 架构用例 69 行）

| 文件 | 覆盖点 |
|---|---|
| `tests/device/capability-matrix.test.ts` | 遍历每个 `CapabilityKey` × 4 固件，与规范矩阵逐项比对；新增 key/固件时失败 |
| `tests/device/capabilities.test.ts` | 单向 lattice、硬件门控只作用于 4 个 `cart.*`、probe 只能收窄、facts 不进入 public session |
| `tests/device/registry.test.ts` | 注册校验、USB 分类、端口匹配、非法组合拒绝 |
| `tests/device/parameters.test.ts` | schema 默认值、namespace 隔离、即时快照、`source: 'invalid'` 不静默回落 |
| `tests/device-runtime/session-resolver.test.ts` | 单一来源、`boostTransport` 四种组合、Boost 未验证即失败、两个快照隔离、诊断（`port-mismatch` / `probe-skipped` / 驱动诊断合并与冻结） |
| `tests/device-runtime/composition-registry.test.ts` | 泛型闭环、未知 id 报错 |
| `tests/device-runtime/device-runtime.test.ts` | 装配根可解析 + 未接线 runtime 快速失败 |
| `tests/device/compat-firmware-profile.test.ts` | 旧 ID、Boost 兼容视图、未知设备兜底 |
| `tests/architecture-deps.test.cjs`（改） | +11 用例：device 六向越界、device-runtime→UI、types 仅 type-only、循环检测 |

## 3. 相对 design 的偏差（待确认）

编号用于 §6 的决策记录，也用于 review 时逐条对照。

### D1 `TransportRequirements.maxReadChunk`

- **design**：传输限幅只来自 `transport.packetLimits`。
- **实现**：`TransportRequirements` 额外加 `maxReadChunk?: number`。
- **原因**：task 2.3 要求「STM / STC / Boost / GBFlash 的约束可分别表达」。Boost 的 0x2000 与 STC 的 0x8000 是固件读上限，不是宿主包长，塞进按宿主展开的 `packetLimits` 会变成三份重复值。
- **影响**：`packetLimits` 语义保持「宿主包长」，`maxReadChunk` 表达「固件读上限」，两者在解析时取 min。新增字段为可选，不影响已有 binding。

### D2 `FirmwareDefinition.parameters` 改为工厂

- **design**：参数 schema 作为静态声明。
- **实现**：`parameters: (ctx: { platform, transport }) => ParameterSchema`。
- **原因**：参数默认值依赖宿主与 binding 的 `packetLimits`（如 ROM page size 的初始上限），静态数组表达不了。
- **影响**：注册表在解析 namespace 时调用工厂；纯数据性略降，但仍在定义层内闭合（不导入 platform 实现）。

### D3 `RuntimeBinding.capabilitySignals?()`

- **design**：`RuntimeBinding` 只有 `driver` / `displayContributor` / `adapterFactory` / `modeSyncStrategy` 四个成员；`resolve()` 保持四参数。
- **实现**：增加第 5 个可选成员 `capabilitySignals?(facts): CapabilitySignals`。
- **原因**：条件能力（如 `gbflash.power-control-present`）需要从 typed probe facts 归一成规则信号；若塞进 `resolve()` 第 5 个参数，就会在入口处退化为 `unknown` 或需要类型断言。放在 binding 上可让 facts 类型在同一处闭合。
- **影响**：未提供时条件能力保持不可用（安全方向）；解析器内无类型断言。

### D4 旧 `FirmwareProfile` 常量的落点

- **design**：在 `types/firmware-profile.ts` 内派生旧 profile。
- **实现**：`types/firmware-profile.ts` 只留类型；常量、推断与辅助函数移到 `device/compat/firmware-profile.ts`。
- **原因**：task 1.2 要求 `types/*` 只能 type-only 引用 `device/*`，与「types 里派生值」直接冲突；design §4 的文件布局本身也指向 `device/compat/`。
- **影响**：6 个 src 文件 + 13 个测试文件各改一行导入路径，断言零改动；`npm run check:deps` 通过。

### D5 包长表下沉 + `setProfileSize()`

- **design**：`platform/serial/platform-packet-policy.ts` 持有包长表；`AdvancedSettings` 无写非激活 profile 的方法。
- **实现**：数值迁到 `device/definitions/packet-limits.ts`，旧文件保留 `PLATFORM_PACKET_LIMITS` 映射并 re-export 宿主类型；`AdvancedSettings.setProfileSize()` 为新增方法。
- **原因**：避免同一组数值在 device 与 platform 两处漂移；参数 schema 默认值需要写非激活 profile 的尺寸。
- **影响**：新增 `platform → device` 单向引用（架构规则未禁止，且 device 侧不反向依赖 platform）；P4 清理旧 profile 时一并删除该桥。

### D6 废弃标记用文字而非 `@deprecated`

- **design**：未指定。
- **实现**：`types/firmware-profile.ts` 与 `device/compat/firmware-profile.ts` 用「Deprecated (removed in P4)」文字说明，不加 `@deprecated` JSDoc 标签。
- **原因**：启用该标签会让 9 个既有文件触发 `no-deprecated` 规则变红，收益仅是编辑器提示，代价是全仓改动。
- **影响**：P4 删除时按文件清单 grep 即可定位，不依赖 IDE 删除线。

### D7 `DeviceRuntimeOptions.composition` 注入

- **design**：装配根内部直接构造 composition。
- **实现**：`createDeviceRuntime({ platform?, composition? })`，默认 `createRuntimeComposition()`。
- **原因**：需要一个能验证「binding 指向未接线 runtime 时快速失败」的测试缝；同时为后续 change 替换真实 driver 留出注入点。
- **影响**：仅测试与装配层使用，UI 调用方不传该参数。

## 4. 验证证据

```bash
# web-client/
npm run type-check        # 通过
npm run check:deps        # 无违规
npm run test:run          # 98 files / 1209 tests passed
npm run lint              # 0 error

# repo root
openspec validate refactor-device-abstraction-core
openspec instructions apply --change refactor-device-abstraction-core --json   # state: all_done
```

架构规则的实际效果（`check:deps` 输出的矩阵中可见）：

- `device -> types` 仅 type 边
- `device -> device-runtime`、`device -> services|platform|protocol|components|views` 均被拦截
- `device-runtime -> components|views` 被拦截
- `types -> device|device-runtime` 仅 type 边

另外逐条核对了 `spec.md` 的「Diagnostics carry the reason, not only the log」场景，结论与修复见 §8。

## 5. 遗留事项（交接给后续 change）

| 项 | 说明 | 归属 |
|---|---|---|
| driver / adapterFactory 为桩 | `createPendingAdapterFactory` 与 P0 driver 只保证契约闭合，调用即抛错 | `refactor-device-lifecycle-drivers`（P1/P2） |
| 运行路径未切换 | `DeviceConnectionManager` 仍走旧 `FirmwareProfile`，新解析入口尚未接入连接流程 | P2 |
| 选择只读 | `SelectionProvider` 仍从 legacy profile 映射，写回与 v2 存储未做 | P3 |
| `PLATFORM_PACKET_LIMITS` 桥 | 旧 profile id → 新包长表的过渡映射 | P4 删除 |
| `types/firmware-profile.ts` | 仅剩类型，作为旧视图兼容 | P4 删除，调用方改用 `SessionProfile` |
| `rom.bankSwitch.32M` | 按 `unsupported` 声明并标注待真机确认，不得借该键拦截现有 >32MiB 切 bank | 真机确认后更新矩阵 |
| `tool.rtc.*` | FlashGBX 声明可用（保留现有 UI/服务），具体实现待完善 | 后续实现 change |

## 6. 决策记录

复核时逐条标记；未标记的视为默认接受当前实现。

| ID | 决策点 | 建议 | 结论 |
|---|---|---|---|
| D1 | 新增 `maxReadChunk` | 接受（表达固件读上限，与宿主包长分离） | ☐ 接受 ☐ 改为其它落点 |
| D2 | 参数 schema 工厂化 | 接受（默认值依赖宿主与 binding） | ☐ 接受 ☐ 改回静态 |
| D3 | `capabilitySignals` 第 5 成员 | 接受（避免类型断言与 `resolve()` 退化为 unknown） | ☐ 接受 ☐ 改签名 |
| D4 | 兼容常量移到 `device/compat/` | 接受（不违反 `types/*` 规则，改动面最小） | ☐ 接受 ☐ 放宽 types 规则 |
| D5 | 包长表下沉 + `setProfileSize()` | 接受（单一来源） | ☐ 接受 ☐ 保留双表 |
| D6 | 不用 `@deprecated` 标签 | 接受（避免 9 个既有文件变红） | ☐ 接受 ☐ 启用标签并修 lint |
| D7 | 装配根可注入 composition | 接受（测试缝 + 后续替换点） | ☐ 接受 ☐ 收回内部构造 |

## 7. 复核清单

- [ ] 对照 `specs/device-profile-resolution/spec.md` 逐条确认行为
- [ ] 确认 §3 的 7 条偏差是否可接受（§6）
- [ ] 抽查 `capability-matrix.test.ts` 与 design 矩阵是否逐格一致
- [ ] 确认 `check:deps` 规则确实会拦截（`tests/architecture-deps.test.cjs` 的负向用例）
- [ ] 决定是否在本 change 内接入连接流程（默认不接入，留给 P2）

## 8. 复核意见处理记录

### W1 `SessionProfile.diagnostics` 未覆盖 port-mismatch 与外部诊断传入

- **依据**：`spec.md:115-118`（Diagnostics carry the reason, not only the log）、`design.md:133`（`port-mismatch` / `probe-skipped` / `teardown-failed` 均产出诊断条目）。
- **原状**：解析器只在 `backend === 'simulated'` 时写入 `probe-skipped`；既未用 `transportFacts.usb` 与 `selection.binding.identityMatchers` 判定端口匹配，也没有入口接收驱动上报的非致命异常。
- **修复**：
  1. 新增 `device/usb-identity.ts`，把 `normalizeUsbId` 与匹配语义抽成单一实现；`registry.matchPort()` 改为复用它，解析器的判定与注册表完全一致（此前逻辑内联在 registry 中，解析器无法复用）。
  2. `SessionResolver.resolve()` 在非模拟后台上用 `matchUsbIdentity(selection.binding, transportFacts.usb)` 判定：`mismatch` 产出 `{ code: 'port-mismatch', severity: 'warning', stage: 'transport' }`，消息含实际 `vid:pid` 与期望身份（含 matcher 描述）；`unknown`（端口无 VID/PID）不产出诊断，避免误报。
  3. `ProbeResult` 增加可选 `diagnostics?: readonly DeviceDiagnostic[]`，驱动在探测阶段遇到的非致命问题（如 Boost 探测超时）随 `probe` 一起进入 profile；未采用给 `resolve()` 加第 5 个参数的做法，以保持 design 的四参数签名（与 D3 同一取舍方向）。
  4. 诊断条目按 `Object.freeze` 复制，驱动即使保留自己的 probe 结果引用也无法改到已发布快照。
- **顺序**：`probe-skipped`（仅模拟）/ `port-mismatch`（仅真实串口）→ 驱动诊断（保持驱动自身顺序）。
- **测试**：`tests/device-runtime/session-resolver.test.ts` 新增 `session diagnostics` 6 例——mismatch 记警告且不失败、match 静默、无 VID/PID 静默、模拟不误报、驱动诊断按序合并、数组与条目均冻结。全量 98 文件 / 1209 用例通过。
- **边界**：本场景限定「解析期间」。`initialize` 阶段之后产生的诊断无法写入已冻结的 `SessionProfile`；P2 接入真实 lifecycle 时，这类诊断应由 `ActiveSession` 或运行时 telemetry 承载，届时需在 lifecycle change 的 spec 中显式定义落点。
