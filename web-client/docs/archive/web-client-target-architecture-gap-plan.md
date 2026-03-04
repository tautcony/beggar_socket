# Web Client 目标架构差距收敛计划

## 背景
- 参照文档：`docs/archive/web-client-module-target-architecture.md`
- 目的：确认当前实现与目标架构的差距，并形成可执行收敛计划
- 当前判断：整体约 **70% 达成**（核心边界已建立，分层重构进行中）

## 当前状态结论

### 已达成
- UI 不再直接依赖 `protocol/*`（`check:deps` 通过）。
- `types/utils -> services` 的反向依赖已清理（`check:deps` 通过）。
- 关键主链路已有测试护栏（`burner-application`、`device-gateway`、`protocol-transport`）。

### 主要差距
1. 目录形态与目标分层未完整落地：
   - 缺少 `features/*/domain`、`shared/*` 的体系化落点。
   - `protocol` 尚未收敛到目标中的 `platform/protocol` 形态。
2. `CartBurner.vue` 仍偏重：
   - 仍承担较多流程编排与适配器选择逻辑，未完全退化为容器。
3. Application 仍绑定服务实现：
   - `application/types` 直接依赖 `CartridgeAdapter`，接口反转不彻底。
4. `connectDevice` 用例未进入 Application：
   - 连接流程主要仍在 `DeviceConnect.vue + DeviceConnectionManager`。

## 收敛目标
- 完成分层闭环：`Presentation -> Application -> Domain/Infrastructure Interface`。
- 将连接、读写、校验、多卡扫描等主流程统一由 Application 用例驱动。
- 明确 Domain 规则层，确保纯 TS、可测试、可复用。
- 降低组件复杂度和跨层变更影响面。

## 分阶段计划

### Phase A：补齐 Domain 与端口接口（P0）
- 动作：
  - 新建 `features/burner/domain`，迁入纯规则（MBC 识别、地址映射、进度语义、ROM/CFI 规则）。
  - 在 `application` 定义端口接口（例如 `CartridgePort`），替代对 `CartridgeAdapter` 具体类依赖。
- 验收：
  - `features/burner/application/*` 不再直接 `import '@/services/*'` 具体实现。
  - Domain 层不依赖 `vue/services/protocol/platform runtime`。

### Phase B：连接用例应用层化（P0）
- 动作：
  - 新增 `connectDevice`、`disconnectDevice`、`initializeDevice` 用例到 Application。
  - `DeviceConnect.vue` 调整为“调用用例 + 展示状态 + 用户选择端口”。
- 验收：
  - `DeviceConnect.vue` 中不直接编排网关细节。
  - 连接失败/端口选择/初始化重置由用例语义统一。

### Phase C：瘦身 CartBurner（P1）
- 动作：
  - 将 `CartBurner.vue` 内流程控制继续下沉到 `BurnerFacade/UseCase`。
  - 组件仅保留输入采集、事件分发、状态渲染。
- 验收：
  - `CartBurner.vue` 行数目标：`< 500`（建议阈值）。
  - 组件中不再直接进行适配器流程编排。

### Phase D：协议目录与职责归位（P1）
- 动作：
  - 逐步将 `src/protocol/beggar_socket` 收敛到目标形态（`platform/protocol` 或等价目录）。
  - 保持对上 API 稳定，先做别名/转发过渡，再逐步迁移引用。
- 验收：
  - 协议层定位清晰并与平台层契约一致。
  - 迁移期间 `check:deps` 与核心测试持续绿灯。

## 执行顺序建议
1. Phase A（先做接口反转和 Domain 落点，避免后续迁移继续耦合）。
2. Phase B（连接用例进入 Application，补齐用例边界）。
3. Phase C（瘦身 `CartBurner`，降低维护成本）。
4. Phase D（目录重构与命名归位，作为结构收尾）。

## 验收与门禁
- 每阶段必须通过：
  - `npm run check:deps`
  - `npm run test:run -- tests/burner-application.test.ts tests/device-gateway.test.ts tests/protocol-transport.test.ts`
- 终态验收：
  - 组件不直接依赖协议层。
  - 主流程由 Application 用例驱动。
  - `types/utils` 不反向依赖 `services`。
  - Domain 规则可独立测试。

## OpenSpec 四个 Change 执行顺序（建议）

1. `web-client-protocol-layer-rehoming`
2. `web-client-domain-port-abstraction`
3. `web-client-connection-usecase-orchestration`
4. `web-client-cartburner-containerization`
