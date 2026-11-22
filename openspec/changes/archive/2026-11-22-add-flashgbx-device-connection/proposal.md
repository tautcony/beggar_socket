# Proposal: FlashGBX Device Connection (Step 1/3)

> 基线：以已提交的 `web-client`（HEAD）与 `FlashGBX/FlashGBX/` 为唯一依据，FlashGBX 相关代码一律从零新增。FlashGBX 与 web-client 均为 GPL-3.0，移植代码与 `fc_*.txt` 数据时保留原版权/许可证声明。
> 系列顺序：`add-flashgbx-device-connection`（1/3）→ `add-flashgbx-rom-save-adapters`（2/3）→ `add-flashgbx-flashcart-profiles`（3/3）。
> 本步无前置依赖。

## Why

用户无法连接原生 FlashGBX 协议硬件（GBFlash CH340 与 CDC）。本步只解决「连得上、认得出、设置可配」，并保证 `stm`/`stc` 零影响。

## What Changes

- `'flashgbx'` 加入 `FirmwareProfileId`/`ConfigurableFirmwareProfileId`；新增 `FLASHGBX_FIRMWARE_PROFILE` 模板、`nativeFlashgbxProtocol`/`audioWePin` 能力位、`PLATFORM_PACKET_LIMITS` 条目；保留 `0483:5740` 在 `firmware-profile.ts` 中识别为 `stc`。
- 串口层：`DeviceSelection.baudRate?`；`DeviceHandle`/`init()` 携带 `skipSignalInit`；`Transport` 新增 `readAvailable()`（变长读）与 `flushOutput()`；三端 gateway（web/tauri/simulated）与 Tauri 命令同步；运行期变更波特率通过「关闭并按新速率重开」实现。
- 连接流程：`select()` 透传端口过滤器；Web 重试/回滚保留已授权 `webPort`；`DeviceConnect.vue` 重置按钮不丢失 `skipSignalInit`。
- `PortFilters.presets.flashgbx()`（`1A86:7523`、`16C0:27DD`）。
- 新建 `protocol/flashgbx/`：`constants.ts`、`handshake.ts`；`DeviceConnectionManager` 执行 GBFlash 握手与断开序列，并生成带探测能力的运行时 profile。
- Advanced Settings：`flashgbx` 选项、波特率（`auto|1M|1.5M|2M`）、`flashgbx` 封包页签（保守默认值）；5 种语言 i18n。
- **操作护栏**：`flashgbx` 连接下由受护栏的 `BurnerProtocolSession` 桩承接所有烧录操作并返回 `unsupported`；工具函数与调试弹窗的 ChisFlash 直连入口对 `flashgbx` 禁用。

## Capabilities

### New Capabilities
- `flashgbx-device-support`

### Modified Capabilities
- `device-transport-gateway`：`baudRate`、`skipSignalInit`、`readAvailable`/`flushOutput`、连接重试保留选择。
- `burner-settings-ui`：`flashgbx` 设置项。

## Independent Acceptance

- 单元/回放测试通过；`stm`/`stc` 全量回归。
- 真机：GBFlash（CH340 与 CDC）均能连接并显示设备名/固件/电源能力；失败与断开后可立即重连；握手失败带 stage。
- 不要求任何读写可用；`flashgbx` 下点击任何烧录操作得到 `unsupported`，设备不收到 ChisFlash 命令、不发生 DTR/RTS 脉冲。

## Impact

`types/firmware-profile.ts`、`settings/advanced-settings.ts`、`platform/serial/{types,constants,platform-packet-policy}.ts`、`platform/serial/{web,tauri,simulated}/*`、`platform/native.ts`、`src-tauri/src/native_platform.rs`、`utils/port-filter.ts`、`services/device-connection-manager.ts`、`features/**/connection-use-case.ts`、`components/{DeviceConnect,CartBurner}.vue`、`components/modal/AdvancedSettingsModal.vue`、`services/tool-functions.ts`、调试弹窗、i18n（5 语言）。
