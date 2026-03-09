## Why

最终目标是让用户能够通过可移动磁盘方式完成 ROM 烧录，但当前 MCU 没有足够空间缓存完整 ROM 文件。因此必须把 `/ROM/UPLOAD.GBA` 明确定义为流式编程窗口，并在前面只读磁盘、参数控制和 RAM 提交模型稳定后，单独处理这条最复杂的路径。

## What Changes

- 新增 `/ROM/UPLOAD.GBA` 作为按 offset 直写目标卡 ROM 的流式编程窗口。
- 新增 `/ROM/COMMIT.TXT`，用于结束写入、触发校验或执行收尾动作。
- 新增 `/ROM/ERASE.TXT`，用于显式触发整片或分段擦除。
- 引入 ROM 编程专用 job manager 流程，覆盖 `PREPARE / ERASE / PROGRAM / VERIFY / DONE / ERROR`。
- 定义主机文件偏移到目标卡 ROM 地址的映射规则。
- 明确 `UPLOAD.GBA` 不是本地持久文件，不要求设备端保存完整 ROM 镜像。

## Capabilities

### New Capabilities
- `rom-streaming-program-window`: 定义 `/ROM/UPLOAD.GBA` 作为流式编程窗口时的读写与地址映射契约。
- `rom-program-job-lifecycle`: 定义 ROM 擦除、编程、校验和错误恢复的任务状态机。

### Modified Capabilities
- `parameter-file-control-plane`: 参数控制平面需要支撑 ROM 模式与校验选项。
- `fat16-read-only-virtual-disk`: 虚拟 FAT16 需要扩展为 ROM 数据窗口与控制文件写路径。

## Impact

- 需要抽取并重构现有 ROM 擦除、编程、校验相关逻辑，使其可被文件窗口驱动。
- 虚拟磁盘层需要支持大文件 offset 到目标地址的稳定映射。
- 这是整个方案中资源与状态复杂度最高的一步，依赖前序 change 的设计稳定。
