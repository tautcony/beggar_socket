# Web Client 模块改造方案

## 改造原则
- 先立边界，再迁移逻辑，最后去重优化
- 小步快跑，每步可回滚
- 每阶段有可观测验收标准

## 分阶段方案

## Phase 0：建立防劣化机制（优先级 P0）
### 动作
- 增加 ESLint 依赖约束（`import/no-restricted-paths`）：
  - 禁止 `components/views -> protocol`
  - 禁止 `types/utils -> services`
- 输出依赖检查脚本（统计跨层引用）

### 产出
- 规则文件更新
- 依赖检查命令文档

### 验收
- 新增代码不能继续穿透边界

## Phase 1：抽取 Burner 应用编排层（优先级 P0）
### 动作
- 新建 `features/burner/application`：
  - `BurnerUseCase`（读卡、擦写、校验、多卡扫描）
  - `BurnerSession`（busy、abort、progress、log 状态机）
- `CartBurner.vue` 迁移为“调用用例 + 展示状态”

### 产出
- 组件逻辑显著缩减
- 主流程从组件迁移到 use case

### 验收
- `CartBurner.vue` 不再直接操作协议工具与适配器实例

## Phase 2：统一设备与传输网关（优先级 P1）
### 动作
- 合并 `DeviceConnectionManager` + `SerialService` 的职责交叉
- 定义统一接口：
  - `DeviceGateway`（connect/disconnect/init/list/select）
  - `Transport`（send/read/setSignals）
- 协议层只依赖 `Transport` 接口，不依赖具体 SerialService

### 产出
- Web/Electron 差异收敛到 `platform/serial`

### 验收
- `protocol-adapter` 不再直接依赖 `SerialService`

## Phase 3：去重与规则归位（优先级 P1）
> 状态：已完成（2026-03-02）

### 动作
- 删除 `CartBurner.vue` 内部 `detectMbcType`，统一使用 parser 实现
- 合并重复读包函数，只保留一套
- 提取通用流程模板（日志、进度、取消、错误处理）

### 产出
- 行为一致性提升，重复维护点下降

### 验收
- 重复函数仅保留单一实现

### 实现落点
- `web-client/src/utils/parsers/rom-parser.ts`
  - 新增结构化入口 `detectMbcTypeFromRom`，`detectMbcType` 退化为兼容包装
- `web-client/src/components/CartBurner.vue`
  - MBC 判定改为 parser 统一入口
  - ROM/RAM/多卡流程统一接入 `runBurnerFlow` 模板
- `web-client/src/features/burner/application/flow-template.ts`
  - 新增通用流程模板，收敛 busy/progress/cancel/error 生命周期
- `web-client/src/protocol/beggar_socket/protocol-utils.ts`
  - 删除重复的 reader 读包实现，仅保留通过 `ProtocolAdapter` 的统一调用入口
- `web-client/src/platform/serial/transports.ts`
  - 保留唯一 reader 实现（协议调用链经 `ProtocolAdapter -> Transport.read` 进入）

## Phase 4：测试体系补齐（优先级 P0）
> 状态：已完成（2026-03-02）

### 动作
- 增加应用层集成测试（mock transport）：
  - 连接成功/失败
  - 读写流程
  - 取消流程
  - 超时与错误恢复
- 保留现有工具类单测，补主链路回归测试

### 产出
- “主流程 + 规则 + 工具”三层测试覆盖

### 验收
- 重构后关键路径具备稳定回归保障

### 实现落点
- `web-client/tests/burner-application.test.ts`
  - 补充连接失败语义、ROM/RAM 读写契约、取消后状态收敛、错误恢复后可继续执行
- `web-client/tests/protocol-transport.test.ts`
  - 补充 `ConnectionTransport` send timeout 与 setSignals 错误传播断言
- `web-client/tests/device-gateway.test.ts`
  - 新增 Web/Electron `DeviceGateway` 生命周期成功/失败路径及运行时行为一致性断言
- `web-client/docs/phase-4-test-system-completion.md`
  - 固化覆盖矩阵、分层策略与阶段门禁命令

## 任务拆解建议（可直接建 issue）
1. 新增分层依赖 lint 规则并修复现有违规导入。
2. 创建 `BurnerUseCase`，先迁移 `readCart/eraseChip`。
3. 迁移 `writeRom/readRom/verifyRom` 到 use case。
4. 迁移 `writeRam/readRam/verifyRam` 到 use case。
5. 抽 `DeviceGateway` 并替换组件对连接管理的直接依赖。
6. 清理 `detectMbcType` 与读包逻辑重复实现。
7. 增加 burner 应用层集成测试。

## 风险与应对
- 风险：一次迁移过大导致行为回归。
  - 应对：按用例分批迁移，每批都有测试护栏。
- 风险：Electron/Web 双端行为差异暴露。
  - 应对：`DeviceGateway` 下做双实现一致性测试。
- 风险：进度/日志语义变化影响 UI。
  - 应对：先冻结 `ProgressInfo` 协议，再迁移实现。

## 里程碑定义
- M1：边界约束生效，新增代码不再穿透。
- M2：`CartBurner` 主流程迁入 application。
- M3：传输网关统一，协议层解耦具体串口实现。
- M4：去重完成，关键集成测试通过。

## 预期收益
- 维护复杂度下降（大文件拆分、职责清晰）
- 变更影响面缩小（协议/平台替换成本降低）
- 回归风险可控（主流程测试可覆盖）
