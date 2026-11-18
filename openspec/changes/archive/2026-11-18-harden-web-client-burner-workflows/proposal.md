# Proposal

## Why

基于 `web-client/docs/research/2026-11-17-rc31-comparison` 的对照分析与 `ChisFlash_RC31_源码研究包_20261103` 中 legacy 固件（`uart.c` 的 `romProgram`/`romRead`/控制线复位、`flashgbx.c` 的首字节分流）的复核，当前 `web-client/` 的 ROM 读写存在若干会**直接导致写入失败、重复擦除或吞吐浪费**的问题：

- `calcSectorUsage()` 从 `baseAddress` 重新铺设首区域几何，而非与 CFI 物理扇区求交。非零基址时会漏擦后续物理扇区，固件在未擦除区上编程时 `romWaitForDone` 永不收敛，表现为超时→重擦同一扇区→重试耗尽；异构 boot-sector 布局下还会重复擦除同一物理扇区。
- 分块只按 `pageSize` 与剩余量截取（GBA verify/read 未受 bank 窗口约束），且不保证块起点对齐写缓冲页。固件按 `bufferSize` 顺序发出 write-buffer 编程，块起点不对齐时会跨写缓冲页，导致编程失败并卡死到主机超时。非 2 幂页大小（如 1000B → F4 帧长 `0x03F3`）还会让 RC31 把 legacy 帧首字节误判为 FlashGBX 命令。
- 写入使用 UI 补齐后的镜像，校验使用原始文件且取三者最小值，补齐区从未被校验；adapter 自身也不保证输入覆盖 `size`。
- 写入对补齐区和 ROM 内大片 `0xFF` 仍逐块编程，而扇区擦除后这些字节已是 `0xFF`，属于纯开销。
- 读取页大小与写入页大小共用 4 KiB 上限，但 STC/RC31 legacy `romRead` 以 62B 包流式回传、不受 5500B 接收缓冲约束，读取请求数可以显著减少。
- 用户点击停止后 session 立即置 `busy=false`，而在途 adapter 循环要到下一个块边界才退出，新操作可以与旧循环交错发出命令（bank 切换互相覆盖）。
- RC31 兼容构建使用 `0483:5740`，当前产品筛选器只接受 `0483:0721`，即使 RC31 保留了 legacy 协议也无法连接。

本变更聚焦**读写稳定性与效率**，不引入额外的拒绝型门禁。

## What Changes

- **物理扇区交集**：`calcSectorUsage()` 按 CFI 区域绝对地址与 `[base, base+size)` 求交，容量检查计入 `baseAddress`；部分覆盖首/尾扇区时照常擦除整扇区并在日志中提示范围外字节会被擦除（与现有行为一致，不拒绝）。
- **统一分块规划**：抽取单一分块 helper，供 GBA/MBC5 的 `readROM`/`writeROM`/`verifyROM` 共用：块终点对齐到页边界，不跨 bank 窗口（GBA 32 MiB、GB 16 KiB）、扇区终点与写缓冲页；页大小向下规整为 2 的幂（替代当前仅告警）。
- **写入/校验同一镜像**：adapter 内部用同一 helper 将输入以 `0xFF` 补齐到 `size`，`writeROM` 与 `verifyROM` 使用相同 `baseAddress`/`size`/镜像；`written` 按实际块长度累计。
- **跳过已擦除态数据块**：擦除后编程时跳过全 `0xFF` 块（含恢复重放），计入完成量但不发 F4/FC。
- **读取块大小按固件 profile 解耦**：新增独立的 ROM 读取块大小设置，STM profile 上限 4 KiB（固件 `responBuf[5500]`），STC/RC31 profile 上限 32 KiB；默认值保持现状，经同板同卡 A/B 量测后再调整默认。
- **恢复重放修正**：重放起点为 `max(sector.address, baseAddress)`，使用同一补齐镜像；用带存储副作用的 Mock 验证最终读回。
- **取消与超时不提前释放互斥**：`abortOperation()` 与 `runWithTimeout()` 不再提前置 `busy=false`，直到在途操作真正返回；UI 显示"正在取消"。
- **耗时统计**：写入摘要区分擦除/传输/总耗时、重试次数、跳过字节数，作为后续效率调整的对照基线。
- **RC31 legacy 连接**：筛选器加入 `0483:5740`，推断为 STC legacy profile；本变更不使用 FlashGBX 命令。

## Capabilities

### New Capabilities
- `cartridge-range-and-sector-geometry`: CFI 物理扇区交集、统一分块规划（页/扇区/bank/写缓冲页对齐）、写入与校验镜像一致及实际完成量计数。
- `cartridge-transfer-efficiency`: 已擦除态块跳过、按固件 profile 解耦的读取块大小、读写耗时与有效吞吐统计。
- `rc31-legacy-device-support`: RC31 (`0483:5740`) 设备发现与 legacy profile 映射，以及与 RC31 首字节分流兼容的帧长约束。

### Modified Capabilities
- `burner-write-recovery`: 恢复重放基于真实物理扇区与写入区间交集，并以同一补齐镜像重放。
- `burner-application-orchestration`: 取消或超时后保持操作互斥，直到在途操作返回。

## Non-Goals

- 不修改 MCU/STC/RC31 固件。
- 不在协议封装层增加运行时参数拒绝（帧长、对齐由分块规划在构造上保证，协议层仅补字节级回归测试）。
- 不新增基于 CFI command set 或 MBC 枚举的写前拒绝门禁：现有 `0x89` 芯片在 MBC5 路径上可用（与 C# 客户端一致），按命令集一刀切会误拒可用卡带；未实现的 MBC1/MBC2 bank 切换已在首次擦除前抛错。
- 不实现局部扇区读-改-写。
- RC31 FlashGBX 会话（`C1` 流读、`D5` CRC32、`CA` RTC）移至后续独立变更：需要会话切换与实机互通验证，规模与风险超出本次范围。

## Impact

- **几何与分块**：`web-client/src/utils/sector-utils.ts`、新增 `web-client/src/utils/transfer-plan.ts`（分块与镜像 helper）
- **卡带适配器**：`web-client/src/services/gba-adapter.ts`、`web-client/src/services/mbc5-adapter.ts`、`web-client/src/services/cartridge-adapter.ts`
- **应用层与 UI**：`web-client/src/features/burner/application/burner-session.ts`、`web-client/src/composables/cartburner/useCartBurnerSessionState.ts`、`web-client/src/components/CartBurner.vue`
- **设置与设备发现**：`web-client/src/settings/advanced-settings.ts`、`web-client/src/types/firmware-profile.ts`、`web-client/src/utils/port-filter.ts`
- **测试**：`web-client/tests/utils/sector/`、`web-client/tests/services/adapters/`、`web-client/tests/features/burner/`、`web-client/tests/protocol/`、`web-client/tests/utils/port-filter.test.ts`、`web-client/tests/utils/firmware-profile.test.ts`
