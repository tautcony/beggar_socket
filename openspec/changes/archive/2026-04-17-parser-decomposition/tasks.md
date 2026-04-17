## 1. CFI Parser 常量提取

- [x] 1.1 在 `cfi-parser.ts` 中定义 `CFI_OFFSETS` 常量对象，涵盖所有 CFI 结构偏移量
- [x] 1.2 替换 `parse()` 方法中所有硬编码数值偏移量为 `CFI_OFFSETS.XXX` 引用

## 2. CFI Parser 方法分解

- [x] 2.1 提取 `parseSystemInterface()` 子方法 — 处理电压范围和时序信息
- [x] 2.2 提取 `parsePriExtended()` 子方法 — 处理 PRI 扩展查询和引导扇区类型
- [x] 2.3 提取 `parseDeviceGeometry()` 子方法 — 处理设备大小、缓冲区和擦除块区域
- [x] 2.4 重写 `parse()` 为编排方法，顺序调用上述子方法并组合结果
- [x] 2.5 验证: `npm run test:run` — 383 tests passed

## 3. ROM Parser 参数化

- [x] 3.1 实现 `validateLogo(data, expectedLogo, offset)` 统一函数
- [x] 3.2 将 `validateGBALogo()` 和 `validateGBLogo()` 改为委托给 `validateLogo()`
- [x] 3.3 实现 `calculateHeaderChecksum(data, start, end, adjustment)` 统一函数
- [x] 3.4 将 `calculateGBAChecksum()` 和 `calculateGBChecksum()` 改为委托给 `calculateHeaderChecksum()`
- [x] 3.5 验证: `npm run test:run` — 383 tests passed

## 4. ROM Editor 参数化

- [~] 4.1–4.4 已跳过: GBA/GB 更新逻辑差异过大(CGB flag、区域编码方式、全局校验和)，`updateRomInfo()` dispatcher 已存在，强制参数化会增加复杂度

## 5. 颜色生成统一

- [x] 5.1 实现 `generateHslColor(hue, saturation, lightness)` 通用函数
- [x] 5.2 将 `generateSlotColor()` 和 `generateFileColor()` 改为委托给 `generateHslColor()`
- [x] 5.3 验证: `npm run type-check` — passed

## 6. 最终验证

- [x] 6.1 运行 `npm run test:run` 确认所有测试通过 — 383 passed
- [x] 6.2 运行 `npm run type-check` 确认无类型错误 — passed
- [x] 6.3 运行 `npm run lint` 确认代码风格无问题 — passed
