## Context

当前实现已经具备参数控制平面的第一层能力：

- `CONFIG.TXT` 和 `SELECT.TXT` 可以修改 `pending_config`
- `STATUS.TXT` 能显示 `current_config` 与 `pending_config`
- `/RAM/TYPE/*.TXT` 能展示 `SRAM` / `FRAM` / `FLASH` 三类候选项

但核心缺口仍然存在：

- 没有任何“应用”步骤把 `pending_config` 推进到 `current_config`
- `/ROM/CURRENT.GBA` 仍只读取 `current_config`，所以配置修改不会实际生效
- `/RAM/CURRENT.SAV` 的读取路径没有依据 `ram_type` 分支，三类 RAM 目前只是展示上的分类

这意味着当前系统仍然停留在“可编辑、可观察，但不能真正生效”的阶段。下一步必须把 apply 生命周期补齐，并建立 RAM 类型感知的读取边界，否则后续 `UPLOAD.SAV`、`COMMIT.TXT`、ROM 编程窗口都缺少可靠基础。

## Goals / Non-Goals

**Goals:**
- 提供一个明确的 apply 路径，把 `pending_config` 收敛到 `current_config`
- 让 ROM 导出窗口配置在 apply 后真实影响 `/ROM/CURRENT.GBA`
- 让 `SRAM`、`FRAM`、`FLASH` 三类选择在 apply 后真实影响 `/RAM/CURRENT.SAV`
- 保持当前 FAT16 固定目录和文本控制面的交互风格

**Non-Goals:**
- 不在本阶段实现完整 `UPLOAD.SAV` / `UPLOAD.GBA` 写入流程
- 不在本阶段实现复杂任务状态机或异步编程进度
- 不在本阶段解决 Flash save 的全部容量/银行切换细节，只先建立类型分支边界

## Decisions

### 1. 引入显式 apply 入口，而不是让 pending 自动覆盖 current

**Decision:** 增加一个明确的 apply 动作，把已经通过校验的 `pending_config` 复制到 `current_config`。

**Rationale:**
- 保持“编辑”和“生效”分离，避免主机保存文本时自动触发硬件语义变化
- 和已有 `current/pending` 模型一致，不引入新的隐式状态迁移
- 后续可平滑扩展到 `COMMIT.TXT` 或更完整的任务流

### 2. apply 应该是同步、小范围、幂等的状态收敛

**Decision:** 当前阶段的 apply 只做内存态收敛，不涉及长耗时任务。若 `pending_config == current_config`，再次 apply 仍视为成功。

**Rationale:**
- 当前变更只需让配置真正作用到导出/读取路径
- 幂等行为更适合主机可能重复写入控制文件的现实

### 3. RAM 读取路径先做类型分支，再逐步细化类型内部协议

**Decision:** `cart_service_read_save(...)` 先按 `SRAM`、`FRAM`、`FLASH` 三类分支到不同 helper；即使某些分支短期内部仍共享底层读函数，也要先建立明确的代码边界。

**Rationale:**
- 先把“分类已生效”变成事实，后续才容易在 `FLASH` 分支内加入容量/命令集细节
- 避免继续让三类类型只停留在文本展示层

### 4. STATUS.TXT 需要增加 apply 可见性

**Decision:** `STATUS.TXT` 除 current/pending/dirty 外，还要能表明最近一次 apply 是否成功，以及 apply 后 dirty 是否清零。

**Rationale:**
- 否则用户无法确认“改了”和“已生效”的区别是否已经跨越
- 这也是后续提交类 change 的最小观测面

## Risks / Trade-offs

- **[apply 入口过早固定]** -> 若后续决定改成 `COMMIT.TXT` 或多阶段任务，当前入口需要兼容迁移；通过把 apply 封装在 service 层降低切换成本。
- **[RAM 类型分支过浅]** -> 如果只是把分支写出来但内部还都走同一底层读，会造成“语义对、实现浅”；通过先建立 helper 边界，再在后续 change 深化。
- **[状态语义更复杂]** -> 加入 apply 成功/失败后，状态文本更长；需要控制字段数量，避免超过当前单扇区预算。

## Migration Plan

1. 增加 service 级 apply 配置函数，把 `pending_config` 收敛到 `current_config`。
2. 把现有控制文件写路径接到 apply 生命周期，至少让当前阶段存在一个明确的 apply 触发点。
3. 调整 `STATUS.TXT`，补充 apply 后的状态可见性。
4. 改造 `cart_service_read_save(...)`，按 `SRAM` / `FRAM` / `FLASH` 分流到不同读取 helper。
5. 验证：
   - 修改配置但不 apply 时，导出/读取行为保持 current
   - apply 后，ROM 导出窗口与 RAM 读取分支切换到新 current
   - 不同 RAM 类型在代码路径上已分支

## Open Questions

- apply 入口本阶段是否直接复用现有某个控制文件，还是新增专门文件？
- `FLASH` 类型在本阶段需要做到什么程度才算“支持读取”，是仅建立分支边界，还是要同时处理容量细分？
