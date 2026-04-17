## 1. CFI Parser 常量提取

- [ ] 1.1 在 `cfi-parser.ts` 中定义 `CFI_OFFSETS` 常量对象，涵盖所有 CFI 结构偏移量
- [ ] 1.2 替换 `parse()` 方法中所有硬编码数值偏移量为 `CFI_OFFSETS.XXX` 引用

## 2. CFI Parser 方法分解

- [ ] 2.1 提取 `parseQueryInfo()` 子方法 — 处理 CFI 查询标识字符串和基本参数
- [ ] 2.2 提取 `parsePrimaryAlgorithm()` 子方法 — 处理主算法命令集
- [ ] 2.3 提取 `parseExtendedQuery()` 子方法 — 处理扩展查询表
- [ ] 2.4 提取 `parseGeometry()` 子方法 — 处理擦除块区域几何信息
- [ ] 2.5 提取 `parseProtectionInfo()` 子方法 — 处理保护寄存器信息
- [ ] 2.6 重写 `parse()` 为编排方法，顺序调用上述子方法并组合结果
- [ ] 2.7 验证: `npm run test:run -- cfi-parser`

## 3. ROM Parser 参数化

- [ ] 3.1 实现 `validateLogo(data, expectedLogo, offset)` 统一函数
- [ ] 3.2 将 `validateGBALogo()` 和 `validateGBLogo()` 改为委托给 `validateLogo()`
- [ ] 3.3 实现 `calculateHeaderChecksum(data, range, initial)` 统一函数
- [ ] 3.4 将 `calculateGBAChecksum()` 和 `calculateGBChecksum()` 改为委托给 `calculateHeaderChecksum()`
- [ ] 3.5 验证: `npm run test:run -- rom-parser`

## 4. ROM Editor 参数化

- [ ] 4.1 定义 `RomFieldMap` 接口和 GBA/GB 两组字段映射配置
- [ ] 4.2 实现通用 `updateRomInfo()` 函数，根据 ROM 类型选择字段映射执行更新
- [ ] 4.3 将 `updateGBARom()` 和 `updateGBRom()` 改为委托给 `updateRomInfo()`
- [ ] 4.4 验证: `npm run type-check`

## 5. 颜色生成统一

- [ ] 5.1 实现 `generateHslColor(index, saturation, lightness)` 通用函数
- [ ] 5.2 将 `generateSlotColor()` 和 `generateFileColor()` 改为委托给 `generateHslColor()`
- [ ] 5.3 验证: `npm run type-check`

## 6. 最终验证

- [ ] 6.1 运行 `npm run test:run` 确认所有测试通过
- [ ] 6.2 运行 `npm run type-check` 确认无类型错误
- [ ] 6.3 运行 `npm run lint` 确认代码风格无问题
