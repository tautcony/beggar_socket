# Web Client 模块现状诊断

## 范围
- 目录：`web-client/src`
- 目标：识别模块边界不清、耦合穿透、重复实现与维护风险

## 当前结构概览
- 展示层：`views`、`components`
- 业务/设备层：`services`
- 协议层：`protocol/beggar_socket`
- 工具与解析：`utils`
- 状态：`stores`
- 配置：`settings`
- 类型：`types`

## 主要问题

### 1. 组件职责过载，编排逻辑集中
- `CartBurner.vue` 同时承担：
  - 设备操作编排（读/写/擦/校验）
  - 适配器创建与选择
  - 文件处理与导出
  - 日志与进度控制
  - 模式判定与多卡扫描
- 结果：单文件过大、修改冲突频繁、回归风险高。

### 2. 分层穿透：UI 直接依赖协议实现
- 组件直接引入 `protocol/*`：
  - `CartBurner.vue` 直接使用 `protocol-utils`
  - `DebugToolModal.vue` 直接使用命令枚举、payload builder、收发函数
- 结果：协议变更会影响 UI，难以替换协议实现。

### 3. 分层倒挂：基础层依赖服务层
- `types/device-info.ts` 依赖 `services/serial-service` 中的类型。
- `utils/port-filter.ts` 依赖 `services/serial-service` 的端口类型。
- 结果：`types/utils` 失去“基础层”属性，复用和测试边界被破坏。

### 4. 协议层职责混杂
- `protocol-adapter.ts` 同时耦合：
  - 串口服务实现（`SerialService`）
  - 运行配置（`AdvancedSettings`）
- 结果：协议层不是纯通信协议，替换传输或配置来源成本高。

### 5. 重复实现与逻辑分叉（Phase 3 已收敛）
- MBC 类型识别逻辑重复：
  - 已统一到 `utils/parsers/rom-parser.ts`（组件内重复实现已移除）
- 读取函数重复：
  - 已统一到 `protocol-adapter -> transport.read` 调用链
- 当前结果：规则与读包路径已收敛，行为一致性风险显著下降。

### 6. 测试覆盖与架构风险不匹配
- 当前测试偏 `utils` 单测。
- 对“设备连接 -> 协议收发 -> 业务流程”链路缺少应用层集成保护。
- 结果：重构主流程时缺乏快速反馈。

## 风险总结
- 可维护性：低（高耦合 + 巨型组件）
- 可演进性：中低（协议和传输难替换）
- 一致性：中低（存在重复逻辑）
- 可测试性：中（主链路集成不足）

## 结论
- 当前实现可运行，但模块边界未收敛到“展示/编排/领域/基础设施”分层模型。
- 下一阶段应优先拆分应用编排层，并建立依赖约束，防止继续劣化。
