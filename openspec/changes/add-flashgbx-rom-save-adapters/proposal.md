# Proposal: FlashGBX ROM & Save Adapters (Step 2/3)

> 基线：以已提交的 `web-client`（HEAD）与 `FlashGBX/FlashGBX/` 为唯一依据，FlashGBX 相关代码一律从零新增。FlashGBX 与 web-client 均为 GPL-3.0，移植代码与 `fc_*.txt` 数据时保留原版权/许可证声明。
> 系列顺序：`add-flashgbx-device-connection`（1/3）→ `add-flashgbx-rom-save-adapters`（2/3）→ `add-flashgbx-flashcart-profiles`（3/3）。
> **前置：`add-flashgbx-device-connection` 已合入并归档**（依赖其 `flashgbx` profile、握手、`Transport.readAvailable/flushOutput` 与操作护栏桩）。

## Why

第 1 步后设备已能连接，但还不能读写。本步补全 `LK_Device` 命令集、帧层与 GBA/DMG 适配器，使标准 CFI 卡带可完成 ROM/存档读写与校验。

## What Changes

- `protocol/flashgbx/` 补全命令编码：模式（`SET_MODE_AGB/DMG`）、电压/电源、变量（`SET_VARIABLE/GET_VARIABLE/GET_VAR_STATE/SET_VAR_STATE` 与 `DEVICE_VAR`）、读命令（`*_CART_READ*`）、写命令、Flash 命令/编程、GBA 启动序列与 RTC（`AGB_BOOTUP_SEQUENCE`、`AGB_READ_GPIO_RTC`）、DMG MBC、`CALC_CRC32`、`PING`；AGB 字寻址（地址 `>>1`）；`FLASH_PROGRAM` 的 `0x03` ACK；`CALC_CRC32` 按 `0x20000` 分块；会话级互斥锁。
- 帧层：`FlashgbxFramingLayer` 直接传输读写与缓冲清理，按 CH340/CDC GBFlash 调整读写上限，`pageSize` 上限放宽到 `0x2000`。
- 新增 `FlashgbxGbaAdapter`、`FlashgbxMbcAdapter`；覆写 `resetCommandBuffer`/`stabilizeCommandChannel`，**不得**触发 DTR/RTS 脉冲；替换第 1 步的护栏桩；开放工具/调试入口时仅暴露与 FlashGBX 兼容的部分（或继续禁用）。
- 自动断电续期（`AUTO_POWEROFF_TIME`）。
- 取消：在每个 chunk 前检查 `AbortSignal`；必要时扩展 RAM 读写端口以支持取消。

## Capabilities

### Modified Capabilities
- `flashgbx-device-support`：新增电压/电源、帧层上限、ROM/存档操作需求；移除「操作护栏」需求。
- `burner-settings-ui`：封包上限放宽至 `0x2000`。

## Independent Acceptance

仅用 CFI 卡带（无需 profile），GBFlash（CH340 与 CDC）完成：ID/CFI 读取、ROM 读、ROM 写+CRC32 校验、存档读写、取消与断线恢复；全程无 DTR/RTS 脉冲；`stm`/`stc` 回归通过。

## Impact

`protocol/flashgbx/*`、`services/flashgbx-*-adapter.ts`、`components/CartBurner.vue`、`settings/advanced-settings.ts`、`AdvancedSettingsModal.vue`、i18n；复用 `services/cartridge-adapter.ts` 与 `createCartridgeProtocolSession`。
