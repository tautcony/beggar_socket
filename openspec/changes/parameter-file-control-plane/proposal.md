## Why

要让虚拟磁盘不只是“导出窗口”，还要成为真正可操作的控制面板，就必须先建立一套稳定的参数文件模型。参数目录、候选项文件、`SELECT.TXT`、`CONFIG.TXT` 和 `STATUS.TXT` 的语义需要先明确，才能安全支撑后续写卡任务。

## What Changes

- 新增参数目录控制平面，用于表达 ROM/RAM 模式、RAM 类型、大小、banking、校验等配置。
- 为每个参数组提供固定候选项文件与统一的 `SELECT.TXT` 写入口。
- 提供 `CONFIG.TXT` 作为复合参数的文本配置入口。
- 引入 `current_config` / `pending_config` 会话态模型，使参数变更先进入 SRAM 状态，再由提交动作统一生效。
- 通过 `STATUS.TXT` 和候选项文件的动态内容展示当前与待生效配置。
- 明确参数文件默认不要求持久化；只有未来显式保存默认值时才考虑写 MCU 内部 Flash。

## Capabilities

### New Capabilities
- `parameter-file-control-plane`: 定义参数目录、候选项文件、`SELECT.TXT` 和 `CONFIG.TXT` 的读写契约。
- `session-config-state-management`: 定义 `current_config` / `pending_config` 的状态模型及其与状态文件的关系。

### Modified Capabilities
- `fat16-read-only-virtual-disk`: 在只读 FAT16 骨架上扩展参数文件视图与少量可写控制文件行为。

## Impact

- 虚拟文件视图层将新增命令型写文件的解析能力。
- MCU 需要引入会话态配置结构与状态回读逻辑。
- 后续 `RAM/UPLOAD.SAV` 和 `ROM/UPLOAD.GBA` 的执行流程将依赖本阶段定义的参数和状态契约。
