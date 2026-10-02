# 模块：Services / Adapters

`src/services/cartridge-adapter.ts` 保留外部卡带 API、日志、进度和公共 readROMWithStrategy 执行循环。`src/services/gba-adapter.ts` 与 `src/services/mbc5-adapter.ts` 提供实际 ROM read 策略；`src/services/platform-ops.ts` 的 RomReadOps / RomReadStrategy 表达 read、bank、power、throttle。旧 PlatformOps 仅保留 deprecated 类型兼容，未使用基类 getCartInfo 明示不支持。

共享边界是读取循环、重试和进度，GBA/MBC 的 bank、电压、字节/word 地址、erase/write/RAM 时序仍由各硬件实现负责。

- `src/services/bank-chunk-planner.ts`：按逻辑地址计算 bank、映射地址和窗口余量，读取/校验/RAM 传输不能跨窗口。
- `src/utils/sector-utils.ts`：按物理 sector 与请求范围交集规划；首个部分扇区失败重写从正确逻辑 offset 恢复。擦除仍作用于整个物理 sector，不保证其请求范围外数据保留。
- `src/utils/parsers/cfi-parser.ts`：验证完整区域描述、容量总和和指数，支持 CFI 128-byte 特殊编码及 bulk-only；非标准芯片需单独证据。
- `src/services/device-connection-manager.ts`：连接 use case、gateway 与 owner 的服务入口。
- `src/services/tool-functions.ts` 与 `src/services/debug-protocol-service.ts`：RTC/PPB/调试完整事务参与 owner。

RTC 的 `src/services/rtc/base-rtc.ts`、`src/services/rtc/gba-rtc.ts`、`src/services/rtc/mbc3-rtc.ts` 在 I/O 前验证输入，写后比较目标和经过时间，并独立尝试硬件 cleanup，保留主错误与恢复错误。

LK 的 `src/services/lk/romBuilder.ts` 使用局部 BuildContext、InputGame → PreparedGame → AllocatedGame 阶段模型，校验存档/ROM/item-list 容量后编码；无背景不加载 imageUtils。`src/services/lk/imageUtils.ts` 保留现有图像算法；字节 golden 与 PNG 证据不代表浏览器性能已验收。
