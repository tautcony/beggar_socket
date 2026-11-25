# Proposal

## Why

`FirmwareProfile` 同时描述设备身份、固件、协议和动态能力。接入 GBFlash 后，这些职责已分散到串口连接、适配器、设置和界面，需要先建立可独立验证的解析模型。

## What Changes

- 注册三类硬件和四种固件，由 Device/Firmware/Binding 分别描述硬件、协议声明和合法组合；binding 的 `runtimeBindingId` 唯一解析 driver、adapter、display 与 mode sync。
- 以规范的能力矩阵确定四个固件对每个 `CapabilityKey` 的取值，并让 `src/device/`（纯定义层）与 `src/device-runtime/`（装配层）分别受 `check:deps` 约束：前者禁止依赖 services/platform/protocol/UI，后者禁止依赖 UI。
- 提供 legacy-backed 最小 ParameterStore/SelectionProvider，并根据 capability declaration 和 typed probe facts 解析不可变 SessionProfile 与 OperationSettingsSnapshot；选择结果与 session 快照都携带规范化 `diagnostics`。
- 将 STM-Boost 注册为丐中丐的独立固件变体，共用标准 STM 的实现与封包配置。
- 让旧 `FirmwareProfile` API 通过兼容门面读取注册定义或解析结果，维持现有入口的兼容性。

## Capabilities

### New Capabilities

- `device-profile-resolution`：设备和固件注册、能力解析、会话快照以及过渡兼容。

### Modified Capabilities

无。

## Impact

新增 `web-client/src/device/` 的纯定义层与 `web-client/src/device-runtime/` 的装配层骨架（composition registry、SessionResolver）、legacy settings adapter 和注册定义。影响 `types/firmware-profile.ts` 及其测试。后续由 [连接生命周期](../refactor-device-lifecycle-drivers/proposal.md) 和 [参数与 UI](../refactor-device-parameters-ui/proposal.md) 接入运行路径并补齐真实 driver。
