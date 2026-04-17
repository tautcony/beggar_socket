# Phase 4 审查报告: 编排/状态/配置层重复

> 日期: 2026-04-17
> 文件数: 14
> 发现: P0(0) / P1(2) / P2(5) / INFO(2)

## 已审查文件

- `features/burner/application/burner-use-case.ts` (354 行)
- `features/burner/application/burner-session.ts` (90 行)
- `features/burner/application/connection-use-case.ts` (259 行)
- `features/burner/application/flow-template.ts` (52 行)
- `features/burner/application/types.ts` (15 行)
- `features/burner/application/domain/error-mapping.ts` (101 行)
- `features/burner/application/domain/result.ts` (45 行)
- `features/burner/application/domain/ports.ts` (72 行)
- `features/burner/adapters/cartridge-protocol-port.ts` (151 行)
- `features/burner/adapters/device-gateway-connection-port.ts` (95 行)
- `composables/cartburner/useCartBurnerFileState.ts` (145 行)
- `composables/cartburner/useCartBurnerSessionState.ts` (168 行)
- `settings/advanced-settings.ts` (518 行)
- `settings/debug-settings.ts` (216 行)

## Findings

### [P1-01] AdvancedSettings 16 组 getter/setter 机械重复 (~128 行)

- 位置: `settings/advanced-settings.ts` L60-202
- 触发条件: 16 个配置属性各有 8 行完全相同模式的 getter/setter：

```typescript
static get romPageSize(): number { return this._romPageSize; }
static set romPageSize(value: number) {
  this._romPageSize = this.validatePageSize(value);
  this.saveSettings();
}
```

- 唯一差异: 属性名、验证函数名
- 影响: 128 行纯模板代码，添加新配置项需手动复制模式，容易遗漏 `saveSettings()` 调用
- 修复方向:
  - 使用属性描述符映射表驱动 getter/setter 生成
  - 或使用 `Proxy` 模式拦截属性访问
  - 或使用装饰器模式 (`@Persisted @Validated(validatePageSize)`)

### [P1-02] AdvancedSettings validateSettings() 验证逻辑机械重复 (~71 行)

- 位置: `settings/advanced-settings.ts` L459-530
- 触发条件: `validateSettings()` 对每个配置项执行相同的边界检查模式：

```typescript
if (settings.size?.romPageSize !== undefined) {
  if (settings.size.romPageSize < MIN_ROM_PAGE_SIZE || settings.size.romPageSize > MAX_ROM_PAGE_SIZE) {
    errors.push(`...`);
  }
}
```

- 此模式重复 20+ 次
- 影响: 添加新配置项时需要复制验证块，容易遗漏
- 修复方向: 使用数据驱动的验证：

```typescript
const rules = [
  { path: 'size.romPageSize', min: MIN, max: MAX, label: '...' },
  ...
];
```

### [P2-01] DEFAULT_PROGRESS 常量定义重复

- 位置: `composables/cartburner/useCartBurnerSessionState.ts` L9-18, `features/burner/application/burner-session.ts` L7-16
- 触发条件: 完全相同的 `ProgressInfo` 默认对象在两个文件中独立定义
- 影响: 修改默认进度状态需同步两处
- 修复方向: 提取到 `utils/progress/` 或 `types/` 下的共享常量

### [P2-02] useCartBurnerFileState ROM/RAM 处理器镜像复制

- 位置: `composables/cartburner/useCartBurnerFileState.ts` 全文件
- 触发条件: 4 对处理器函数逻辑 100% 相同，仅变量名和 i18n key 不同：

| ROM 处理器 | RAM 处理器 | 相同度 |
|-----------|-----------|--------|
| `onRomFileSelected` | `onRamFileSelected` | 100% |
| `onRomFileCleared` | `onRamFileCleared` | 100% |
| `onRomSizeChange` | `onRamSizeChange` | 100% |
| `onRomBaseAddressChange` | `onRamBaseAddressChange` | 100% |

- 影响: 修改文件选择/清除/大小变更逻辑需同步两组函数
- 修复方向: 工厂函数生成处理器：

```typescript
function createFileHandlers(type: 'rom' | 'ram') {
  return { onFileSelected, onFileCleared, onSizeChange, onBaseAddressChange };
}
```

### [P2-03] burner-use-case.ts 过大且包含两个类

- 位置: `features/burner/application/burner-use-case.ts` (354 行)
- 触发条件: 文件包含 `BurnerUseCaseImpl` (154 行) + `BurnerFacadeImpl` (137 行) + 接口定义 + 工具函数
- 影响: 单个文件承载过多职责，定位困难
- 修复方向: 将 `BurnerFacadeImpl` 拆分到独立文件

### [P2-04] ensureSessionActive() 在 12 个方法中重复调用

- 位置: `features/burner/application/burner-use-case.ts` 全文件
- 触发条件: 每个公开方法开头都执行 `const session = this.ensureSessionActive()` 守卫
- 影响: 模板代码略显冗余，但因每个方法都需要 session，当前无更好方案
- 修复方向: 保持现状或考虑 AOP/装饰器模式（收益有限）

### [P2-05] 适配器层 hardcoded 错误消息字符串

- 位置: `features/burner/adapters/cartridge-protocol-port.ts` 9 处
- 触发条件: `'Read cart info failed'`, `'Erase sectors failed'`, `'Write ROM failed'` 等 9 个硬编码回退消息
- 影响: 消息分散，无法统一管理或国际化
- 修复方向: 提取到常量对象或使用 i18n

### [INFO-01] useEnvironment.ts 并非真正的 composable

- 位置: `composables/useEnvironment.ts` (41 行)
- 触发条件: 定义了 `Environment` 静态类而非 Vue composable（无响应式状态），放在 `composables/` 目录下有误导性
- 影响: 目录语义不准确
- 修复方向: 移到 `utils/` 或重命名文件

### [INFO-02] rom-assembly-store 模块级可变状态

- 位置: `stores/rom-assembly-store.ts` `cleanupTimer` 变量
- 触发条件: 模块级 `let cleanupTimer` 在 store 外部管理定时器，Pinia store 重新创建时可能残留
- 影响: 测试隔离问题
- 修复方向: 将定时器管理纳入 store 内部

## 漏检复盘

- 已主动复查的高风险模式:
  - 重复常量: 已发现 DEFAULT_PROGRESS 双重定义
  - 重复处理器: 已发现 ROM/RAM handler 镜像
  - 模板代码: 已发现 AdvancedSettings getter/setter 和 validateSettings 机械重复
  - 命名不一致: `useEnvironment` 非 composable 已标注
- 本 phase 仍然证据不足的点:
  - `connection-use-case.ts` (259 行) 中 `prepareConnection()` 和 `prepareConnectionWithSelection()` 共享类似守卫逻辑，但差异较大，未计为严重重复

## 未覆盖区域

- `features/burner/application/domain/connection.ts` — 纯类型定义，无重复
- `features/burner/adapters/connection-orchestration-factory.ts` — 5 行，无重复
