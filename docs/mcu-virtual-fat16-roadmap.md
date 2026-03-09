# MCU 虚拟 FAT16 磁盘分阶段路线

本文档把当前目标拆分为 4 个按顺序推进的 OpenSpec change，用于降低实现风险，并让设计、实现、验证可以逐步闭环。

## 总体顺序

1. `fat16-read-only-virtual-disk`
2. `parameter-file-control-plane`
3. `ram-upload-and-commit`
4. `rom-streaming-program-window`

原则：

- 前一阶段完成并验证后，再进入下一阶段
- 后一阶段默认依赖前一阶段的固定 FAT16 布局和文件视图模型
- `ROM` 大文件烧录能力放到最后，避免一开始就把复杂度推高

## Phase 1: `fat16-read-only-virtual-disk`

目标：先把设备稳定枚举为 `USB MSC + FAT16` 虚拟磁盘，并验证固定目录、固定文件和只读文件窗口模型。

范围：

- 固定 FAT16 逻辑布局
- 根目录与 `ROM/`、`RAM/` 主目录
- `INFO.TXT`
- `STATUS.TXT`
- `/ROM/CURRENT.GBA`
- `/RAM/CURRENT.SAV`
- 参数目录下的只读候选项文件

为什么第一步先做它：

- 它验证的是整个方案最基础的骨架
- 不涉及写入、提交、擦除、状态竞争等复杂问题
- 可以先确认主机兼容性、扇区映射、cluster 查表和大窗口只读行为

完成标志：

- 插入系统后可识别为 FAT16 可移动磁盘
- 能稳定导出 `CURRENT.GBA` 和 `CURRENT.SAV`
- 只读状态/信息文件内容正确

## Phase 2: `parameter-file-control-plane`

目标：建立参数目录、候选项文件、`SELECT.TXT`、`CONFIG.TXT`、`STATUS.TXT` 的控制面板模型。

范围：

- `/ROM/MODE/*`
- `/ROM/VERIFY/*`
- `/RAM/TYPE/*`
- `/RAM/SIZE/*`
- `/RAM/BANKING/*`
- `/RAM/VERIFY/*`
- 各目录下的 `SELECT.TXT`
- `/RAM/CONFIG.TXT`
- 参数写入后更新会话态 `pending_config`
- 状态回读与帮助文本

为什么第二步做它：

- 这是后续所有写入任务的控制入口
- 可以独立验证“写控制文件 ≠ 本地落盘，而是更新 SRAM 中状态”的模型
- 风险比真正写卡低很多

完成标志：

- 写 `SELECT.TXT` 可更新参数组当前待生效值
- `CONFIG.TXT` 可更新复合参数
- `STATUS.TXT` 能同时反映 current/pending 状态

## Phase 3: `ram-upload-and-commit`

目标：先实现小文件、低风险的 `RAM/UPLOAD.SAV + COMMIT.TXT` 工作流。

范围：

- `/RAM/UPLOAD.SAV`
- `/RAM/COMMIT.TXT`
- `/RAM/ERASE.TXT`
- `RAM` 相关 job manager 状态机
- SRAM / FRAM / Flash Save 的写入分发
- 可选校验流程

为什么第三步做它：

- `SAV` 文件尺寸远小于 ROM，最适合作为第一批写路径
- 能验证参数控制、提交模型、任务状态机和状态文件更新的完整链路
- 出错恢复成本比 ROM 烧录低

完成标志：

- 能通过文件复制 + `COMMIT.TXT` 写入存档
- 可根据参数选择不同 RAM 类型写法
- 状态文件能反映进度、成功和失败原因

## Phase 4: `rom-streaming-program-window`

目标：实现 `/ROM/UPLOAD.GBA` 作为 ROM 流式编程窗口的最终模型。

范围：

- `/ROM/UPLOAD.GBA`
- `/ROM/COMMIT.TXT`
- `/ROM/ERASE.TXT`
- ROM 流式编程 job manager
- 擦除、编程、校验与错误恢复
- 处理 ROM offset 到卡地址的映射

为什么最后做它：

- 这是资源压力最大、状态机最复杂、主机行为最难控的一步
- 当前 MCU 无法缓存整 ROM，必须走流式写窗口模型
- 它依赖前面三步已经稳定：MSC/FAT16、参数控制、提交模型、状态回读

完成标志：

- 能通过 `/ROM/UPLOAD.GBA` 按 offset 写入目标卡 ROM
- 能通过 `COMMIT.TXT` 完成收尾与校验
- 主机侧可完成“拖文件烧录”的最终体验

## OpenSpec 对应关系

建议每个阶段各自维护一个独立 change：

- `fat16-read-only-virtual-disk`
- `parameter-file-control-plane`
- `ram-upload-and-commit`
- `rom-streaming-program-window`

这样每个 change 都能有自己的：

- `proposal.md`
- `design.md`
- `specs/`
- `tasks.md`

并且顺序上明确为：

```text
fat16-read-only-virtual-disk
  -> parameter-file-control-plane
    -> ram-upload-and-commit
      -> rom-streaming-program-window
```

## 与总方案文档的关系

- 总体设计见 `docs/mcu-virtual-fat16-disk-design.md`
- 本文档只负责：
  - 分阶段
  - 排顺序
  - 定优先级
  - 说明每个阶段为什么单独拆分
