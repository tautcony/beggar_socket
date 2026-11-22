## 1. Protocol & frame layer

- [x] 1.1 核对 `CALC_CRC32`、电源、变量命令的 `fw_ver` 门槛并写入设计与测试。
- [x] 1.2 实现 Decision 2 的全部命令编码（含 `SET_MODE_*`、`*_CART_READ*`、`AGB_BOOTUP_SEQUENCE`、`AGB_READ_GPIO_RTC`、变量命令与 `DEVICE_VAR` 表、`PING`）；AGB 字寻址、`FLASH_PROGRAM` ACK、`CALC_CRC32` 分块；字节级回放测试。
- [x] 1.3 帧层：`FlashgbxFramingLayer`、CH340/CDC 读写上限矩阵；`pageSize` 上限放宽到 `0x2000`（设置、modal、测试）。
- [x] 1.4 会话级互斥锁与取消（`AbortSignal`，必要时扩展 RAM 端口），测试。

## 2. Adapters

- [x] 2.1 `FlashgbxGbaAdapter`：启动序列、ID/CFI、扇区/整片擦除、ROM 读/写/校验、SRAM/FRAM/Flash/EEPROM、RTC；覆写 `resetCommandBuffer`/`stabilizeCommandChannel`（无 DTR/RTS）；单测。
- [x] 2.2 `FlashgbxMbcAdapter`：ID/CFI、5V 电源/电压（受 `cartPowerControl` 约束）、MBC1/2/3/5 bank、擦除、ROM/SRAM/FRAM；单测。
- [x] 2.3 失败/取消清理与电压/电源恢复；`AUTO_POWEROFF_TIME` 续期；测试。
- [x] 2.4 `CartBurner.vue` 替换护栏桩为新适配器；评估并处理 `tool-functions.ts`/调试弹窗入口；回归测试确认 `stm`/`stc` 不变。

## 3. Acceptance

- [ ] 3.1 真机（GBFlash CH340 与 CDC）对 CFI 卡带完成 ID、ROM 读写+CRC、存档读写、取消、断线恢复，并确认无 DTR/RTS 脉冲；记录结果。
- [ ] 3.2 `npm test`、`npm run build`、`cargo test`。
