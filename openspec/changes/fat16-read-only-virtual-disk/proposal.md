## Why

当前虚拟 FAT16 方案的最大不确定性在于 `USB MSC`、固定 FAT16 布局和虚拟文件窗口是否能在主机侧稳定工作。先实现只读虚拟磁盘可以最低风险地验证整个架构骨架，为后续参数写入和烧录任务建立可靠基础。

## What Changes

- 新增一个固定布局的 `USB MSC + FAT16` 只读虚拟磁盘。
- 提供固定根目录、`ROM/`、`RAM/` 主目录，以及必要的目录项和簇映射。
- 提供只读信息文件与状态文件，例如 `INFO.TXT`、`STATUS.TXT`。
- 提供只读数据窗口文件：`/ROM/CURRENT.GBA` 与 `/RAM/CURRENT.SAV`。
- 提供参数目录下的只读候选项文件，用于展示未来可选参数与当前状态。
- 建立 `LBA -> cluster -> file view` 的静态映射与动态文件视图机制。

## Capabilities

### New Capabilities
- `fat16-read-only-virtual-disk`: 定义固定布局的只读虚拟 FAT16 磁盘、目录结构、静态簇映射和只读文件窗口行为。
- `cartridge-read-file-views`: 定义 `/ROM/CURRENT.GBA` 与 `/RAM/CURRENT.SAV` 作为文件视图时的只读行为与偏移映射规则。

### Modified Capabilities
- None.

## Impact

- MCU 固件将新增 `USB MSC` 基础支持、固定 FAT16 布局层和只读虚拟文件视图层。
- 现有卡 ROM / 存档读取能力需要抽象为文件窗口可复用接口。
- 后续参数控制和写入任务将依赖本阶段建立的目录和簇映射骨架。
