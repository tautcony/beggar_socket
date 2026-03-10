## Context

当前固件已经具备固定布局 `FAT16` 虚拟盘骨架，以及少量控制文件写入能力：

- 根目录稳定暴露 `INFO.TXT`、`STATUS.TXT`、`ROM/`、`RAM/`
- `/ROM/MODE.TXT` 已经是一个“整文件覆写 -> 解析文本 -> 更新内存态”的窄写入口
- `virtual_disk.c` 通过固定 cluster 到 `Fat16ViewId` 的映射，把目录项、小文本文件和大文件窗口路由到不同 handler
- `cart_service.c` 已承接 ROM 窗口相关状态与文本构建逻辑，但当前仍只有 `MODE.TXT` 这一条参数写路径

本 change 要在这套骨架之上，把参数文件从“零散候选项展示”升级为真正可操作的控制平面。核心难点不是 FAT16 本身，而是如何在主机会频繁重读、覆盖、缓存文本文件的前提下，定义一套稳定的参数语义，并把“当前生效配置”和“待提交配置”明确分离，避免主机保存一个文本文件时就直接触发危险写卡动作。

约束如下：

- 设备仍运行在 `STM32F103` 资源限制下，不能引入通用可写 FAT 或复杂事务系统
- 主机对 MSC 文件的写入通常表现为整扇区覆盖、重复写、先删后写或额外 metadata 访问，控制面必须容忍这些行为
- 后续 `/RAM/UPLOAD.SAV`、`/ROM/UPLOAD.GBA`、提交动作和状态机都要复用本阶段定义的参数模型
- 当前代码中部分候选项文件已经存在，例如 `/RAM/TYPE/*.TXT`；本 change 需要把它们纳入统一规则，而不是继续局部硬编码

利益相关方：

- 固件开发者，需要一个可扩展的参数与状态模型，避免后续 RAM/ROM 写流程重复改 FAT 视图层
- 上位机和终端用户，需要通过标准文件编辑/保存动作完成参数选择，而不依赖专用工具协议
- 后续 change，需要复用 `pending_config` 作为“提交前缓冲态”，把参数调整和实际编程解耦

## Goals / Non-Goals

**Goals:**
- 定义统一的参数控制平面目录与文本文件契约
- 引入 `current_config` / `pending_config` 双态模型，明确“当前生效”与“待提交”
- 让候选项文件、`SELECT.TXT`、`CONFIG.TXT`、`STATUS.TXT` 都围绕同一套参数 schema 工作
- 复用现有 `virtual_disk` 固定视图路由，不引入动态 FAT 分配
- 为后续 RAM 上传、ROM 烧录、提交/回滚状态机提供可复用的配置输入边界

**Non-Goals:**
- 不在本阶段实现真正的写卡提交动作
- 不实现参数默认值持久化到 MCU Flash
- 不支持主机创建新参数文件、重命名文件或动态扩展目录
- 不把每个参数变更立即同步到底层硬件；本阶段只更新会话态

## Decisions

### 1. 采用统一的 session config 对象，而不是让每个文件各自维护状态

**Decision:** 在 `cart_service` 或相邻服务层集中维护一个结构化 `session_config`，至少包含：

- `current_config`: 当前已生效、驱动只读导出窗口和状态展示的配置
- `pending_config`: 主机通过参数文件修改后、尚未提交的候选配置
- `dirty_mask` 或等价字段：标记哪些参数与 `current_config` 不同
- `last_error` / `validation_error`：记录最近一次配置解析或校验失败原因

**Rationale:**
- 所有控制文件最终都在修改同一组逻辑参数，集中状态可避免 `MODE.TXT`、`SELECT.TXT`、`CONFIG.TXT` 互相覆盖
- 后续提交动作只需要把 `pending_config` 复制并固化到运行流程，而不是重新解析多个文件
- `STATUS.TXT` 和候选项文件都需要同时看到 current/pending 差异，集中模型更容易生成一致文本

**Alternatives considered:**
- 每个参数文件单独维护静态变量：简单但很快会出现冲突和状态不同步
- 直接让文件写入立即改 `current_config`：会让保存文本文件等同于执行硬件变更，风险过高

### 2. 参数写入统一落到 pending_config，提交前不改变 current_config

**Decision:** 除只读文件外，所有参数入口都只更新 `pending_config`；`current_config` 仅由后续显式提交流程推进。

**Rationale:**
- 用户编辑参数和执行烧录/写 RAM 是两个不同阶段，必须可观察地分离
- 主机可能重复写入同一文件，若直接改 current，会让当前导出窗口和设备状态在编辑过程中频繁抖动
- 该模型天然适配未来的 `/RAM/COMMIT.TXT` 或类似触发器

**Alternatives considered:**
- `MODE.TXT` 保持立即生效，其他参数延后：行为不一致，用户难以理解
- 每个参数都要求独立提交：文件数量和交互复杂度过高

### 3. 候选项文件保持只读展示，新增组级 SELECT.TXT 作为标准选择入口

**Decision:** 每个参数组目录继续暴露候选项文件，例如 `/RAM/TYPE/SRAM.TXT`、`/RAM/TYPE/FRAM.TXT`、`/RAM/TYPE/FLASH.TXT`，但这些文件只读；实际选择通过同目录下单一 `SELECT.TXT` 完成，例如 `/RAM/TYPE/SELECT.TXT`。

**Rationale:**
- 候选项文件适合表达枚举值的语义、说明和当前/待选状态，主机浏览体验直观
- 统一 `SELECT.TXT` 可以把写路径标准化为 `VALUE=<candidate>` 或等价键值格式，避免每个候选项文件都要支持覆写解析
- FAT 视图层只需为“目录列表 + 候选项只读文件 + 一个组级写文件”建立固定模式，扩展成本低

**Alternatives considered:**
- 通过覆盖候选项文件自身来表示选中：主机行为不可控，且会让只读展示与写入口混在一起
- 为每个候选项提供独立可写触发文件：目录过于嘈杂，也不利于统一验证

### 4. 复合参数通过 CONFIG.TXT 批量编辑，但仍复用同一解析器

**Decision:** 对需要同时设置多个字段的配置，提供 `CONFIG.TXT` 文本入口；其格式与 `MODE.TXT` 一样采用宽松的 `KEY=VALUE` 行文本，并与 `SELECT.TXT` 最终落到同一个“参数 patch 应用器”。

**Rationale:**
- 复合配置不适合拆成大量单值文件，文本批量编辑更高效
- 复用同一解析、校验、归一化逻辑，可以保证无论从 `SELECT.TXT` 还是 `CONFIG.TXT` 写入，最终状态一致
- 现有 `cart_service_apply_mode_text()` 已经验证了这种“整文件解析”的实现模式可行

**Alternatives considered:**
- 为每个字段单独做一个可写 TXT：目录数量爆炸，主机体验差
- 引入 JSON/YAML：解析成本高，且对嵌入式实现和 Windows 文本编辑体验都不友好

### 5. 参数定义采用 schema 驱动，而不是继续扩散 switch/case

**Decision:** 引入静态参数描述表，定义每个参数组的路径、字段名、候选值、默认值、显示名称、是否只允许枚举、是否参与 `CONFIG.TXT` 等元数据。`virtual_disk` 仍保留固定 `Fat16ViewId` 路由，但文本生成和解析尽量通过描述表完成。

**Rationale:**
- 当前 `virtual_disk.c` 已经出现 RAM 类型候选项硬编码；继续沿用会让后续 ROM/RAM 参数文件数量增长时难维护
- 描述表可以同时驱动目录项展示、候选项文本、`SELECT.TXT` 校验和 `STATUS.TXT` 输出
- 对嵌入式而言，编译期静态表仍然足够轻量，不需要动态注册机制

**Alternatives considered:**
- 保持完全手写 switch/case：短期快，但每加一个参数组都要改多个位置，极易出错
- 做真正的运行时目录生成：超出当前固定 FAT 设计边界，没有必要

### 6. STATUS.TXT 明确展示 current/pending 差异和可提交性

**Decision:** `STATUS.TXT` 从当前的简单设备状态扩展为控制平面的汇总视图，至少展示：

- 当前生效配置摘要
- 待提交配置摘要
- 是否存在未提交变更
- 最近一次参数解析/校验错误
- 哪些后续动作当前可执行

**Rationale:**
- 主机用户需要一个中心位置确认“刚刚保存的文件到底是否被接受”
- 若 `SELECT.TXT` 或 `CONFIG.TXT` 解析失败，只靠写操作返回值很难在桌面系统中直观看见
- 后续提交型 change 可以直接复用该状态文件暴露任务阶段

**Alternatives considered:**
- 只在候选项文件中显示 selected 状态：无法覆盖批量配置和错误信息
- 单独再加错误文件：文件面太碎，用户需要来回查看

## Risks / Trade-offs

- **[主机写文件行为不稳定]** -> 桌面系统可能多次覆写、写入 BOM、补零或追加换行；解析器必须忽略未知键、容忍 BOM/CRLF，并坚持“完整校验后再更新 pending_config”。
- **[参数表与 FAT 目录映射分裂]** -> 如果目录项仍靠硬编码而语义靠 schema 表维护，后续容易不一致；需要让目录项生成尽量复用同一份参数元数据。
- **[状态文本超出单扇区]** -> 参数和错误信息增多后，`STATUS.TXT` 可能不再适合 512B/单 cluster；设计上应允许状态文件升级为多 sector 文本视图，而不是默认单扇区假设。
- **[current/pending 语义被绕开]** -> 若保留旧的 `MODE.TXT` 立即生效逻辑，会与新模型冲突；实现时需要把现有 ROM mode 写路径迁移到 pending-only 语义。
- **[资源占用增长]** -> 参数描述表、状态文本拼装和校验逻辑会增加 Flash/RAM 占用；需要坚持静态表、共享文本生成器和定长 session 结构。

## Migration Plan

1. 抽取通用的 session config 结构和“参数 patch 应用”接口，把现有 `MODE.TXT` 写路径改为更新 `pending_config`。
2. 梳理本阶段需要暴露的参数组，定义静态参数 schema 表和对应的固定目录/文件视图编号。
3. 在 `virtual_disk` 中补齐各参数目录、候选项文件、`SELECT.TXT`、`CONFIG.TXT` 的目录项和 handler 路由。
4. 实现统一文本生成器：
   - 候选项详情文本
   - `SELECT.TXT` 当前建议写法
   - `CONFIG.TXT` 模板与当前 pending 值
   - `STATUS.TXT` current/pending 汇总
5. 实现统一解析与校验器，把 `SELECT.TXT` / `CONFIG.TXT` / 既有 `MODE.TXT` 都映射到同一 patch 应用流程。
6. 验证主机常见写文件动作：
   - 覆盖保存
   - 重复保存
   - 带 UTF-8 BOM / CRLF
   - 无效值回写后的错误可见性
7. 为后续 `RAM/UPLOAD.SAV`、`ROM/UPLOAD.GBA` 和提交动作预留读取 `pending_config` / `current_config` 的服务接口。

## Open Questions

- `MODE.TXT` 是否保留原路径并转义为 `CONFIG.TXT` 的兼容别名，还是在本阶段统一收敛到新的参数文件体系？
   - 统一收敛到新的参数文件体
- `STATUS.TXT` 是否要继续放在根目录单文件汇总，还是在 `ROM/`、`RAM/` 下再提供局部状态文件？
   - 继续放在根目录单文件汇总
- 参数错误信息是只保留最近一条，还是需要为主机暴露更详细的字段级错误列表？
   - 只保留最近一条
- 某些参数组是否需要 `AUTO` 作为显式候选值，还是直接收敛到更稳定的分类语义？
   - `RAM/TYPE` 直接收敛到 `SRAM` / `FRAM` / `FLASH`
