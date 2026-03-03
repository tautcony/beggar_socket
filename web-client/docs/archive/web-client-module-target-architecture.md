# Web Client 模块目标设计

## 目标
- 模块边界清晰
- 依赖方向单向
- 编排逻辑集中在应用层
- 重复实现收敛
- 降低变更影响面

## 目标分层

```text
Presentation (Vue views/components)
  -> Application (UseCases / Facades)
      -> Domain (Model / Rule / Policy)
      -> Infrastructure (Serial / Electron / Protocol Adapter)
```

## 分层职责定义

### Presentation
- 负责：展示、交互、状态绑定、用户反馈
- 禁止：直接依赖 `protocol/*`、直接拼装底层命令、直接管理串口会话

### Application
- 负责：流程编排与用例
- 典型用例：
  - `connectDevice`
  - `readCartInfo`
  - `eraseChipOrSectors`
  - `writeRom/readRom/verifyRom`
  - `writeRam/readRam/verifyRam`
  - `scanMultiCart`
- 依赖：Domain + Infrastructure 接口

### Domain
- 负责：业务规则和模型（MBC、ROM/CFI、地址映射、进度语义）
- 特点：纯 TS，无框架/运行时绑定，便于测试

### Infrastructure
- 负责：平台实现细节
  - Serial(Web/Electron)
  - beggar_socket 协议编码/收发
  - 本地存储、文件导入导出
- 通过接口对上提供能力

## 目标目录建议

```text
src/
  features/
    burner/
      presentation/
      application/
      domain/
    multimenu/
      presentation/
      application/
      domain/
  platform/
    serial/
      web/
      electron/
      types/
    protocol/
      beggar-socket/
  shared/
    types/
    utils/
```

## 依赖约束（核心）
- `presentation -> application`（允许）
- `application -> domain/infrastructure`（允许）
- `domain -> *`（仅可依赖 `shared`）
- `shared/types/utils` 不得依赖 `services/protocol/views/components`
- `presentation` 不得直接依赖 `protocol/*`

## 关键收敛点
- `CartBurner` 退化为页面容器 + 事件分发器。
- 协议命令仅在 `platform/protocol`。
- `DeviceInfo`、`SerialPortInfo` 下沉为 `platform/serial/types` 或 `shared/types`，避免倒挂。
- `detectMbcType`、读取函数等重复逻辑统一单一实现。

## 验收标准
- 组件中不再出现 `@/protocol/*` 直接依赖。
- 主流程由 application use case 驱动，组件仅消费结果。
- `types/utils` 不再反向依赖 `services`。
- 关键流程有集成测试覆盖（连接、读写、错误/取消）。
