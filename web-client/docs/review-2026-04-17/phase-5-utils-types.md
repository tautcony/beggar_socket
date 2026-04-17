# Phase 5 审查报告: 工具与类型层

> 日期: 2026-04-17
> 文件数: 20
> 发现: P0(0) / P1(2) / P2(5) / INFO(2)

## 已审查文件

- `utils/parsers/cfi-parser.ts` (596 行)
- `utils/parsers/rom-parser.ts` (570 行)
- `utils/rom/rom-editor.ts` (140 行)
- `utils/rom/rom-assembly-utils.ts` (324 行)
- `utils/compression-utils.ts` (240 行)
- `utils/crc-utils.ts` (45 行)
- `utils/formatter-utils.ts` (152 行)
- `utils/port-filter.ts` (163 行)
- `utils/sector-utils.ts` (73 行)
- `utils/progress/progress-builder.ts` (157 行)
- `utils/progress/progress-reporter.ts` (261 行)
- `utils/progress/speed-calculator.ts` (193 行)
- `utils/monitoring/sentry-tracker.ts` (141 行)
- `utils/log-viewer.ts` (7 行)
- `utils/markdown.ts` (81 行)
- `utils/translation.ts` (96 行)
- `types/progress-info.ts` (45 行)
- `types/rom-assembly.ts` (37 行)
- `types/file-info.ts` (4 行)
- `services/lk/imageUtils.ts` (200 行)

## Findings

### [P1-01] cfi-parser.ts 的 parse() 方法极度过长 (~380 行)

- 位置: `utils/parsers/cfi-parser.ts` `CFIParser.parse()`
- 触发条件: 单个方法包含 CFI 结构解析、偏移量处理、位操作、状态积累等多种职责，约 380 行
- 影响: 极难理解、测试和维护；修改解析逻辑时容易引入回归
- 修复方向:
  - 按 CFI 结构分段提取子方法: `parseQueryInfo()`, `parsePrimaryAlgorithm()`, `parseExtendedQuery()`, `parseProtectionInfo()`
  - 将 20+ 个硬编码偏移量提取为命名常量对象

### [P1-02] rom-parser.ts 中 parseGBRom() / parseGBARom() 过长且偏移量散列

- 位置: `utils/parsers/rom-parser.ts`
- 触发条件:
  - `parseGBRom()` ~110 行，`parseGBARom()` ~80 行
  - ROM header 偏移量 (`0xA0`, `0xAC`, `0xB0`, `0xBC`, `0xBD`, `0x104`, `0x134`, `0x147` 等 15+) 全部硬编码
  - 两个 checksum 函数 (`calculateGBAChecksum`, `calculateGBChecksum`) 结构相似
  - 两个 logo 验证函数 (`validateGBALogo`, `validateGBLogo`) 逻辑相同
- 影响: 偏移量散布使结构变更难以跟踪，重复逻辑增加维护负担
- 修复方向:
  - 定义 `GBA_HEADER_OFFSETS` 和 `GB_HEADER_OFFSETS` 常量对象
  - 参数化 `validateLogo(data, expectedLogo, offset)` 和 `calculateChecksum(data, range, initialValue)`

### [P2-01] updateGBARom() 与 updateGBRom() 逻辑重复

- 位置: `utils/rom/rom-editor.ts`
- 触发条件: 两个函数结构相似——获取字段 → 编码到 buffer → 更新校验和——但偏移量和校验和算法不同
- 影响: ROM 编辑逻辑修改需同步两处
- 修复方向: 参数化偏移量映射，提取通用 `updateRomFields(data, fieldMap, checksumFn)` 模板

### [P2-02] generateSlotColor() 与 generateFileColor() HSL 生成逻辑重复

- 位置: `utils/rom/rom-assembly-utils.ts`
- 触发条件: 两个函数都基于黄金比例角生成 HSL 颜色，差异仅在饱和度和亮度参数
- 影响: 颜色生成策略修改需同步两处
- 修复方向: 提取 `generateHslColor(index, saturation, lightness)` 通用函数

### [P2-03] FileInfo 类型重复定义

- 位置: `types/file-info.ts` 与 `types/rom-assembly.ts` 均定义了 `FileInfo` 接口
- 触发条件: 两处定义可能结构相同或近似
- 影响: 类型不统一，使用方可能引入错误的 import
- 修复方向: 在 `types/file-info.ts` 保留唯一定义，`rom-assembly.ts` 从中 import

### [P2-04] sentry-tracker.ts 中 trackAsyncOperation/trackSyncOperation 重复

- 位置: `utils/monitoring/sentry-tracker.ts`
- 触发条件: 两个方法的 Sentry span 创建、状态设置、错误处理逻辑近似
- 影响: 修改追踪逻辑需同步两处
- 修复方向: 提取内部 `withSpan(name, fn)` 通用方法

### [P2-05] 魔数集中区域

- 位置: 多个工具文件
- 触发条件:

| 文件 | 魔数示例 | 出现次数 |
|------|---------|---------|
| `rom-assembly-utils.ts` | `0x400000` (4MB) | 4 |
| `rom-assembly-utils.ts` | `0x200000` (2MB) | 5 |
| `rom-assembly-utils.ts` | `0.618033988749` (黄金比例) | 2 |
| `cfi-parser.ts` | 20+ 个偏移量 (`0x20`, `0x22`, `0x36`...) | 20+ |
| `rom-parser.ts` | 15+ 个偏移量 (`0xA0`, `0x134`...) | 15+ |
| `translation.ts` | `4500`, `1500` (文本截断长度) | 2 |
| `log-viewer.ts` | `50` (自动滚动阈值) | 1 |
| `speed-calculator.ts` | `3000`, `500`, `0.3` (窗口/阈值/平滑因子) | 3 |
| `services/lk/romBuilder.ts` | `0x400000`, `0x80000`, `0x40000`, `0x1000` | 多处 |

- 影响: 可读性差，修改时难以理解数值含义
- 修复方向: 按领域分组提取常量:
  - `ROM_SIZE_4MB`, `ROM_SIZE_2MB`, `ROM_SIZE_1MB`
  - `CFI_OFFSET_*`, `GBA_HEADER_OFFSET_*`, `GB_HEADER_OFFSET_*`
  - `GOLDEN_RATIO`

### [INFO-01] SectorStateCode 使用数字类型而非 enum

- 位置: `types/progress-info.ts`
- 触发条件: `SectorStateCode` 定义为 `0|1|2|3|4|5|6|7` 数字联合类型，需要注释才能理解各状态含义
- 影响: 使用时需查阅注释，容易混淆状态码
- 修复方向: 转为 enum 或 const 对象:

```typescript
const SectorState = { IDLE: 0, PENDING: 1, READING: 2, ... } as const;
```

### [INFO-02] port-filter.ts 中 ID 标准化逻辑重复

- 位置: `utils/port-filter.ts`
- 触发条件: `matchesDeviceIdentifier()` 和 `deviceIdentifierToWebSerialFilter()` 都进行 vendor/product ID 的 hex→number 标准化
- 影响: 轻微重复，但两个函数的输入输出格式不同
- 修复方向: 提取 `normalizeId(id)` 内部工具函数

## 漏检复盘

- 已主动复查的高风险模式:
  - 重复解析逻辑: 已覆盖 CFI/ROM parser、ROM editor
  - 魔数: 已系统性检查所有工具文件
  - 类型重复: 已发现 FileInfo 双重定义
  - 工具函数重复: 已覆盖颜色生成、Sentry 追踪、CRC、logo 验证
  - 编码/格式: `crc-utils.ts` 的 `modbusCRC16()` 和 `modbusCRC16_lut()` 是同算法两实现（LUT 版本为性能优化），不算冗余重复
- 本 phase 仍然证据不足的点:
  - `services/lk/` 子目录的 `romBuilder.ts`/`imageUtils.ts`/`cli.ts` 有 magic number 散布，但作为独立功能模块，与主体代码的重复有限
  - `imageUtils.ts` 中 `generateRgb555PreviewImage()`/`generateIndexedPreviewImage()` 有约 90% 重叠，可参数化合并

## 未覆盖区域

- `utils/async-utils.ts` — 95 行，无重复问题
- `utils/burner-log.ts` — 7 行，无重复
- `utils/tauri.ts` — 40 行，无重复
- `utils/errors/` — 2 个小文件，无重复
