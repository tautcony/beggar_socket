---
description: >
  通用代码审查元技能。根据用户指定的审查范围自动生成审查计划，
  利用 Explore subagent 并行审查各模块，输出分 Phase 的审查报告，
  汇总形成 summary.md，最后生成修复计划与建议。
  适用场景：新功能上线前审查、技术债全盘清查、专项问题（安全/并发/协议）审查。
---

# 通用代码审查元技能 (Code Review Meta-Skill)

## 概述

本技能将用户的代码审查请求转化为**完整、可追溯、产出落地的工程流程**。

```
用户指定范围
    ↓
[Step 1] 探索代码库结构，理解模块边界与技术栈
    ↓
[Step 2] 生成动态审查计划（Phase 列表 + Checklist）
    ↓
[Step 3] 并行执行各 Phase 审查（Explore subagent）
    ↓
[Step 4] 写入各 Phase 报告文件
    ↓
[Step 5] 生成汇总报告 summary.md
    ↓
[Step 6] 生成修复计划 fixes-plan.md
```

---

## Step 1：理解审查范围

### 1.1 从用户输入收集以下参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `rootDir` | 审查根目录（相对于工作区） | 工作区根目录 |
| `scope` | 限定子模块/目录（可选） | 全部模块 |
| `focusAreas` | 重点问题类别代号（可选，见类别表） | 全类别 C1–C11 |
| `outputDir` | 报告输出目录 | `docs/review-{YYYY-MM-DD}/` 或 `docs/review/` |
| `contextDocs` | 现有架构/已知问题文档路径（可选） | 自动探索 |

**缺省处理**：参数不足时，不询问用户，通过文件系统探索推断。

**outputDir 日期标记策略**：
- 推荐：`docs/review-{YYYY-MM-DD}/` （如 `docs/review-2026-03-16/`）
- 优点：自动按日期排序，便于保留历史审查记录，支持同日多次审查
- 备选：`docs/review/{YYYY-MM-DD}/`（嵌套目录结构）
- 如用户未指定日期，自动使用当前日期

### 1.2 探索代码库结构

1. `list_dir(rootDir)` — 识别顶级目录结构
2. 扫描 `docs/`, `README.md`, `ARCHITECTURE.md` 等 — 寻找架构文档
3. 读取 `package.json` / `tsconfig.json` / `pyproject.toml` 等 — 确认技术栈
4. 如存在已有 review 目录，读取历史 `summary.md` 作为 baseline，避免重复报告已知问题
5. 如存在已知问题文档（如 `docs/known-issues.md`、`docs/architecture-analysis.md` 等），读取作为参照基准

### 1.3 确定技术栈对应的专项检查重点

| 技术栈特征 | 额外关注点 |
|-----------|-----------|
| Vue 3 / React | 响应式丢失、composable 副作用泄漏、v-html XSS |
| Electron | CSP 配置、contextIsolation、IPC 输入验证 |
| WebSerial / 硬件协议 | 字节序、帧格式、锁生命周期、超时恢复 |
| Node.js / Express | SQL 注入、路径遍历、SSRF、依赖漏洞 |
| TypeScript | any 滥用、不安全类型断言、narrowing 缺失 |
| 异步重度项目 | Promise 竞态、未捕获 rejection、资源泄漏 |

---

## Step 2：生成审查计划

### 2.1 通用问题分类表（每次审查均适用）

| 类别 | 代号 | 典型缺陷举例 |
|------|------|-------------|
| 并发与资源管理 | C1 | lock 生命周期错误、stream 泄漏 |
| 超时与错误处理 | C2 | 超时破坏流状态、静默失败、错误不向上传播 |
| 协议/数据正确性 | C3 | 字节序、帧格式、ACK 校验、长度计算偏差 |
| 跨平台一致性 | C4 | 平台行为差异、对等实现缺失 |
| 状态机完整性 | C5 | 状态转换遗漏、异常时未重置、初始化顺序依赖 |
| 配置与常量 | C6 | 魔法数字、默认值不合理、buffer 过小 |
| 异步与 Promise | C7 | 竞态条件、未捕获 rejection、Promise 泄漏 |
| 类型安全 | C8 | `any` 滥用、不安全类型断言、narrowing 缺失 |
| 框架响应式 | C9 | 响应式丢失、composable 副作用泄漏、store 滥用 |
| 安全性 | C10 | IPC 注入、XSS、路径遍历、SSRF、CSP 缺失 |
| 内存与资源泄漏 | C11 | unmount 未移除监听器、AbortController 未用 |

### 2.2 动态 Phase 划分规则

根据 `rootDir` 目录结构，按以下优先级自动划分 Phase：

**固定 Phase**：
- **Phase 0**（首先执行）：读取架构文档、建立 baseline、不计入文件统计
- **最后 Phase**：交叉审查 — 基于前各 Phase 综合分析，无需读取新文件

**按目录/职责动态生成中间 Phase**（参考以下优先级排序）：

| 目录模式 | 建议 Phase 名称 | 审查重点 |
|---------|----------------|---------|
| `platform/`, `transport/`, `drivers/` | 传输层 | C1, C2, C4, C5 |
| `protocol/` | 协议层 | C3, C2, C7 |
| `features/`, `application/`, `usecases/` | 应用层 | C5, C2, C7, C8 |
| `services/`, `adapters/` | 服务层 | C2, C4, C5, C10 |
| `utils/`, `helpers/`, `lib/` | 工具层 | C3, C6, C8, C10 |
| `stores/`, `composables/`, `hooks/`, `context/` | 状态层 | C9, C5, C7, C11 |
| `views/`, `components/`, `pages/` | 展示层 | C9, C10, C11, C6 |
| `electron/`, `native/`, `main.js` | 运行时层 | C10, C4, C2 |
| `tests/`, `__tests__/` | 测试层 | 覆盖率、测试隔离、mock 正确性 |

**Phase 数量建议**：
- 小型项目（< 20 文件）：3–5 个 Phase
- 中型项目（20–100 文件）：5–10 个 Phase
- 大型项目（> 100 文件）：10+ Phase，考虑子 Phase 拆分

### 2.3 为每个 Phase 生成内容

使用 `file_search` 或 `list_dir` 为每个 Phase 建立：
- **文件清单**：`file_search("src/platform/**/*.ts")` 等模式扫描
- **专项 Checklist**：基于该层职责定制（参考 2.1 类别表的"重点"列）
- **通用 Checklist**：见 Step 3 的通用检查项
- **输出文件路径**：`{outputDir}/phase-{N}-{kebab-case-name}.md`

### 2.4 用 `manage_todo_list` 初始化所有 Phase 任务

在执行任何 Phase 之前，先创建完整的任务列表：

```
todos = [
  Phase 0: 准备工作
  Phase 1: [传输层/第一个发现的高风险层]
  Phase 2: [协议层]
  ...
  Phase N: 交叉审查
  summary: 生成 summary.md
  fixes-plan: 生成 fixes-plan.md
]
```

---

## Step 3：执行各 Phase 审查

### 3.1 并行化策略

**核心原则**：Phase 之间无数据依赖时，使用并行 subagent 执行。

```typescript
// 推荐：对独立 Phase 使用并行 Explore subagent
Promise.all([
  runSubagent("Explore", buildPhasePrompt(phase1)),
  runSubagent("Explore", buildPhasePrompt(phase2)),
  runSubagent("Explore", buildPhasePrompt(phase3)),
])
```

**串行场景**（必须按顺序）：
- Phase 0 必须首先完成（建立 baseline）
- 最后的交叉 Phase 必须在所有其他 Phase 完成后执行

**推荐并行批次**：
- 批次 1（只读探索）：传输层、协议层、服务层同时启动
- 批次 2（依赖批次1分析）：应用层、工具层同时启动
- 批次 3：状态层、展示层同时启动
- 批次 4：运行时层（如 electron）
- 最终：交叉审查

### 3.2 给 Explore subagent 构建 Prompt 的模板

每个 Phase 的 subagent prompt 必须包含以下内容：

```markdown
你是一个专业代码审查 agent，负责审查以下模块的代码质量和安全性。

## 审查目标文件
（列出所有文件路径，每行一个）

## 背景上下文
（从 Phase 0 baseline 获得的已知问题摘要）

## 专项 Checklist
（该 Phase 的定制检查列表，每项注明类别代号 C1-C11）

## 通用 Checklist（每个文件均需应用）
### 异步安全
- Promise.race() 非胜出分支是否有副作用？
- finally 块是否可能在操作 pending 时执行副作用？
- 是否存在未处理的 Promise rejection（fire-and-forget）？

### 资源生命周期
- 锁/reader/writer 在所有退出路径是否都被释放？
- EventListener 是否在组件卸载时被移除？

### 错误传播
- catch 块是否有意义地处理了错误（非空 catch / 非仅 console.log）？
- 一次错误是否可能使系统进入不可自愈状态？

### 边界与配置
- 是否使用了未经验证的外部输入？
- 数值边界是否有校验（地址范围、长度溢出）？

### 类型安全
- 是否有不安全类型强转（as any, as unknown as T）？
- 可选链 ?. 是否遮盖了应当抛出错误的情况？

## 严重度定义
- 🔴 P0：可导致功能失效/数据损坏/安全漏洞
- 🟡 P1：可靠性/性能显著影响；边角场景功能失效
- 🟢 P2：代码质量、可维护性；影响有限
- ℹ️ INFO：建议性改进，非必需

## 输出要求
请按以下格式返回审查结果（不要写入文件，只返回 markdown 内容）：

# Phase N 审查报告：[模块名]

> 审查时间：YYYY-MM-DD
> 审查文件数：X
> 发现问题数：P0(N) / P1(N) / P2(N) / INFO(N)

## 已审查文件
（列出实际读取的文件）

## 问题清单
（按 🔴 P0 → 🟡 P1 → 🟢 P2 → ℹ️ INFO 顺序）

### 🔴 P0 — [C代号] 问题标题
**文件**：`path/to/file.ts` — `函数名`
**现象**：（引用代码片段）
**问题**：（解释原因和触发条件）
**影响**：（定性/定量描述）
**修复建议**：（具体可操作方向）
---

## 未覆盖区域
（文件不存在或无法读取的列表，或写"无"）
```

### 3.3 接收 Subagent 结果后的处理

subagent 返回 markdown 内容后，主 agent 负责：
1. 解析问题列表，统计各级别数量
2. 立即将内容写入对应的 Phase 文件（`create_file` 或 `replace_string_in_file`）
3. 标记该 Phase todo 为 completed
4. 将发现的问题摘要追加到内部暂存列表，供 summary 使用

---

## Step 4：写入 Phase 报告文件

**规则**：
- 每个 Phase **完成后立即写入**，不等待其他 Phase
- 并行 Phase 可并行写入
- 目录不存在时用 `create_directory` 创建（如 `docs/review-{YYYY-MM-DD}/`）
- 文件已存在时使用 `replace_string_in_file` 覆盖
- 文件不存在时使用 `create_file` 创建

**命名规范**：
- `phase-0-baseline.md`
- `phase-1-{layer-name}.md`（如 `phase-1-transport.md`、`phase-1-platform-serial.md`）
- `phase-N-crosscutting.md`（最后一个 Phase）
- 完整路径示例：`docs/review-2026-03-16/phase-1-platform.md`

---

## Step 5：生成汇总报告 summary.md

所有 Phase 完成后，汇总生成 `{outputDir}/summary.md`。

### summary.md 完整结构

```markdown
# 代码审查汇总报告

> 审查完成时间：YYYY-MM-DD
> 审查根目录：{rootDir}
> 覆盖 Phase：0–N（共 M 个）
> 审查文件总数：X

---

## 统计

| 严重度 | 数量 |
|--------|------|
| 🔴 P0  | N    |
| 🟡 P1  | N    |
| 🟢 P2  | N    |
| ℹ️ INFO | N    |
| **合计** | **N** |

---

## 各 Phase 汇总

| Phase | 模块 | 文件数 | P0 | P1 | P2 | INFO | 报告 |
|-------|------|--------|----|----|----|----|------|
| 0 | 基线准备 | - | - | - | - | - | [phase-0](./phase-0-baseline.md) |
| ... | ... | ... | ... | ... | ... | ... | ... |

---

## 高优先级问题（P0）

| 状态 | 问题描述 | 文件 | 报告 |
|------|---------|------|------|
| 🔴 待修复 | ... | `path/file.ts` | [Phase N](./phase-N-name.md) |

---

## 分组修复建议

> 分组原则：同组内的问题强烈建议在同一次 commit 中修复，以避免半修复状态。

### Group A — [问题类别/模块]
**优先级**：P0/P1 × N  
**涉及文件**：`path/to/file.ts`

| 优先级 | 问题 |
|--------|------|
| P0 | 问题描述 |
| P1 | 问题描述 |

---

## 跨模块系统性问题

> 这些问题横跨多个模块，需要协调修复。

### 1. [系统性问题标题]
（描述该问题在哪些 Phase 中均有体现，整体影响是什么）

- Phase N：具体表现 → 状态（待修复/已知延期）
- Phase M：具体表现 → 状态

---

## 未发现问题的模块

（列出审查后确认无问题的 Phase，表明审查覆盖全面）
```

---

## Step 6：生成修复计划 fixes-plan.md

基于 summary.md，生成可执行的修复计划。

### fixes-plan.md 完整结构

```markdown
# 修复计划

> 基于：[summary.md](./summary.md)
> 生成时间：YYYY-MM-DD
> 待修复总数：N 项（P0: N, P1: N, P2: N）

---

## 快速决策矩阵

| 组别 | 严重度 | 预期影响 | 修复复杂度 | 建议时机 |
|------|--------|---------|-----------|---------|
| A    | P0 × N | 高      | 中        | 立即     |
| B    | P1 × N | 高      | 低        | 本迭代   |
| ...  | ...    | ...     | ...       | ...     |

影响评估：高（功能失效/安全漏洞）| 中（可靠性下降）| 低（代码质量）
复杂度评估：高（需大重构）| 中（需多文件改动）| 低（局部修改）

---

## 分组修复步骤

### ✅ Group A — [问题类别]（**建议首先修复**）

**严重度**：P0 + P1  
**涉及文件**：
- `path/to/file1.ts`
- `path/to/file2.ts`

**问题列表**：
| 严重度 | 问题 | 位置 |
|--------|------|------|
| P0 | 问题描述 | `func()` in `file1.ts` |

**修复步骤**：
1. 在 `file1.ts` 的 `funcName()` 中添加 XXX 检查
   ```typescript
   // 修复示意（非完整代码）
   if (condition) { throw new Error('描述'); }
   ```
2. 在 `file2.ts` 中修改 YYY 逻辑
3. 添加/更新测试覆盖

**验证方法**：
- [ ] 运行 `npm test` / `pytest` / 相应测试命令
- [ ] 手动验证：[描述具体触发场景]
- [ ] 构建验证：类型检查 + lint + build

---

### Group B — [问题类别]

（同上格式）

---

## 延期与技术债

> 这些问题暂时不修复，已记录为技术债。

| 问题 | 原因 | 预计处理时间 |
|------|------|------------|
| 示例：某接口降级 | 依赖的底层能力尚未就绪 | 依赖方更新后 |

---

## 修复完成标准

修复完成后，应满足以下全部条件：

- [ ] 所有 P0 问题已修复
- [ ] 所有 P1 问题已修复（或有充分的延期理由）
- [ ] 构建通过：`{buildCommand}` 无错误
- [ ] 测试全部通过：`{testCommand}`
- [ ] Lint 通过：`{lintCommand}`
- [ ] 已更新 summary.md 的修复状态
```

---

## 执行前置检查表

开始执行前，确认以下所有条件：

- [ ] 已用 `manage_todo_list` 初始化**全部** Phase 任务
- [ ] 已确定 `outputDir` 并确认目录存在（必要时用 `create_directory` 创建）
- [ ] 已读取所有背景文档（架构文档、已知问题文档）
- [ ] 已确认并行策略（哪些 Phase 可同时启动 subagent）

执行中，强制遵守：

- [ ] 确已创建日期标记的输出目录（如 `create_directory("docs/review-2026-03-16")`）
- [ ] 每个 Phase 完成后**立即**写入报告文件，**立即**标记 completed
- [ ] 不跳过任何 Phase（包括预期无问题的 Phase，写"未发现问题"也是有效产出）
- [ ] subagent prompt 包含：文件清单 + baseline 摘要 + 专项 checklist + 通用 checklist + 格式规范
- [ ] 交叉审查 Phase 在所有其他 Phase 完成后才能执行

---

## 附录：常见项目类型的 Phase 模板

### A. Vue 3 + TypeScript 前端项目

Phase 顺序建议：
0. Baseline → 1. platform/transport → 2. protocol → 3. features/application → 4. services → 5. utils → 6. stores/composables → 7. views/components → 8. electron（如有）→ 9. 交叉审查

### B. Node.js/Express REST API 项目

Phase 顺序建议：
0. Baseline → 1. middleware → 2. controllers → 3. services → 4. models/db → 5. utils → 6. 交叉审查（重点 C10: SQL 注入、C3: 数据格式、OWASP Top 10）

### C. Python 后端项目

Phase 顺序建议：
0. Baseline → 1. api（路由/视图）→ 2. business logic → 3. data access → 4. utils → 5. 交叉审查

### D. 小范围专项审查（如仅审查安全性）

仅初始化：0. Baseline + 专项 Phase（只启用 C10: 安全性检查项）+ 交叉审查
输出简化版 summary（只列示 C10 相关问题）

---

## 附录：审查报告目录结构示例

```
docs/
├── review-2026-03-16/          ← 首次完整审查
│   ├── phase-0-baseline.md
│   ├── phase-1-platform.md
│   ├── phase-2-protocol.md
│   ├── phase-3-application.md
│   ├── ...
│   ├── summary.md              ← 该次审查的汇总
│   └── fixes-plan.md           ← 该次审查的修复方案
│
├── review-2026-03-20/          ← 第二次审查（专项/跟进）
│   ├── phase-0-baseline.md
│   ├── phase-1-security.md     ← 可能仅覆盖部分 Phase（专项审查）
│   ├── summary.md
│   └── fixes-plan.md
│
├── review-2026-03-25/          ← 第三次审查（完整审查或回归验证）
│   └── ...
│
└── README.md                    ← （可选）审查历史说明文档
```

**日期目录好处**：
- 📅 **完整的审查历史追踪** — 对比不同审查周期的代码质量演进
- 📊 **避免覆盖** — 每次审查独立拥有独立目录，历史记录永久保存
- 🔄 **支持同日多次审查** — 同一天内若有多个不同 scope 或重点的审查，可分别存储（如 `review-2026-03-16-security/`, `review-2026-03-16-performance/`）
- ✅ **符合文件系统自然排序** — 目录按名称排序自动体现时间线
- 🔗 **便于链接引用** — 其他文档可稳定引用特定日期的审查报告
