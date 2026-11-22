# Proposal

## Why

目前网关初始化与协议握手分属不同路径，首次连接、指定串口和重连容易得到不同的会话状态。需要让高级设置决定设备和协议，并在同一连接流程中完成协议验证、初始化和清理。

## What Changes

- 用 core SelectionProvider 提供的已保存 variant 选择确定连接配置。自动发现只接受 match；mismatch/unknown 端口只有用户显式选择后才可尝试连接，并记录诊断。
- 通过共享流程建立会话。按 `binding.transport` 打开串口并创建 PendingSession；握手和初始化成功后 commit 为 ActiveSession，失败时执行 cleanupPending 并释放端口。
- 按注册定义在 `src/device-runtime/` 装配 Beggar 与 FlashGBX 的驱动、display contributor 和 GBA、MBC5 适配器。保留协议字节、超时、信号和电压行为，按独立 Boost 选项约定处理探测失败。
- 在连接信息中显示实际会话使用的设备与固件，并把所选配置、端口匹配结果、失败阶段和收尾失败写入规范化 `diagnostics`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `connection-usecase-orchestration`：协议初始化纳入连接事务，以解析后的会话作为权威上下文。
- `device-transport-gateway`：使用所选设备优先发现串口并记录匹配结果。
- `flashgbx-device-support`：由已保存的 GBFlash 选择决定握手与过滤范围，继承现有协议约束。
- `rc31-legacy-device-support`：保留 RC31 的 STC 识别线索，以已保存的设置决定协议。
- `cartridge-transfer-efficiency`：定义独立 Boost 变体的读分块上限，保留各 Beggar 固件的现有限幅规则。

## Impact

依赖 [核心抽象](../refactor-device-abstraction-core/proposal.md) 中的 binding、SelectionProvider 与 `SessionResolver`。影响 `DeviceConnectionManager`、连接用例和网关、`src/device-runtime/` 的驱动与适配器装配、连接信息和诊断。串口命令签名沿用现有契约。参数 schema 与 UI 后续依赖此 lifecycle，不构成反向依赖。
