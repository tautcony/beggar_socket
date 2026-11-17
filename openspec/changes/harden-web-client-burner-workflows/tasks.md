# Tasks

## 1. 几何与分块规划 (P1)

- [x] 1.1 重写 `web-client/src/utils/sector-utils.ts` 的 `calcSectorUsage`：按 CFI `SectorBlock.startAddress` 枚举物理扇区并与 `[baseAddress, baseAddress + size)` 求交，容量检查改为 `baseAddress + size <= deviceSize`；部分覆盖首/尾扇区时返回整扇区并由调用方输出一次 warn 日志（不拒绝）。更新 `tests/utils/sector/utils.test.ts`：base=0 对齐用例结果不变；`0x8000` 起写 64KiB 得到 `0x0000`、`0x10000` 两个物理扇区；底部/顶部 boot-sector 布局非零基址不重复擦除同一扇区；越过设备末尾抛错
- [x] 1.2 新增 `web-client/src/utils/transfer-plan.ts`：`nextChunkSize({ address, remaining, pageSize, bankSize, sectorEnd?, bufferSize? })`（块终点对齐页边界，地址未按 `bufferSize` 对齐时先对齐到写缓冲页，不跨 bank/扇区终点）与 `prepareRomImage(data, size)`（不足 `size` 时 `0xFF` 补齐）。单测覆盖：32MiB 与 `0x4000` 边界、扇区终点、非对齐起点、尾块
- [x] 1.3 页大小规整：`settings/advanced-settings.ts` 的 `pageSize` 校验将非 2 幂值向下取 2 的幂（替代仅告警）；`CartridgeAdapter.resolveRomPageSize` 同样规整。补充设置单测
- [x] 1.4 `GBAAdapter` 与 `MBC5Adapter` 的 `readROM`/`writeROM`/`verifyROM`（以及 `CartridgeAdapter.readROM` 模板）全部改用 `nextChunkSize`；`writeROM`/`verifyROM` 入口调用 `prepareRomImage(fileData, size)`，`written` 按实际块长度累计；`CartBurner.vue` 写入补齐改用同一 helper。补充测试：短输入被补齐后补齐区差异可被 verify 发现；`pageSize=1000` 规整为 512 后 F4 payload 长度均为 2 的幂且起点对齐 `bufferSize`

## 2. 效率 (P1)

- [x] 2.1 `writeROM`（GBA/MBC5）在擦除后跳过全 `0xFF` 块：不发送 F4/FC，推进 `written`，累加 `skippedBytes`，不计入 `SpeedCalculator` 传输样本；恢复重放沿用同一规则。测试：补齐 2MiB `0xFF` 的镜像发出的 program 请求数减少且 verify 通过
- [x] 2.2 新增 `romReadPageSize` 设置（默认等于当前 `romPageSize`）与 `FirmwareProfile.maxReadChunk`（stm/unknown 4KiB，stc 32KiB）；`readROM`/`verifyROM` 使用 `min(romReadPageSize, maxReadChunk)` 并经 `nextChunkSize` 约束。测试：stm profile 下读请求不超过 4KiB，MBC 读请求不超过 16KiB
- [x] 2.3 写入摘要输出擦除耗时、传输耗时、总耗时、program 请求数、重试次数、跳过字节数；读取/校验摘要输出请求数与有效吞吐。补充统计断言（重放字节不计入有效完成量）

## 3. 恢复与互斥 (P2)

- [x] 3.1 `GBAAdapter`/`MBC5Adapter` 的 `recoverSectorWrite` 将重放起点改为 `max(sector.address, baseAddress) - baseAddress`，并复用补齐镜像。在 `tests/services/adapters/gba-adapter.test.ts`、`mbc5-adapter.test.ts` 增加带存储副作用的 Mock（部分写入后超时、写入完成但 ACK 丢失、重试耗尽），断言最终模拟存储与镜像逐字节一致或返回失败
- [x] 3.2 `BurnerSession.abortOperation()` 仅中止信号并标记 cancelling，不清 `busy`；`runWithTimeout()` 超时后中止信号并等待操作返回再释放；`useCartBurnerSessionState.handleProgressStop` 显示"正在取消"并在 `busy` 释放前禁止新操作。在 `tests/features/burner/application.test.ts` 补充：取消后在途 Promise 未结束前无法启动下一操作

## 4. RC31 legacy 支持与验证 (P2)

- [x] 4.1 `utils/port-filter.ts` 的 `beggarSocket` 预设加入 `0483:5740`；`types/firmware-profile.ts` 的 `inferFirmwareProfileFromPort` 将其映射为 STC profile。更新 `tests/utils/port-filter.test.ts`、`tests/utils/firmware-profile.test.ts`
- [x] 4.2 在 `tests/protocol/transport.test.ts` 补充字节级回归：F4/F6 使用 byte 地址、`rom_erase_sector` 经 F5 发出 word 地址、`PayloadBuilder.build(false)` 只含一份 2 字节尾部；并断言规整后各页大小的 F4 帧长低字节不落入 RC31 FlashGBX 触发范围（`>= 0xA0` 或 `0x55`）
- [ ] 4.3 实机 A/B（有硬件时执行并记录到 `web-client/docs/research/2026-11-17-rc31-comparison/`）：同板同卡对比改动前后写入总耗时、32MiB 读取在 `romReadPageSize` 4KiB/16KiB/32KiB 下的耗时与错误率；据此决定 STC profile 的默认读取块大小

## 5. 集成回归

- [x] 5.1 在 `web-client/` 运行 `npm run test:run`（至少包含 `tests/utils/sector`、`tests/services/adapters`、`tests/features/burner`、`tests/protocol`、`tests/platform/serial`、`tests/settings`、`tests/utils/port-filter.test.ts`、`tests/utils/firmware-profile.test.ts`），全部通过
