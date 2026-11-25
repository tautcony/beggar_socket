# Tasks

## 1. 核心定义与注册

- [x] 1.1 在 `web-client/src/device/` 增加 Device/Firmware/Binding、variant selection、协议、传输、能力、参数和显示契约；Firmware 不保存 implementation ID，binding 的 `runtimeBindingId` 是唯一实现来源。补齐 `TransportFacts`、`PendingSession`、`ActiveSession`、`SelectableVariant`、`ParameterError`、`SelectionSnapshot`、`DeviceDiagnostic` 契约。同时在 `web-client/src/device-runtime/` 建立 `RuntimeCompositionRegistry` 与 `SessionResolver` 骨架，driver 先用测试桩，确保泛型 `RuntimeBinding<TFacts>` 在定义处闭合。
- [x] 1.2 在 `scripts/check-architecture-deps.cjs` 扩展 `checkViolation` 传入导入 `kind`（`'type' | 'runtime'`），增加两条规则并补测试：`src/device/` 禁止导入 `services/`、`platform/`、`protocol/`、`components/`、`views/`、`device-runtime/`；`src/device-runtime/` 禁止导入 `components/`、`views/`；`types/*` 引用 `device/*` 或 `device-runtime/*` 仅允许 type-only。在 `tests/architecture-deps.test.cjs` 增加对应用例，确保 `npm run check:deps` 真能验证两层依赖方向。
- [x] 1.3 注册三类设备、四种固件及四个 binding，表达 Boost 的 beggar.stm 参数 namespace 与各 binding 的 `packetLimits`（`HostPlatform` 下沉至 `src/types/` 或注入 `ParameterStore`）。用注册表测试验证有效 variant、USB 规则分类及非法组合拒绝。

## 2. 解析与兼容

- [x] 2.1 实现 legacy-backed 最小 ParameterStore、SelectionProvider（返回 `SelectionSnapshot`，携带 `source` 与可选 `variantId`）、SessionProfile 与 OperationSettingsSnapshot、类型化 capability rule 和内部 display context。测试单向能力 lattice、硬件门控只作用于四个 `cart.*` 键、事实不向 public session 泄漏、即时参数快照和不同连接快照隔离；确认 legacy effective `stmBoost` 不产生 `beggar-stm-boost`，无效选择返回 `source: 'invalid'` 而不静默回落默认项。
- [x] 2.2 按 design 的「能力矩阵」为四个固件逐项声明能力，并新增矩阵驱动测试：遍历每个 `CapabilityKey` 断言解析结果与声明一致，新增 key 或固件时测试失败。`rom.bankSwitch.32M` 先声明为不可用并带原因，FlashGBX `tool.rtc.*` 声明为可用（具体实现待完善）。
- [x] 2.3 将宿主默认值、固件限制与既有分块策略接到解析边界。验证 STM、STC、Boost、GBFlash 的约束可分别表达，设置值与有效上限各自可读。
- [x] 2.4 实现 `SessionResolver.resolve()` 的单一来源与派生规则：runtime 只来自 `binding.runtimeBindingId`；按规则派生 `boostTransport`（verified 或 simulated 才为 true，Boost variant 未验证即失败）。用测试覆盖两个快照隔离与四种 boostTransport 组合。
- [x] 2.5 将现有 `FirmwareProfile` 读取入口接到兼容门面。运行 `tests/utils/firmware-profile.test.ts`，验证旧 ID、Boost 能力与未知设备兜底（宽松能力仅存在于门面）。

## 3. 集成验证

- [x] 3.1 运行 `npm run type-check`、`npm run check:deps` 和 `npm run test:run`，以现有回归基线（当前 89 个测试文件）加新增解析测试验证 P0/P1 可独立交付。

> 实施记录、与 design 的 7 条偏差、验证证据与待确认决策见 [implementation-notes.md](./implementation-notes.md)。
