# Phase 1 审查报告: 适配器层重复代码

> 日期: 2026-04-17
> 文件数: 7
> 发现: P0(0) / P1(5) / P2(3) / INFO(2)

## 已审查文件

- `services/gba-adapter.ts` (1658 行)
- `services/mbc5-adapter.ts` (1850 行)
- `services/tool-functions.ts` (670 行)
- `services/cartridge-adapter.ts` (282 行)
- `services/rtc/base-rtc.ts` (72 行)
- `services/rtc/gba-rtc.ts` (237 行)
- `services/rtc/mbc3-rtc.ts` (289 行)

## Findings

### [P1-01] GBA/MBC5 适配器核心操作逻辑镜像复制 (~3000 行重复)

- 位置: `services/gba-adapter.ts` 与 `services/mbc5-adapter.ts` 全文件
- 触发条件: 两个适配器实现了 ROM 读/写/擦除/验证、RAM 读/写/验证等操作，核心流程 85-95% 相同
- 影响: 修改一个适配器的逻辑（如重试策略、进度报告、错误处理）时极易遗漏对另一个适配器的同步修改，历史审查已多次发现此类回归
- 重复明细:

| 方法 | GBA 行号 | MBC5 行号 | 结构相似度 |
|------|----------|----------|-----------|
| `readROMChunkWithRetry()` | 63-97 | 106-140 | 95% |
| `describeError()` | 102 | 145 | 100% |
| `buildRomSampleOffsets()` | 106-117 | 149-160 | 98% |
| `sampleRomRegionBlank()` | 123-150 | 166-193 | 88% |
| `eraseRomSectorWithRetry()` | 154-193 | 195-234 | 92% |
| `eraseSectors()` | ~250 行 | ~250 行 | 85% |
| `writeROM()` | ~350 行 | ~350 行 | 85% |
| `readROM()` | ~300 行 | ~300 行 | 90% |
| `verifyROM()` | ~400 行 | ~400 行 | 85% |
| 进度报告初始化模板 | 分布于 8+ 方法 | 分布于 8+ 方法 | 95% |

- 修复方向:
  - 将差异点（协议调用函数 `rom_*` vs `gbc_*`、地址计算、bank 窗口大小）抽象为策略接口
  - 在 `CartridgeAdapter` 基类中实现通用操作模板方法
  - 子类仅实现平台差异委托

### [P1-02] 重复的时序常量定义

- 位置: `gba-adapter.ts` L35-45, `mbc5-adapter.ts` L33-40
- 触发条件: 8 个完全相同的常量值在两个文件中独立定义
- 影响: 调整时序参数时需同步修改两处，遗漏将导致平台行为不一致

```
ROM_READ_START_SETTLE_MS = 100  (两处相同)
ROM_READ_RETRY_RESET_MS = 120   (两处相同)
ROM_WRITE_RETRY_RESET_MS = 150  (两处相同)
ROM_ERASE_RETRY_RESET_MS = 150  (两处相同)
ROM_WRITE_SAMPLE_COUNT = 4      (两处相同)
ROM_WRITE_SAMPLE_BYTES = 4      (两处相同)
RAM_READ_START_SETTLE_MS = 150   (两处相同)
RAM_READ_RETRY_RESET_MS = 150   (两处相同)
```

- 修复方向: 提取到 `CartridgeAdapter` 基类或共享常量模块

### [P1-03] PPB Unlock GBA/MBC5 大段复制 (~420 行)

- 位置: `services/tool-functions.ts` L96-357 (`ppbUnlockGBA`) 与 L361-571 (`ppbUnlockMBC5`)
- 触发条件: 两个函数各约 210 行，87% 结构相同
- 影响: PPB 解锁流程修改（如错误处理、进度上报、安全检查）需要在两处同步，遗漏风险高
- 差异点:
  - 协议调用: `rom_write`/`rom_read` vs `gbc_write`/`gbc_read`
  - 地址计算: GBA 线性地址 vs MBC5 bank 切换
  - i18n key 不同
- 修复方向:
  - 定义 `PPBDeviceOps` 接口抽象读/写/bank切换
  - 提取公共 `ppbUnlockCore(ops, device, ...)` 模板函数
  - GBA/MBC5 仅提供接口实现

### [P1-04] 适配器内部超长方法

- 位置: 两个适配器多处
- 触发条件: 多个方法超过 250 行
- 影响: 方法职责过多，难以单元测试、理解和维护

| 方法 | 文件 | 行数 |
|------|------|------|
| `verifyROM()` | gba-adapter / mbc5-adapter | ~400 |
| `writeROM()` | gba-adapter / mbc5-adapter | ~350 |
| `readROM()` | gba-adapter / mbc5-adapter | ~300 |
| `eraseSectors()` | gba-adapter / mbc5-adapter | ~250 |

- 修复方向: 将操作分解为独立步骤（初始化 → 分块处理 → 校验 → 清理），各步骤可独立测试

### [P1-05] 适配器中重复的进度初始化模板

- 位置: `gba-adapter.ts` 和 `mbc5-adapter.ts` 中 8+ 操作方法
- 触发条件: 每个操作方法重复相同的 SpeedCalculator + ProgressReporter 初始化套路：

```typescript
const speedCalculator = new SpeedCalculator();
const progressReporter = new ProgressReporter(...);
progressReporter.setSectors(...);
progressReporter.reportStart(...);
```

- 影响: 模板代码膨胀，修改进度初始化逻辑需改 16+ 处
- 修复方向: 封装 `createOperationProgressContext()` 工厂方法

### [P2-01] RTC 实现的验证与时间设置逻辑重复

- 位置: `services/rtc/gba-rtc.ts` 与 `services/rtc/mbc3-rtc.ts`
- 触发条件: `verifyTimeSet()` (92% 相似)、`setCurrentTime()` (100%)、`setTimeFromDateTime()` (75%) 结构类似
- 影响: 时间处理逻辑修改需同步两个 RTC 实现
- 修复方向: 将通用验证循环、DateTime 格式化逻辑上提到 `BaseRTC`

### [P2-02] tool-functions.ts 中大量未命名魔数

- 位置: `services/tool-functions.ts` 全文件
- 触发条件: GPIO 控制地址 (`0xc8 >> 1`, `0xc6 >> 1`, `0xc4 >> 1`)、PPB 命令序列 (`0x000555`, `0x0002aa`)、进度百分比 (5, 10, 20, 40, 70, 90, 100) 均为硬编码
- 影响: 可读性差，修改时容易引入错误
- 修复方向: 提取为命名常量（`GPIO_DIR_ADDR`, `PPB_UNLOCK_ADDR_1`, 等）

### [P2-03] mock-adapter.ts 进度模拟逻辑重复

- 位置: `services/mock-adapter.ts` 5+ 方法
- 触发条件: 进度模拟（`simulateProgress`）在多个模拟操作中重复
- 影响: 维护负担，修改模拟行为需改多处
- 修复方向: 提取通用 `simulateProgressLoop()` 工具方法

### [INFO-01] serial-service.ts 大量空操作方法

- 位置: `services/serial-service.ts` 全文件 (45 行)
- 触发条件: `onData()`, `onError()`, `onClose()`, `removeListeners()`, `getConnection()`, `closeAllConnections()` 均为空实现
- 影响: 可能为遗留代码，增加理解成本
- 修复方向: 确认是否为死代码，如是则移除

### [INFO-02] searchBatteryless 及相关方法集成不完整

- 位置: `services/gba-adapter.ts` batteryless 相关方法
- 触发条件: 功能分支代码存在但集成状态不明确
- 影响: 增加文件长度和理解负担
- 修复方向: 确认功能状态，完整集成或标记为实验性

## 漏检复盘

- 已主动复查的高风险模式:
  - 重复代码块: 已覆盖主要重复（适配器镜像、PPB、RTC、进度模板）
  - 魔数/魔字符串: 已覆盖关键位置
  - 命名不一致: GBA 中 `switchROMBank()` vs MBC5 中 `switchRomBank()` — 大小写不一致但未单独列出，属于镜像复制的副作用
- 本 phase 仍然证据不足的点:
  - 适配器中 batteryless 功能的完整度需进一步确认

## 未覆盖区域

- `services/lk/` — LK 多卡菜单相关服务，独立模块，留待 Phase 5
- `services/device-connection-manager.ts` — 留待 Phase 4
