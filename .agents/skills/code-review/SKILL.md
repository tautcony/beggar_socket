---
name: code-review
description: 审查代码库、模块或变更集中的缺陷风险，并产出可落地的审查报告与修复计划。用于用户要求 review、代码扫描、风险排查、上线前审计、专项审查（安全、并发、协议、状态管理、性能稳定性）或需要系统化检查多个目录/模块时。
---

# Code Review

执行面向缺陷发现的代码审查。优先找出行为回归、可靠性风险、安全问题、遗漏测试和错误假设；不要把重心放在风格建议上。

## 先做范围判断

从用户请求和代码库推断以下信息；信息不全时，先基于仓库结构做合理假设，再开始审查：

- 审查对象：整个仓库、指定目录、提交差异、单个模块，或专项主题
- 审查重点：安全性、并发、协议正确性、状态机、资源释放、类型安全、前端响应式、测试覆盖
- 输出位置：默认写入 `docs/review-YYYY-MM-DD/`
- 现有背景：`README*`、`docs/`、`ARCHITECTURE*`、历史 review 目录、已知问题文档

如果用户只要“review 结果”而没有要求落盘，也仍然先形成结构化发现，再决定是否写文件。

## 执行流程

### 1. 建立 baseline

- 识别技术栈和模块边界。
- 读取关键背景文档和入口配置。
- 查找历史 review 结果或 known issues，避免重复报告已经接受的风险。
- 记录哪些目录高风险，哪些目录只需轻量覆盖。

### 2. 划分审查 phase

按职责而不是仅按目录拆分 phase。优先建立一套前后端都适用的通用分层，再把目录映射进去：

- 接入/边界层：处理外部输入和输出的入口，如 controller、route、gateway、RPC、消息监听、前端 page、view、API client、BFF
- 应用编排层：组织用例、流程和事务边界，如 service、application、usecase、facade、store action、async thunk
- 领域与状态层：承载核心状态、领域规则和状态转换，如 domain、model、aggregate、store、context、composable、hook
- 基础设施与集成层：处理数据库、缓存、消息、HTTP、文件、第三方 SDK、驱动、持久化和远程调用
- 平台与运行时层：处理框架生命周期、配置装配、启动流程、线程/连接池、Spring Boot 自动配置、Spring Cloud 组件、前端构建运行时、Electron 主进程
- 横切保障层：安全、鉴权、校验、日志、监控、异常处理、限流、熔断、配置、公共库
- 测试与验证层：单测、集成测试、契约测试、E2E、测试基建和 mock
- 最终交叉 phase：综合前面所有发现，识别跨模块系统性问题

针对常见技术栈，按下面方式做目录到职责的映射，而不是机械按目录名建 phase：

- Vue / React 前端：`views/` `pages/` `components/` 多数属于接入层；`stores/` `context/` `hooks/` `composables/` 多数属于领域与状态层；`services/` `api/` `clients/` 多数属于基础设施与集成层
- Spring Boot / Spring Cloud 后端：`controller/` `api/` `feign/` `consumer/` 多数属于接入层；`service/` `application/` 多数属于应用编排层；`domain/` `model/` 多数属于领域层；`repository/` `mapper/` `client/` `mq/` 多数属于基础设施层；`config/` `starter/` `bootstrap/` `gateway/` `filter/` 多数属于平台或横切层

如果同一目录同时承担多种职责，按调用链和实际责任拆开审查，不要被文件夹名称绑住。小项目合并 phase，大项目按高风险调用链进一步细分。不要为了形式制造空 phase。更具体的通用分层提示见 [references/review-playbook.md](./references/review-playbook.md)。

### 3. 为每个 phase 建立检查清单

每个 phase 都检查：

- 输入边界和错误传播是否完整
- 资源是否在所有退出路径释放
- 异步流程是否存在竞态、悬空 promise、超时后残留副作用
- 类型收窄和断言是否安全
- 测试是否覆盖关键失败路径

再叠加该层专项检查。专项检查项见 [references/review-playbook.md](./references/review-playbook.md)。

### 4. 执行审查

- 先读最可能承载风险的入口文件、核心抽象和调用链，再补上下游细节。
- 对每个发现保留最小充分证据：文件、函数、触发条件、影响、修复方向。
- 明确区分：
  - 已确认缺陷
  - 高风险假设或残留疑点
  - 测试/观测缺口
- 如果支持且允许使用 subagent，把彼此独立的 phase 并行处理；不要把结论先验透露给 subagent。
- 如果没有 subagent，也按同样 phase 顺序串行完成。

### 5. 立即写出 phase 结果

每个 phase 完成后立即写出单独报告，不要等全部结束。默认命名：

- `phase-0-baseline.md`
- `phase-N-<layer>.md`
- `phase-N-crosscutting.md`

报告结构和严重度标准见 [references/review-playbook.md](./references/review-playbook.md)。

### 6. 汇总并给出修复计划

所有 phase 完成后，生成：

- `summary.md`：聚合所有发现、统计、优先级和跨模块问题
- `fixes-plan.md`：按修复批次组织，给出建议顺序、影响、复杂度、验证方式

修复计划必须偏执行，而不是重复问题描述。

## 输出原则

- 先报最严重问题，再报中低优先级问题。
- 以行为风险、回归风险和缺失验证为主，不要堆积低价值风格意见。
- 问题描述必须包含：位置、触发条件、影响、修复方向。
- 明确写出未覆盖区域或证据不足区域。
- 如果某个 phase 未发现问题，也要写明已覆盖的文件和检查重点。

## 默认目录与文件

优先使用按日期隔离的目录：

```text
docs/review-YYYY-MM-DD/
  phase-0-baseline.md
  phase-1-*.md
  ...
  summary.md
  fixes-plan.md
```

若用户指定其他输出位置，遵循用户要求，但保留 phase 拆分和汇总结构。

## 何时读取参考资料

只有在需要细化模板或专项检查时再读取：

- [references/review-playbook.md](./references/review-playbook.md)：严重度标准、专项 checklist、phase 模板、summary/fixes 模板

不要把参考文件整段复述到输出里；按需抽取。
