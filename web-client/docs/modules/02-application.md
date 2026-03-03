# 模块：Application（Burner）

## 目录
- `src/features/burner/application/burner-use-case.ts`
- `src/features/burner/application/burner-session.ts`
- `src/features/burner/application/flow-template.ts`
- `src/features/burner/application/types.ts`

## 模块设计
- `burner-use-case.ts`: 烧录用例（读卡、擦除、读写校验、多卡扫描）
- `burner-session.ts`: 会话状态（busy/abort/progress/log）
- `flow-template.ts`: 统一流程模板（开始/异常/取消/收尾）
- `types.ts`: 应用层契约模型

## 职责
- 封装用例：读卡、擦除、写入、读取、校验、多卡扫描。
- 统一生命周期：busy、abort、progress、log。
- 收敛取消、异常、收尾逻辑。
- 统一流程语义，减少组件编排复杂度，成为 UI 与 adapter 的稳定接口。

## 核心对象
- `BurnerUseCase` / `BurnerFacade`: 用例入口
- `BurnerSession`: 运行时会话状态
- `runBurnerFlow`: 流程模板
