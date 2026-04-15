# Review Playbook

按需读取本文件，用于补充具体模板和专项检查项。

## 严重度标准

- `P0`: 可导致安全漏洞、数据损坏、核心流程失效、明显错误结果
- `P1`: 高概率可靠性问题、重要边界场景失败、资源/状态长期异常
- `P2`: 可维护性或局部正确性问题，影响有限但值得修复
- `INFO`: 建议性改进或需要继续验证的观察项

默认按 `P0 -> P1 -> P2 -> INFO` 输出。

## 通用 Checklist

- 异步安全：竞态、取消、超时、重复提交、悬空 promise、未处理 rejection
- 资源生命周期：锁、句柄、stream、reader、writer、监听器、定时器是否释放
- 错误传播：catch 是否吞错、错误是否带上下文、失败后状态是否可恢复
- 输入边界：外部输入、长度、索引、枚举值、空值、非法状态
- 类型安全：`any`、双重断言、错误的 narrowing、可选链掩盖异常
- 测试覆盖：失败路径、边界条件、回归测试、mock 是否伪造了真实风险

## 通用 Phase 分层

在前端 Vue/React 和后端 Spring Boot/Spring Cloud 中，优先使用职责分层，而不是直接照抄目录：

- 接入/边界层：外部请求入口、参数绑定、序列化反序列化、鉴权前后边界、页面装载入口、路由跳转入口
- 应用编排层：用例协调、事务边界、状态推进、跨服务编排、批处理流程
- 领域与状态层：核心业务规则、状态机、领域对象、前端状态容器、派生状态、缓存一致性
- 基础设施与集成层：数据库、缓存、消息队列、HTTP/RPC/Feign、第三方 SDK、文件系统、驱动和适配器
- 平台与运行时层：框架启动、配置注入、线程池、连接池、网关、过滤器、自动配置、构建和宿主运行时
- 横切保障层：校验、鉴权、日志、异常翻译、监控、限流、重试、熔断、配置中心、工具库
- 测试与验证层：单元、集成、契约、端到端、测试夹具、mock 和测试容器
- 交叉 phase：在所有层完成后识别系统性风险，如错误码不一致、超时策略不一致、状态恢复不一致

常见映射示例：

- Vue / React：`pages` `views` `components` -> 接入层；`stores` `hooks` `composables` `context` -> 领域与状态层；`api` `services` `clients` -> 基础设施层
- Spring Boot / Spring Cloud：`controller` `api` `gateway` `listener` -> 接入层；`service` `application` `usecase` -> 应用编排层；`domain` `model` -> 领域层；`repository` `mapper` `client` `feign` `mq` -> 基础设施层；`config` `filter` `interceptor` `bootstrap` -> 平台或横切层

## 技术栈专项检查

### 前端 UI

- 响应式值是否丢失订阅
- effect/composable/hook 是否泄漏副作用
- 条件渲染、列表 key、异步状态切换是否产生旧数据闪回
- 用户输入、富文本、HTML 注入点是否安全

### Electron / 桌面桥接

- IPC 参数是否校验
- `contextIsolation`、权限边界、危险 API 暴露是否合理
- 主进程错误是否能反馈到渲染层

### Node / 服务端

- 文件路径、URL、SQL/命令拼接、SSRF、鉴权绕过
- 重试、超时、幂等和资源回收
- 外部依赖失败时是否造成半完成状态

### 协议 / 硬件 / 二进制数据

- 字节序、长度、checksum、ACK/NACK、重试逻辑
- 超时后状态是否正确复位
- 写入/读取窗口是否与协议状态机一致

### TypeScript

- 领域模型是否被宽泛类型稀释
- 运行时校验是否缺失
- 泛型或联合类型是否被错误逃逸成 `any`

## Phase 报告模板

```md
# Phase N 审查报告: <模块名>

> 日期: YYYY-MM-DD
> 文件数: X
> 发现: P0(a) / P1(b) / P2(c) / INFO(d)

## 已审查文件
- path/to/file

## Findings

### [P0] 标题
- 位置: `path/to/file` `functionName`
- 触发条件: ...
- 影响: ...
- 修复方向: ...

## 未覆盖区域
- 无 / path/to/skipped
```

## Summary 模板

```md
# 代码审查汇总

> 日期: YYYY-MM-DD
> 范围: <rootDir or scope>
> Phase 数: N

## 统计
- P0: a
- P1: b
- P2: c
- INFO: d

## 高优先级问题
- [P0] ...

## 各 Phase 摘要
- Phase 0: ...

## 跨模块问题
- ...

## 未覆盖区域
- ...
```

## Fixes Plan 模板

```md
# 修复计划

## 批次划分
- Batch A: 立即修复的 P0/P1
- Batch B: 本迭代修复
- Batch C: 技术债或需要更大改造

## 每批次包含
- 目标问题
- 涉及文件
- 建议顺序
- 验证方式
```
