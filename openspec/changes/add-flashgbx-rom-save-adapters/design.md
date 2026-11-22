# Design: FlashGBX ROM & Save Adapters

## Context

第 1 步已提供握手、能力探测、`Transport.readAvailable/flushOutput` 与护栏桩。本步实现 `LK_Device.py` 的业务命令与适配器。注意 `CartridgeAdapter.resetCommandBuffer()`（`services/cartridge-adapter.ts`）会脉冲 DTR/RTS，不适用于 FlashGBX 设备。

## Goals / Non-Goals

**Goals**：完整命令集、帧层（ACK）、两个适配器、清理/恢复、串行化、取消。

**Non-Goals**：`fc_*.txt` profile（第 3 步）；修改 ChisFlash 适配器；e-Reader、3D Memory、MBC7、Pocket Camera、`SET_PIN` 等非核心命令。

## Decisions

### Decision 1：独立适配器，覆写通道复位
`FlashgbxGbaAdapter`/`FlashgbxMbcAdapter` 继承 `CartridgeAdapter`（经 `createCartridgeProtocolSession`），复用 `ProgressReporter`、`SpeedCalculator`、`planBankChunk`。覆写 `resetCommandBuffer()`（改为 `flushInput/flushOutput` + 必要时 `drainInput`，无信号脉冲）和 `stabilizeCommandChannel()`。`GBAAdapter`/`MBC5Adapter` 不修改。

### Decision 2：命令集范围（对照 `LK_Device.py` `DEVICE_CMD`）
- 模式与电源：`SET_MODE_AGB 0xA2`、`SET_MODE_DMG 0xA3`、`SET_VOLTAGE_3_3V 0xA4`、`SET_VOLTAGE_5V 0xA5`、`CART_PWR_ON/OFF/QUERY 0xF2/F3/F4`、`PING 0xFE`。
- 变量：`SET_VARIABLE 0xA6`、`GET_VARIABLE 0xAD`、`GET_VAR_STATE 0xAE`、`SET_VAR_STATE 0xAF`；`DEVICE_VAR` 表（`ADDRESS`、`AUTO_POWEROFF_TIME`、`TRANSFER_SIZE`、`BUFFER_SIZE`、`DMG_ROM_BANK`、`CART_MODE`、`DMG_ACCESS_MODE`、`FLASH_*`、`CART_POWERED` 等，以源码为准）。
- 读：`DMG_CART_READ 0xB1`、`AGB_CART_READ 0xC1`、`AGB_CART_READ_SRAM 0xC3`、`AGB_CART_READ_EEPROM 0xC5`；GBA：`AGB_BOOTUP_SEQUENCE 0xC9`、`AGB_READ_GPIO_RTC 0xCA`。
- 写：`DMG_CART_WRITE 0xB2`、`DMG_CART_WRITE_SRAM 0xB3`、`AGB_CART_WRITE 0xC2`、`AGB_CART_WRITE_SRAM 0xC4`、`AGB_CART_WRITE_EEPROM 0xC6`、`AGB_CART_WRITE_FLASH_DATA 0xC7`。
- Flash：`SET_FLASH_CMD 0xA7`、`DMG_FLASH_WRITE_BYTE 0xD1`、`AGB_FLASH_WRITE_SHORT 0xD2`、`FLASH_PROGRAM 0xD3`、`CART_WRITE_FLASH_CMD 0xD4`；MBC：`DMG_MBC_RESET 0xB4`、`DMG_SET_BANK_CHANGE_CMD 0xB8`；校验 `CALC_CRC32 0xD5`。
- 协议细节：AGB 地址按字（`>>1`）；`FLASH_PROGRAM` 的 `0x03` 响应处理；`CALC_CRC32` 以 `0x20000` 为单位分块；`wait` 参数依据 `fw_ver >= 12`。

### Decision 3：帧层与 ACK 流控
GBxCart 的 `GBxCartSerial` 需实现 `Synchronize`（`\xFF\x18` 序列）、`ConfigureACK`、可选 RLE；仅在 `pcb ∈ {5,6}`、`cfw_id=='L'`、`fw_ver>=16` 时启用。上限：ACK 开启 → 读 `0x2000`/写 `0x100`；1M 且无 ACK → 读 `0x100`/写 `0x100`；其余 → 读 `0x1000`/写 `0x400`。`advanced-settings.ts` 的 `pageSize` 上限放宽到 `0x2000`。ACK 开关随本步交付。

### Decision 4：能力门槛
`CALC_CRC32`、电源命令等按第 1 步探测的 `fw_ver`/能力位门控；不足时降级为回读校验或 `unsupported`。门槛值实现前自 `LK_Device.py` 核对写入测试。Joey Jr V2 仅拨码控压：不下发电压命令，提示用户手动切换。

### Decision 5：串行化与取消
- 会话级互斥锁覆盖多步 LK 事务（设置变量 → 命令 → 读取），而不仅是单次 `sendAndReceive`。
- 每个 chunk 前检查 `AbortSignal`；RAM 读写端口若无 `AbortSignal` 参数则扩展（`ports.ts`）。
- 失败/取消：适配器级复位（`DMG_MBC_RESET`、CFI 复位）与恢复进入前的电压/电源状态（`CART_PWR_OFF` + `SET_VOLTAGE_3_3V` 路径）。profile 自带的 `reset` 序列属于第 3 步。

### Decision 6：自动断电续期
`AUTO_POWEROFF_TIME` 的看门狗在长操作中定期续期（参考 `LK_Device.py` 的 `THREAD_AUTO_POWEROFF_TIME`），避免操作中途断电；操作结束或断开时清零。

## Risks / Trade-offs

- 字节流错位会让设备卡死：互斥锁 + 超时后重新握手。
- ACK/RLE 实现复杂：先上线非 RLE 的 ACK，RLE 若无必要可延后（记录为已知限制）。
- DMG 5V/电源循环行为因硬件而异：以 `cartPowerControl` 为准。

## Migration Plan

适配器仅在 `firmwareProfile.id === 'flashgbx'` 时启用，替换第 1 步护栏；工具/调试入口随之评估是否开放。

## Verification

每个命令与 `LK_Device.py` 字节级对照回放；AGB 字寻址、`FLASH_PROGRAM` ACK、CRC 分块的专项测试；适配器单测；取消/清理/看门狗测试；断言全程无 DTR/RTS；真机清单。
