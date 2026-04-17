## Why

web-client 的两个核心解析器 `cfi-parser.ts` (596 行) 和 `rom-parser.ts` (570 行) 包含极度过长的方法和大量散列的硬编码偏移量。`CFIParser.parse()` 约 380 行，混合了 CFI 查询信息解析、主算法解析、扩展查询和保护信息等多种职责。`parseGBRom()` 约 110 行、`parseGBARom()` 约 80 行，15+ 个 ROM header 偏移量硬编码其中。两个 logo 验证函数和两个 checksum 计算函数结构高度相似但独立实现。此外 `rom-editor.ts` 中 `updateGBARom()` 和 `updateGBRom()` 也存在逻辑重复。

## What Changes

- 将 `CFIParser.parse()` 按 CFI 结构分段提取为 `parseQueryInfo()`、`parsePrimaryAlgorithm()`、`parseExtendedQuery()`、`parseProtectionInfo()` 等子方法
- 将 CFI 解析器的 20+ 个硬编码偏移量提取为命名常量
- 参数化 `validateLogo()` 函数，统一 `validateGBALogo()` 和 `validateGBLogo()` 逻辑
- 参数化 `calculateChecksum()` 函数，统一 `calculateGBAChecksum()` 和 `calculateGBChecksum()` 逻辑
- 参数化 `updateRomFields()` 模板，减少 `updateGBARom()` 和 `updateGBRom()` 之间的重复
- 提取 `generateHslColor(index, saturation, lightness)` 通用函数，统一 `generateSlotColor()` 和 `generateFileColor()`

## Capabilities

### New Capabilities
- `parser-internal-structure`: 定义 CFI 和 ROM 解析器的内部方法分解和偏移量常量化规范

### Modified Capabilities

## Impact

- `utils/parsers/cfi-parser.ts` — 大幅重构 parse() 方法，提取子方法和常量
- `utils/parsers/rom-parser.ts` — 参数化重复函数，提取偏移量常量（依赖 `shared-constants-extraction` 完成后的偏移量常量）
- `utils/rom/rom-editor.ts` — 参数化 ROM 更新逻辑
- `utils/rom/rom-assembly-utils.ts` — 提取颜色生成通用函数
- 纯内部重构，不改变任何公开 API 签名，所有现有测试应继续通过
