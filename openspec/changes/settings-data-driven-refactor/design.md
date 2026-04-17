## Context

`AdvancedSettings` 是一个静态类，管理 16 个持久化配置属性。每个属性有 getter（返回私有字段）、setter（验证 + 赋值 + 保存）、min/max 验证规则。当前全部手写，模式完全一致。

## Goals / Non-Goals

**Goals:**
- 用属性描述符映射表替代 16 组手写 getter/setter
- 用映射表驱动 `validateSettings()` 替代 20+ 个手写验证块
- 保持完全相同的外部 API 和运行时行为
- 新增配置项只需一行声明

**Non-Goals:**
- 不改变 localStorage 存储格式
- 不将 AdvancedSettings 从静态类改为 Pinia store（单独讨论）
- 不改变 DebugSettings（其规模不需要此重构）

## Decisions

### D1: 使用 PropertyDescriptor 映射表 + Object.defineProperty

定义描述符数组：
```typescript
interface SettingDescriptor {
  key: string;         // 外部属性名
  group: string;       // 配置组（size, throttle, retry, timeout）
  field: string;       // 配置组内的字段名
  default: number;
  validator: (v: number) => number;
}
```

在类初始化时遍历描述符，通过 `Object.defineProperty` 注册 getter/setter。

**替代方案**: Proxy 模式。未采用，因为 Proxy 与 TypeScript 静态类的类型推导兼容性差，且当前代码的调用方依赖静态属性的类型提示。

### D2: 验证逻辑从映射表派生

`validateSettings()` 遍历描述符数组，对每个配置项自动应用范围检查，不再手写每个属性的 if 块。

## Risks / Trade-offs

- [风险] Object.defineProperty 的 TypeScript 类型推导不如手写属性直观 → 保留类型声明接口，确保外部调用方类型安全
- [取舍] 运行时微弱的初始化开销（一次性 defineProperty 循环） → 可忽略
