## Why

在真正处理大 ROM 烧录之前，先用更小、更可控的存档文件路径验证“上传文件 + 提交执行 + 状态回读”的完整链路，可以显著降低实现风险。`RAM/UPLOAD.SAV` 是最适合验证参数控制、任务状态机和错误处理的第一条写路径。

## What Changes

- 新增 `/RAM/UPLOAD.SAV` 作为存档上传窗口。
- 新增 `/RAM/COMMIT.TXT` 作为显式提交入口。
- 新增 `/RAM/ERASE.TXT` 作为需要擦除时的控制入口。
- 引入面向 RAM/Save 操作的 job manager 状态机。
- 根据 RAM 参数选择不同底层写入策略，例如 SRAM、FRAM、Flash Save。
- 通过 `/RAM/STATUS.TXT` 暴露上传、提交、编程、校验和失败状态。

## Capabilities

### New Capabilities
- `ram-upload-and-commit-workflow`: 定义 `/RAM/UPLOAD.SAV`、`/RAM/COMMIT.TXT`、`/RAM/ERASE.TXT` 的工作流契约。
- `ram-save-job-lifecycle`: 定义 RAM/Save 任务状态机、进度和错误语义。

### Modified Capabilities
- `parameter-file-control-plane`: 参数控制平面需要支撑 RAM 类型、校验开关等执行期消费。
- `fat16-read-only-virtual-disk`: 虚拟 FAT16 需要从只读扩展到 RAM 相关的数据窗口与控制文件写入。

## Impact

- 需要把现有 `uart.c` 中的 RAM/FRAM/Flash Save 操作抽取为可重用服务接口。
- 虚拟磁盘层需要支持上传窗口写入与提交任务触发。
- 状态文件需要包含任务进度、成功/失败原因和参数回显。
