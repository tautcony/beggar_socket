# Design: FlashGBX Device Connection

## Context

已提交的 `web-client` 只支持 ChisFlash 协议（`stm`/`stc`）。三端 gateway 在 `init(device)` 中调用 `initDeviceSignals()`（`platform/serial/device-signals.ts`）做 DTR/RTS 脉冲；`CartridgeAdapter.resetCommandBuffer()` 在每次操作前也会脉冲 DTR/RTS。`Transport` 只有定长 `read`、`flushInput`、`drainInput`，无变长读与输出清缓冲。参考实现：`LK_Device.py`、`hw_GBxCartRW.py`、`hw_GBFlash.py`、`hw_JoeyJr.py`。

## Goals / Non-Goals

**Goals**：连接、握手、能力探测、波特率与信号策略、`Transport` 补能力、设置 UI、操作护栏。

**Non-Goals**：任何读写/电源命令的业务使用（第 2 步）；ACK 流控与帧层（第 2 步）；profile（第 3 步）；固件更新、Pocket Camera、e-Reader、GameBub、GBA Video/DOT；Joey Jr MSC 与 JoeyGUI（`unsupported`）；改变 `stm`/`stc` 行为。

## Decisions

### Decision 1：`skipSignalInit` 放在 `DeviceHandle`，不只放在 `DeviceSelection`
`initDeviceSignals()` 实际在三端 `device-gateway.ts` 的 `init(device)` 中调用，而重置/重试按钮只传 `DeviceHandle`。因此 `skipSignalInit` 需写入 `DeviceHandle`（由 `connect()` 依据 `DeviceSelection` 设置），`init()` 读取它决定是否脉冲。

### Decision 2：连接重试与回滚保留选择
- `DeviceConnectionManager` 向 `select()` 透传端口过滤器（现有代码未传 `_filter`）。
- `rollbackConnection` 不得清空 Web 的 `webPort`：Web Serial 要求用户手势才能再次请求端口，重试应复用已授权端口。
- 升速/重试所需的「关闭并重开」都复用同一个已授权端口对象。

### Decision 3：`baudRate` 经 `DeviceSelection` 传递，Tauri 校验取值
`DeviceSelection.baudRate?`；三端 gateway 打开端口用 `baudRate ?? DEFAULT_SERIAL_CONFIG.baudRate`。Tauri：`native_open_serial_port(path, baud_rate: Option<u32>)`，仅允许 `{9600, 1_000_000, 1_500_000, 2_000_000}`，否则返回明确错误。运行期变更波特率 = 发命令后关闭并以新速率重开（Web Serial 与 Tauri 均无在线改速）。

### Decision 4：`Transport` 能力补充
- `readAvailable(timeoutMs)`：读取当前可用的全部字节（Joey Jr 的 `0x55 0xAA` 响应长度不定，参考实现等待约 10 ms 后读全部可用字节）。
- `flushOutput()`：对应参考 `reset_output_buffer()`；Tauri 侧需在 `native_platform.rs` 增加输出缓冲清理（现仅清输入）。
- 三端（Web/Tauri/Simulated）均实现；`SimulatedTransport` 目前只认 ChisFlash 帧，对 `flashgbx` 返回「未实现」即可，不要求模拟 LK 协议。
- 此项修改 `tauri-serial-gateway` 与 `device-transport-gateway` 主 spec 的相关要求。

### Decision 5：握手按 USB ID 分流，参考实现为准
握手通用：超时 75 ms，清空输入输出缓冲。
| USB ID | 设备 | 流程 |
|---|---|---|
| `1A86:7523` | GBxCart RW 或 CH340 模式 GBFlash | 先走 GBxCart 流程；若 `0x68` 无响应或判为不匹配（`pcb>=5 && ofw==0`、`pcb==2 && ofw==2`），回退为 GBFlash 流程 |
| `16C0:27DD` | CDC 模式 GBFlash | 直接 GBFlash 流程 |
| `0483:5740` | Joey Jr | Joey 流程 |

- **GBxCart 流程**（`hw_GBxCartRW.py:LoadFirmwareVersion`）：`0x68` 读 `pcb`（无响应失败）；波特率 >1M 且 `pcb ∉ {5,6,101}` 判不匹配；`0x56` 读 `ofw`；`pcb<5 && ofw>0` 为原版固件 → `unsupported`；否则 `0xA1`。
- **GBFlash 流程**（`hw_GBFlash.py:LoadFirmwareVersion`）：不发 `0x68`/`0x56`，直接 `0xA1`；`size` 必须为 8。
- **Joey 流程**（`hw_JoeyJr.py:LoadFirmwareVersion`）：`0x55 0xAA` → 等 10 ms → `readAvailable`；须含 `"Joey"`；含 `"GUI"`/`"FW vG"` → `unsupported`；须含 `"FW L"`；`device_id[0]==0` 时发 `"LK"` 期待 `0xFF`；再发 `0xA1`。
- **`0xA1` 解析**：`size(1)=8` + `>cHBI`（`cfw_id`, `fw_ver`, `pcb_ver`, `fw_ts`）；`cfw_id=='L' && fw_ver>=12` 时继续读 `nameLen`+`pcb_name`、能力位（bit0 `cart_power_ctrl`，bit1 `cart_presence_switch`，bit2 `cart_mode_switch`）、状态字节（bit0 `bootloader_reset`，bit1 有 `device_serial`，bit7 `unregistered`，GBFlash 路径）。
- 失败均抛 `FlashgbxHandshakeError{stage}`，关闭端口并清缓冲，不回退 ChisFlash 命令。

### Decision 6：波特率策略（`auto` 默认）
- **GBxCart RW**：以 1M 打开 → 握手 → 识别为 `pcb ∈ {5,6,101}` 时发送 `OFW_USART_1_5M_SPEED (0x3E)`，按「关闭并以 1.5M 重开」升速；失败则保持 1M（`0x3C` 用于降回 1M）。参考实现开端口时依次尝试 1M、1.5M。
- **GBFlash（CH340）**：直接以 2M 打开。
- **CDC（Joey Jr、`16C0:27DD`）**：忽略波特率。
- 用户固定选 `1000000`/`1500000`/`2000000` 时只按所选值尝试，不做自动升降。
- 1M 下未启用 ACK 流控时参考实现读上限 `0x100`、写上限 `0x100`（`hw_GBxCartRW.py:_ConfigureACKTransport`）；本步 `flashgbx` 封包默认值取该保守值，第 2 步随 ACK 再放宽。

### Decision 7：能力模型
- `FirmwareCapabilities` 新增 `nativeFlashgbxProtocol`、`audioWePin`；`stm`/`stc`/`unknown` 为 `false`。
- `FLASHGBX_FIRMWARE_PROFILE` 是模板，运行时由探测覆盖：`cartPowerControl` = `cart_power_ctrl`；`audioWePin`：GBxCart RW/Joey Jr → `true`，GBFlash → `!(pcb_ver < 13 && cartPowerControl)`。
- 修改 `firmware-profile.ts` 中 `0483:5740` → STC 的硬编码识别，以及 `advanced-settings.ts` 的二元 `otherProfile` 逻辑，使三 profile 共存。

### Decision 8：操作护栏
- `CartBurner.vue` 对 `flashgbx` 不实例化 `GBAAdapter`/`MBC5Adapter`，也不置 `null`（`null` 会被 `CartBurner.vue` 的前置检查拦成「无适配器」而非 `unsupported`）；改为注入一个受护栏的 `BurnerProtocolSession` 桩：所有方法返回 `firmwareUnsupportedResult`，且 **不调用** `resetCommandBuffer()`/任何 DTR/RTS。
- `services/tool-functions.ts` 与调试弹窗（`DebugToolModal.vue`）直连 ChisFlash 的入口，在 `flashgbx` 下禁用。
- UI 提示「FlashGBX 设备已连接，读写功能将在后续版本提供」。第 2 步把桩替换为真实适配器。

### Decision 9：断开序列
参考 `Close()`：Joey Jr 发 `b'KL'`（停用 LK 固件）并读 1 字节后关闭；GBxCart 路径关闭前执行 `_DisableACKTransport` 与 LED 复位（ACK 随第 2 步，LED 复位可选）；断开时统一恢复 3.3V（需 `cart_power_ctrl` 则 `CART_PWR_OFF`）。

## Risks / Trade-offs

- Web Serial 高波特率：浏览器与 CH340 驱动支持因平台而异，`auto` 失败须清晰降级，并在文档注明。
- 升速时序错误会让设备失联：字节级回放 + 真机验证。
- `0x3E` 后重开端口存在竞态：重开前等待固定的稳定时间，并以 `0x56` 复验。

## Migration Plan

旧设置缺字段回落默认（`flashgbxBaudRate: 'auto'`）；`stm`/`stc` 路径不改。

## Verification

字节级回放（三家族、各 stage 失败、legacy、JoeyGUI、GBxCart→GBFlash 回退、升速）；三端 gateway 与 `Transport` 新方法测试；Rust 单测（非法波特率、输出缓冲清理）；设置迁移；`i18n.test.ts`（5 语言）；护栏测试（无 DTR/RTS、无 ChisFlash 字节）；真机清单。
