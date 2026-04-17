## Context

web-client 的解析器层包含两个核心文件：`cfi-parser.ts`（596 行，CFI flash 信息解析）和 `rom-parser.ts`（570 行，ROM 头部解析）。代码审查（review-2026-04-17 Phase 5）发现 `CFIParser.parse()` 约 380 行是单个方法，包含偏移量解析、位操作、状态积累等多种职责。`rom-parser.ts` 中 logo 验证和 checksum 计算有 GBA/GB 两组结构相似的独立实现。`rom-editor.ts` 中的 ROM 更新函数和 `rom-assembly-utils.ts` 中的颜色生成函数也有类似重复。

本变更依赖 `shared-constants-extraction` 已完成的偏移量常量定义（`GBA_HEADER`/`GB_HEADER` 对象）。如果常量提取尚未实施，本变更在提取子方法时可同步定义局部常量。

## Goals / Non-Goals

**Goals:**
- 将 `CFIParser.parse()` 分解为 4-6 个职责单一的子方法，每个不超过 80 行
- 将 CFI 解析器的硬编码偏移量提取为命名常量对象
- 统一 GBA/GB 的 logo 验证和 checksum 计算为参数化函数
- 统一 `updateGBARom()`/`updateGBRom()` 为参数化模板
- 统一 `generateSlotColor()`/`generateFileColor()` 为参数化函数
- 保持所有公开 API 签名不变

**Non-Goals:**
- 不改变解析结果的数据结构（`CFIInfo`、`RomInfo` 等接口不变）
- 不改变解析器的错误处理行为
- 不优化解析性能
- 不合并 `cfi-parser.ts` 和 `rom-parser.ts`（它们解析不同格式，应保持独立）
- 不涉及适配器层或协议层的重构

## Decisions

### D1: CFIParser.parse() 分解策略

按 CFI 规范的数据区域划分子方法：

| 子方法 | 职责 | 对应 CFI 区域 |
|--------|------|-------------|
| `parseQueryInfo()` | 解析查询信息字符串和基本参数 | Query identification string |
| `parsePrimaryAlgorithm()` | 解析主算法命令集 | Primary algorithm command set |
| `parseExtendedQuery()` | 解析扩展查询表 | Extended query table |
| `parseGeometry()` | 解析擦除块区域几何 | Erase block region info |
| `parseProtectionInfo()` | 解析保护寄存器信息 | Protection register info |

每个子方法接收 buffer 和当前偏移量，返回解析结果和更新后的偏移量。主 `parse()` 方法变为编排器。

### D2: rom-parser.ts 参数化策略

```typescript
// 统一的 logo 验证
function validateLogo(data: Uint8Array, logo: Uint8Array, offset: number): boolean

// 统一的 checksum 计算
function calculateHeaderChecksum(data: Uint8Array, range: { start: number; end: number }, initial: number): number
```

原有的 `validateGBALogo()`/`validateGBLogo()` 和 `calculateGBAChecksum()`/`calculateGBChecksum()` 保留为薄包装函数以维持 API 兼容性，内部委托给参数化实现。

### D3: rom-editor.ts 参数化策略

定义字段映射结构：

```typescript
interface RomFieldMap {
  title: { offset: number; maxLength: number };
  gameCode?: { offset: number; maxLength: number };
  makerCode: { offset: number; maxLength: number };
  checksumRange: { start: number; end: number };
  checksumOffset: number;
  checksumFn: (data: Uint8Array) => number;
}
```

`updateRomInfo()` 根据 ROM 类型选择对应的 field map，统一执行字段写入和 checksum 更新。

### D4: 颜色生成统一

```typescript
function generateHslColor(index: number, saturation: number, lightness: number): string
```

`generateSlotColor()` 和 `generateFileColor()` 委托给统一实现。

## Risks / Trade-offs

- [风险] CFIParser 分解可能引入子方法间状态传递的复杂度 → 使用结构化返回值而非 class 状态累积
- [风险] 保留原有 API 包装函数增加了间接层 → 取舍可接受，维护向后兼容性优先
- [取舍] 偏移量常量可能与 `shared-constants-extraction` 的常量定义有重叠 → 如果该变更先实施，直接在此变更中定义 CFI 专用常量
