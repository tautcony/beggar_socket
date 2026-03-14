# 模块：Application（Burner）

## 目录

### 应用用例层（`src/features/burner/application/`）
- `burner-use-case.ts`: 烧录用例（读卡、擦除、读写校验、多卡扫描）
- `burner-session.ts`: 会话状态（busy/abort/progress/log）
- `connection-use-case.ts`: 设备连接用例（`ConnectionOrchestrationUseCase`）
- `flow-template.ts`: 统一流程模板（开始/异常/取消/收尾）
- `factory.ts`: `BurnerFacade` 工厂函数（`createBurnerFacade`）
- `types.ts`: 应用层契约模型
- `index.ts`: 统一导出

### Domain 契约（`src/features/burner/application/domain/`）
- `ports.ts`: `BurnerConnectionPort`、`BurnerCartridgePort` 接口定义
- `result.ts`: `BurnerDomainResult` 结果类型
- `connection.ts`: `ConnectionState`、`ConnectionSnapshot`、`ConnectionFailure` 等连接域类型
- `error-mapping.ts`: 错误到 `ConnectionFailureCode` 的映射

### 端口适配器（`src/features/burner/adapters/`）
- `cartridge-protocol-port.ts`: `CartridgeProtocolPortAdapter`（将 `protocol` 层包装为 `BurnerCartridgePort`）
- `device-gateway-connection-port.ts`: `DeviceGatewayConnectionPortAdapter`（将 `platform/serial` 网关包装为 `BurnerConnectionPort`）
- `connection-orchestration-factory.ts`: `createConnectionOrchestrationUseCase` 工厂
- `index.ts`: 统一导出

## 模块设计
- `burner-use-case.ts`: 烧录用例（读卡、擦除、写入、读取、校验、多卡扫描），对外暴露 `BurnerFacade` 接口与 `BurnerFacadeImpl`
- `burner-session.ts`: 会话状态（busy、abort、progress、log），供 composables 订阅
- `connection-use-case.ts`: `ConnectionOrchestrationUseCase`，管理连接状态机（idle/connecting/connected/failed）
- `flow-template.ts`: `runBurnerFlow`，统一生命周期（busy、abort、progress、log）
- `factory.ts`: `createBurnerFacade`，组装 `CartridgeProtocolPortAdapter` + `BurnerUseCaseImpl`
- `domain/ports.ts`: 定义应用层依赖的接口，隔离底层实现

## 职责
- 封装用例：读卡、擦除、写入、读取、校验、多卡扫描、设备连接。
- 统一生命周期：busy、abort、progress、log。
- 收敛取消、异常、收尾逻辑。
- 统一流程语义，减少组件编排复杂度，成为 UI 与 adapter 的稳定接口。

## 核心对象
- `BurnerUseCase` / `BurnerFacade` / `BurnerFacadeImpl`: 用例入口
- `BurnerSession`: 运行时会话状态
- `ConnectionOrchestrationUseCase`: 连接状态机
- `runBurnerFlow`: 流程模板
- `BurnerConnectionPort`: 连接端口接口（domain 契约）
- `CartridgeProtocolPortAdapter`: 协议端口适配器

## 约束
- `features/burner/application` 只能依赖 domain ports/adapters，不能直接导入 `platform/serial` 或 `services` 内部实现。
- adapters 层负责把 `platform` / `protocol` 接入 domain ports，不允许向上泄漏底层细节。
