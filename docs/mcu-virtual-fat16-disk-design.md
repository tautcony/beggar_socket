# MCU 虚拟 FAT16 可移动磁盘方案

本文档用于细化 `beggar_socket` MCU 固件的一个候选演进方向：让设备插入系统后被识别为一个普通可移动磁盘，并通过固定目录、固定文件和参数文件来完成卡带 ROM/RAM 的读取、烧录与配置。

本文档聚焦于：

- 是否可行
- 推荐的整体架构
- FAT16 中目录、文件、参数的具体表达方式
- 与现有 `CDC + uart.c + cart_adapter.c` 实现的衔接方式
- 风险、边界与分阶段落地路径

## 1. 目标与边界

### 1.1 目标

设备插入电脑后：

- 被系统识别为一个可移动磁盘
- 文件系统使用 `FAT16`
- 顶层有两个主要目录：`ROM/` 和 `RAM/`
- 用户通过复制文件、读取文件、写入参数文件、写入提交文件来完成：
  - 导出卡 ROM
  - 烧录卡 ROM
  - 导出存档
  - 写入存档
  - 选择 RAM 类型、校验开关等参数

### 1.2 不追求的目标

第一阶段不追求：

- 通用可写 FAT 文件系统
- 任意文件名和任意目录结构
- 自动识别“文件复制已完成后立刻烧录”
- 完整 FAT32
- 和桌面 U 盘一样的全部行为兼容性

### 1.3 设计原则

- **虚拟磁盘，不是真实磁盘**：主机看到的是 FAT16，MCU 内部看到的是一组固定文件视图
- **固定布局，不做通用 FAT 管理器**：目录树、簇链、文件槽位预先定义
- **显示与控制分离**：多数文件只读展示，少数文件作为命令入口
- **危险操作必须显式提交**：复制上传文件不等于立刻烧录
- **与现有底层总线代码复用**：尽量复用 `cart_adapter.c` 与 `uart.c` 中已经验证过的访问流程

## 2. 可行性结论

## 2.1 总体可行

从原理上看，该方案是可行的：

- 当前 MCU 已经具备卡带 ROM/RAM/FRAM/GBC 的底层访问能力
- STM32 USB FS 可以切换或扩展为 `USB MSC`
- FAT16 可以用固定镜像方式虚拟出来
- 通过少量“特殊控制文件”就能把文件系统操作翻译为现有烧录动作

## 2.2 真正难点不在 USB，而在文件语义

难点不是“让系统识别成磁盘”，而是：

- 操作系统会按扇区随机读写 FAT 结构
- 目录项、FAT 表、数据区写入顺序不固定
- Windows/macOS 可能带缓存、时间戳、隐藏文件等额外行为
- 用户“复制一个文件”并不等于 MCU 能可靠判断“文件内容已完整且可以立即执行”

因此本方案必须选择：

- **固定 FAT16 布局**
- **固定文件槽位**
- **显式提交模型**

## 2.3 对当前硬件资源的现实判断

当前固件目标是 `STM32F103C8`，资源并不充裕。

要注意：

- 现有 `cmdBuf + responBuf` 就约 11KB
- 再加 USB、栈、状态机，RAM 压力较大
- 如果继续保留完整 CDC 协议，再加入 MSC，Flash/RAM 都会变紧

所以方案要尽量避免：

- 大量缓存
- 通用 FAT 读写库
- 复杂文件分配逻辑
- 需要完整暂存大 ROM 文件的做法

## 3. 总体架构建议

建议把系统拆成如下层次：

```text
USB Composite / MSC-only
  ├─ USB MSC Class
  │   └─ SCSI READ10/WRITE10
  │       └─ virtual_disk.c
  │           └─ fat16_layout.c
  │               └─ file_views.c
  │                   └─ job_manager.c
  │                       └─ cart_service.c
  │                           └─ cart_adapter.c
  └─ 可选 USB CDC
      └─ 调试、兼容旧协议、日志输出
```

推荐模块职责如下：

- `cart_adapter.c`
  - 保持现有 GPIO 总线原语
  - 不感知 FAT 和 MSC
- `cart_service.c`
  - 从 `uart.c` 抽取高层卡操作
  - 例如：读 ROM、写 ROM、擦除、读 RAM、按 RAM 类型写存档、校验等
- `job_manager.c`
  - 管理异步任务状态
  - 例如：`IDLE / PREPARE / ERASE / PROGRAM / VERIFY / DONE / ERROR`
- `file_views.c`
  - 将固定文件映射到“读文本、写命令、读卡内容、写卡内容”的行为
- `fat16_layout.c`
  - 固定引导扇区、FAT 表、目录项、文件簇链
- `virtual_disk.c`
  - 把 LBA 读写路由到对应文件视图
- `usb_msc.c`
  - 响应 MSC/SCSI 请求

## 4. 为什么选择 FAT16

选择 `FAT16` 而不是 `FAT32`，理由如下：

- 系统识别为可移动磁盘不要求一定 FAT32
- FAT16 结构更简单，适合固定镜像
- 当前设备并不需要一个超大容量“真实磁盘”
- 该磁盘本质是控制面板与数据窗口，容量需求有限
- 对 MCU 侧实现最友好

结论：

- **第一版推荐 FAT16**
- 如果未来为了兼容性或容量展示需要，再考虑 FAT32

## 5. 推荐的虚拟磁盘目录结构

推荐的顶层结构如下：

```text
/INFO.TXT
/STATUS.TXT
/ROM/
  CURRENT.GBA
  UPLOAD.GBA
  STATUS.TXT
  COMMIT.TXT
  ERASE.TXT
  VERIFY/
    ON.TXT
    OFF.TXT
    SELECT.TXT
  MODE/
    READ.TXT
    PROGRAM.TXT
    ERASE_ONLY.TXT
    SELECT.TXT
/RAM/
  CURRENT.SAV
  UPLOAD.SAV
  STATUS.TXT
  COMMIT.TXT
  ERASE.TXT
  TYPE/
    AUTO.TXT
    SRAM.TXT
    FRAM.TXT
    FLASH64.TXT
    FLASH128.TXT
    SELECT.TXT
  SIZE/
    AUTO.TXT
    8K.TXT
    32K.TXT
    64K.TXT
    128K.TXT
    SELECT.TXT
  BANKING/
    AUTO.TXT
    MBC1.TXT
    MBC3.TXT
    MBC5.TXT
    SELECT.TXT
  VERIFY/
    ON.TXT
    OFF.TXT
    SELECT.TXT
  CONFIG.TXT
```

说明：

- 顶层 `INFO.TXT` 和 `STATUS.TXT` 提供设备级信息
- `ROM/` 负责 ROM 导出、ROM 编程、ROM 模式切换
- `RAM/` 负责存档导出、存档写入、RAM 类型与其他参数选择
- 参数目录采用“候选文件 + SELECT.TXT”的模式

## 6. 参数在 FAT16 中的表现方式

这一节是本设计的核心。

### 6.1 参数不要靠“目录存在/不存在”表达

不建议用如下方式表示参数：

```text
/RAM/TYPE/FRAM/
```

再通过创建或删除目录来表示选择状态，因为：

- FAT 目录创建/删除比写固定文件复杂得多
- 操作系统可能带额外写入行为
- 目录本身没有“选中”语义
- 固件需要处理目录项修改和 FAT 更新，复杂度明显上升

因此推荐：

- **目录负责分组**
- **文件负责表达参数项和参数值**

### 6.2 推荐模型：候选文件 + `SELECT.TXT`

例如 RAM 类型参数：

```text
/RAM/TYPE/
  AUTO.TXT
  SRAM.TXT
  FRAM.TXT
  FLASH64.TXT
  FLASH128.TXT
  SELECT.TXT
```

其中：

- `AUTO.TXT` / `SRAM.TXT` / `FRAM.TXT` / ...：
  - 只读
  - 展示该选项的说明及当前是否选中
- `SELECT.TXT`：
  - 可写
  - 用户往里面写目标值，例如 `FRAM`
  - MCU 修改 `pending_config.ram_type`

这是一个很稳的折中：

- 保留了“参数按文件夹分组”的用户体验
- 真正的写入入口固定，FAT 层实现简单
- 不必让每个候选项文件都承担写入解析责任

### 6.3 候选文件内容示例

例如当前 `RAM TYPE = FRAM` 时：

`/RAM/TYPE/FRAM.TXT`

```text
NAME=FRAM
SELECTED=1
DESC=FRAM mode with delayed byte access
```

`/RAM/TYPE/SRAM.TXT`

```text
NAME=SRAM
SELECTED=0
DESC=Direct SRAM mode
```

主机读取这些文件时，内容由 MCU 动态生成。

### 6.4 `SELECT.TXT` 内容示例

例如：

`/RAM/TYPE/SELECT.TXT`

写入：

```text
FRAM
```

MCU 解析成功后：

- `pending_config.ram_type = FRAM`
- 更新 `/RAM/STATUS.TXT`
- 后续 `COMMIT.TXT` 才真正触发任务

### 6.5 为什么推荐 `SELECT.TXT` 而不是“直接写候选项文件”

虽然也可以让用户直接写：

- `/RAM/TYPE/FRAM.TXT`
- `/RAM/VERIFY/ON.TXT`

来表示选择，但相比之下 `SELECT.TXT` 更稳：

- 写入口固定
- 容易做统一解析
- FAT 中只需让一个文件可写
- 候选项文件可以全部只读展示
- 操作系统的额外写入更容易隔离

因此推荐：

- **候选项文件：只读**
- **`SELECT.TXT`：可写命令入口**

## 7. 参数分类与 FAT 表现建议

建议把参数分成三类。

### 7.1 枚举型参数

例如：

- RAM 类型
- RAM 大小
- Banking 类型
- ROM 模式

推荐结构：

```text
/RAM/TYPE/* + SELECT.TXT
/RAM/SIZE/* + SELECT.TXT
/RAM/BANKING/* + SELECT.TXT
/ROM/MODE/* + SELECT.TXT
```

写法：

- 向 `SELECT.TXT` 写：`FRAM`
- 向 `SELECT.TXT` 写：`128K`
- 向 `SELECT.TXT` 写：`MBC3`
- 向 `SELECT.TXT` 写：`PROGRAM`

### 7.2 开关型参数

例如：

- VERIFY ON/OFF

推荐结构：

```text
/RAM/VERIFY/
  ON.TXT
  OFF.TXT
  SELECT.TXT
```

写法：

- 向 `SELECT.TXT` 写：`ON`
- 或写：`OFF`

这样比单一 `VERIFY.TXT=0/1` 更直观，也更符合“目录参数面板”的感觉。

### 7.3 数值型或复合型参数

例如未来可能加入：

- `FRAM_LATENCY`
- 手动偏移地址
- 自定义分块大小
- 设备特定高级参数

这类参数不适合拆成一堆离散文件，建议用：

```text
/RAM/CONFIG.TXT
```

内容示例：

```text
TYPE=FRAM
SIZE=128K
BANKING=AUTO
VERIFY=ON
FRAM_LATENCY=3
```

写入语义：

- 主机覆盖写整个文本
- MCU 解析 `key=value`
- 解析成功则更新 `pending_config`
- 解析失败则在 `STATUS.TXT` 写错误信息

结论：

- **枚举型、开关型：目录 + 选项文件 + SELECT.TXT**
- **数值型、复合型：CONFIG.TXT**

## 8. 文件语义设计

### 8.1 只读镜像文件

#### `/ROM/CURRENT.GBA`

- 只读
- 主机读取时，MCU 按文件偏移换算成 ROM 地址
- 调用 `cart_service_read_rom()` 流式返回数据
- 用于导出当前卡 ROM

#### `/RAM/CURRENT.SAV`

- 只读
- 主机读取时，MCU 按文件偏移读取存档
- 根据当前或待选的 RAM 类型路由到对应访问方式
- 用于导出当前存档

### 8.2 上传文件

#### `/RAM/UPLOAD.SAV`

- 可写
- 主机把待写入存档复制进来
- MCU 按 offset 接收数据并写入任务缓冲或直接映射到写流程
- 不建议“写入完成即自动执行”
- 需要用户再写 `/RAM/COMMIT.TXT`

#### `/ROM/UPLOAD.GBA`

- 逻辑上可写
- 但由于 MCU 没有足够 RAM/额外大容量存储，不能完整缓存整 ROM
- 因此该文件应被定义为：
  - **目标卡 ROM 的编程窗口**
  - 而不是“本地暂存文件”

推荐行为：

1. 用户先设置 `/ROM/MODE/SELECT.TXT = PROGRAM`
2. 必要时先写 `/ROM/ERASE.TXT`
3. 主机将数据写入 `/ROM/UPLOAD.GBA`
4. MCU 按 offset 直接把数据烧到目标 ROM 对应地址
5. 用户最后写 `/ROM/COMMIT.TXT` 表示结束并触发校验/状态收尾

也就是说：

- `UPLOAD.GBA` 更像一个 **direct program window**
- 不是真正的本地缓存文件

### 8.3 提交文件

#### `/ROM/COMMIT.TXT`
#### `/RAM/COMMIT.TXT`

建议其内容支持简单命令文本，而不是只接受一个固定字节。

例如：

```text
ACTION=PROGRAM
VERIFY=ON
```

或简化为：

```text
PROGRAM
```

用途：

- 把 `pending_config` 和已写入的上传数据转成一个正式任务
- 启动 `job_manager`
- 返回结果到 `STATUS.TXT`

### 8.4 擦除文件

#### `/ROM/ERASE.TXT`
#### `/RAM/ERASE.TXT`

写入示例：

```text
CHIP
```

或：

```text
SECTOR
ADDRESS=0x00100000
```

第一版可以先只支持最简单命令：

- ROM：`CHIP`、`SECTOR`
- RAM：如果目标类型需要擦除则执行，否则返回不支持

## 9. 状态文件设计

### 9.1 `/STATUS.TXT`

设备级状态，示例：

```text
DEVICE=BEGGAR_SOCKET
USB_MODE=MSC+CDC
BUSY=0
JOB=IDLE
LAST_ERROR=NONE
LAST_ACTION=NONE
```

### 9.2 `/ROM/STATUS.TXT`

示例：

```text
STATE=IDLE
MODE=PROGRAM
VERIFY=ON
PROGRESS=42
IMAGE_SIZE=8388608
LAST_ERROR=NONE
```

### 9.3 `/RAM/STATUS.TXT`

示例：

```text
STATE=IDLE
TYPE_CURRENT=SRAM
TYPE_PENDING=FRAM
SIZE_CURRENT=32K
VERIFY=ON
LAST_ERROR=NONE
IMAGE_SIZE=32768
```

状态文件作用：

- 告诉用户当前参数状态
- 告诉用户任务是否进行中
- 让自动化脚本可以轮询结果

## 10. 为什么必须用显式提交模型

不建议采用“用户把文件复制进去后，MCU 自动开始烧录”的模型，原因如下：

- 操作系统复制文件时会乱序写 FAT 元数据和数据区
- 文件可能还在主机缓存中，并未真正落到设备
- 很难可靠判定“整个文件已经传输完成”
- 一旦误判，可能提前开始烧录，导致卡被写坏

因此推荐固定流程：

1. 用户写参数
2. 用户上传文件
3. 用户显式写 `COMMIT.TXT`
4. MCU 才开始真正操作卡带

这是整个方案稳定性的关键。

## 11. FAT16 实现策略

## 11.1 不做通用 FAT16 写支持

建议做法是：

- 预先定义一个固定 FAT16 镜像
- Boot Sector 固定
- FAT 表固定
- 根目录固定
- 子目录固定
- 每个文件都有固定的起始簇和固定的最大容量

这样 MCU 只需知道：

- 某个 LBA 对应哪个文件
- 该文件是只读、可写命令、还是数据窗口
- 如何把文件偏移映射到卡地址或配置对象

## 11.2 固定簇映射思路

例如：

```text
Cluster 20  -> /INFO.TXT
Cluster 21  -> /STATUS.TXT
Cluster 30  -> /ROM/STATUS.TXT
Cluster 31+ -> /ROM/CURRENT.GBA data window
Cluster 200 -> /ROM/COMMIT.TXT
Cluster 210 -> /RAM/STATUS.TXT
Cluster 220 -> /RAM/TYPE/AUTO.TXT
Cluster 221 -> /RAM/TYPE/SRAM.TXT
Cluster 222 -> /RAM/TYPE/FRAM.TXT
Cluster 223 -> /RAM/TYPE/FLASH64.TXT
Cluster 224 -> /RAM/TYPE/FLASH128.TXT
Cluster 225 -> /RAM/TYPE/SELECT.TXT
```

读文件时：

- 根据簇号找到文件
- 根据文件偏移生成内容或读取卡内容

写文件时：

- 根据簇号找到目标文件
- 如果是 `SELECT.TXT` / `COMMIT.TXT` / `ERASE.TXT` 等控制文件，则解析文本
- 如果是 `UPLOAD.SAV` / `UPLOAD.GBA` 则映射到上传或编程窗口

## 11.3 目录项处理策略

目录项应尽量固定：

- 文件名固定
- 起始簇固定
- 文件大小固定或半固定

其中：

- `STATUS.TXT`、参数展示文件大小可固定为 512B
- `CURRENT.SAV` 大小可根据配置或当前检测结果返回
- `CURRENT.GBA` 可以按检测到的 ROM 大小返回
- `UPLOAD.*` 可以返回预定义最大容量

## 12. 推荐的内部配置模型

建议内部维护两套配置：

- `current_config`
- `pending_config`

含义：

- `current_config`：当前已生效、已用于最近任务的配置
- `pending_config`：用户通过 `SELECT.TXT` 或 `CONFIG.TXT` 修改、但尚未提交执行的配置

示例结构：

```text
current_config:
  ram_type = SRAM
  ram_size = 32K
  ram_verify = ON
  rom_mode = READ

pending_config:
  ram_type = FRAM
  ram_size = 32K
  ram_verify = ON
  rom_mode = PROGRAM
```

优点：

- 参数修改和任务执行解耦
- 用户可以先改多项参数，再统一提交
- 状态文件可以同时显示 current 和 pending

## 13. 推荐的任务状态机

建议 `job_manager` 维护如下状态：

```text
IDLE
PREPARE
ERASE
PROGRAM
VERIFY
DONE
ERROR
CANCELLED
```

任务大致流程：

### 13.1 ROM 编程

```text
IDLE
  -> PREPARE
  -> ERASE      (可选)
  -> PROGRAM    (来自 UPLOAD.GBA 的写窗口)
  -> VERIFY     (可选)
  -> DONE / ERROR
```

### 13.2 RAM 写入

```text
IDLE
  -> PREPARE
  -> ERASE      (若为 Flash Save 且需要)
  -> PROGRAM
  -> VERIFY     (可选)
  -> DONE / ERROR
```

### 13.3 导出读取

读取 `CURRENT.GBA` / `CURRENT.SAV` 时通常不需要进入后台任务状态机，可直接按需流式读取。

## 14. 与现有代码的衔接建议

## 14.1 不建议直接在 `uart.c` 上继续叠加逻辑

`uart.c` 当前是“协议解析 + 操作执行”混合结构。

为了支持 MSC，建议把其中和具体命令无关的高层卡操作抽出来，形成：

- `cart_service_read_rom(offset, buf, len)`
- `cart_service_program_rom(offset, buf, len)`
- `cart_service_erase_rom(...)`
- `cart_service_read_ram(offset, buf, len, config)`
- `cart_service_program_ram(offset, buf, len, config)`
- `cart_service_verify_*()`

然后：

- `CDC` 协议层继续可调用这些接口
- 新的 `MSC` 虚拟文件系统层也调用这些接口

这样可以避免逻辑分叉。

## 14.2 `cart_adapter.c` 基本可以保持不变

因为它已经提供了足够底层的：

- ROM 16 位总线访问
- RAM 8 位访问
- GBC 8 位访问

只需要在上层把：

- 文件偏移
- 参数配置
- 任务阶段

翻译成正确的卡访问调用即可。

## 15. 建议的 USB 设备形态

推荐两个可选方案：

### 15.1 `MSC-only`

优点：

- 用户体验最纯粹
- 设备看起来就是一个磁盘

缺点：

- 调试困难
- 出错时缺少辅助通道

### 15.2 `MSC + CDC`

优点：

- `MSC` 面向普通用户
- `CDC` 保留旧协议、日志、恢复入口
- 便于开发调试与兼容过渡

缺点：

- USB 描述符和类组合更复杂
- 固件体积压力更大

推荐结论：

- **研发阶段优先 `MSC + CDC`**
- **正式量产可视空间与复杂度决定是否保留 CDC**

## 16. 关键风险与约束

### 16.1 `UPLOAD.GBA` 不能被当成真正本地缓存

没有外部大容量存储时：

- MCU 无法先完整接收一个 ROM 再统一烧录
- 因此 `UPLOAD.GBA` 必须被设计为“流式编程窗口”

这是本方案最重要的现实约束。

### 16.2 主机缓存与文件复制行为不可完全预测

因此必须：

- 使用固定文件入口
- 使用 `COMMIT.TXT`
- 在状态文件中明确展示任务是否真正启动

### 16.3 不能在烧录过程中完全像正常 U 盘那样自由访问

烧录进行中建议：

- 只允许读取状态文件
- 拒绝其它控制文件写入
- 对 `CURRENT.*` 读取返回忙或旧数据

否则容易出现状态竞争。

### 16.4 MCU 资源可能迫使功能分阶段实现

如果 `F103C8` 空间不够，可能需要：

- 缩减现有 CDC 缓冲
- 先做 `MSC-only`
- 或后续升级到更大容量 MCU

## 17. 推荐的分阶段落地路径

### 阶段 1：只读虚拟盘

目标：验证 `MSC + FAT16 + 虚拟文件视图` 基本可用。

包括：

- `INFO.TXT`
- `STATUS.TXT`
- `ROM/CURRENT.GBA`
- `RAM/CURRENT.SAV`
- 参数目录只读展示文件

收益：

- 验证主机兼容性
- 验证固定 FAT16 布局正确性
- 验证扇区到卡内容的映射性能

### 阶段 2：参数与提交入口

目标：验证“参数写入 + 提交”的控制面板模型。

包括：

- `SELECT.TXT`
- `CONFIG.TXT`
- `COMMIT.TXT`
- `ERASE.TXT`
- `STATUS.TXT` 动态更新

收益：

- 验证 FAT 中参数表现方案
- 验证主机对小文本控制文件写入的稳定性

### 阶段 3：RAM 写入

目标：先完成小文件、低风险路径。

包括：

- `RAM/UPLOAD.SAV`
- 按类型写 SRAM / FRAM / Flash Save
- 可选校验

收益：

- 存档文件较小，最适合作为第一批写功能

### 阶段 4：ROM 流式编程

目标：完成 `UPLOAD.GBA` 编程窗口模型。

包括：

- `ROM/UPLOAD.GBA`
- `ROM/ERASE.TXT`
- `ROM/COMMIT.TXT`
- 流式烧录与校验

收益：

- 完成最终“拖文件烧录 ROM”的目标体验

## 18. 推荐的最终用户交互流程

### 18.1 导出 ROM

1. 插入设备
2. 打开磁盘
3. 复制 `/ROM/CURRENT.GBA` 到电脑
4. 完成

### 18.2 烧录 ROM

1. 打开 `/ROM/MODE/SELECT.TXT`，写入 `PROGRAM`
2. 如需擦除，写 `/ROM/ERASE.TXT`
3. 将 ROM 文件复制到 `/ROM/UPLOAD.GBA`
4. 写 `/ROM/COMMIT.TXT` 为 `PROGRAM`
5. 轮询 `/ROM/STATUS.TXT`
6. 完成

### 18.3 导出存档

1. 打开磁盘
2. 复制 `/RAM/CURRENT.SAV` 到电脑
3. 完成

### 18.4 写入存档

1. 写 `/RAM/TYPE/SELECT.TXT` 为 `FRAM` 或其他类型
2. 可选写 `/RAM/VERIFY/SELECT.TXT` 为 `ON`
3. 将存档复制到 `/RAM/UPLOAD.SAV`
4. 写 `/RAM/COMMIT.TXT` 为 `PROGRAM`
5. 查看 `/RAM/STATUS.TXT`
6. 完成

## 19. 最终推荐结论

本方案的推荐形态是：

- 使用 `FAT16`
- 固定目录与固定文件布局
- 通过 `ROM/` 与 `RAM/` 两个目录承载功能
- 参数通过“参数目录 + 候选文件 + SELECT.TXT”表达
- 数值或复杂参数通过 `CONFIG.TXT` 表达
- 危险动作通过 `COMMIT.TXT` 显式触发
- 状态通过 `STATUS.TXT` 回读
- `ROM/UPLOAD.GBA` 视为流式编程窗口，而非本地缓存文件

一句话总结：

**把 FAT16 磁盘当成一个文件化控制面板，而不是通用 U 盘；把参数做成目录化的只读选项展示加固定写入口，这是当前硬件条件下最稳妥、最可实现的方案。**

## 20. FAT16 逻辑布局图

本方案不实现“动态 FAT16 分配器”，而是导出一个**固定布局的虚拟 FAT16 磁盘**。主机看到的是标准 FAT16，固件内部则用静态表把 `LBA -> cluster -> file view` 映射到对应行为。

### 20.1 逻辑分区示意

```text
LBA 0
┌──────────────────────────────────────────────┐
│ Boot Sector / BPB                            │
│ - bytes per sector = 512                     │
│ - sectors per cluster = 1                    │
│ - reserved sectors = 1                       │
│ - number of FATs = 2                         │
│ - root entry count = 固定                    │
└──────────────────────────────────────────────┘
LBA 1..N
┌──────────────────────────────────────────────┐
│ FAT1                                         │
│ - 固定簇链                                   │
│ - 大文件使用预分配连续簇                     │
└──────────────────────────────────────────────┘
LBA N+1..M
┌──────────────────────────────────────────────┐
│ FAT2                                         │
│ - FAT1 镜像                                  │
└──────────────────────────────────────────────┘
LBA M+1..R
┌──────────────────────────────────────────────┐
│ Root Directory                               │
│ - INFO.TXT                                   │
│ - STATUS.TXT                                 │
│ - ROM                                         │
│ - RAM                                         │
└──────────────────────────────────────────────┘
LBA R+1..
┌──────────────────────────────────────────────┐
│ Data Region                                  │
│                                              │
│ Cluster 2   -> /INFO.TXT                     │
│ Cluster 3   -> /STATUS.TXT                   │
│ Cluster 4   -> /ROM/     (目录)              │
│ Cluster 5   -> /RAM/     (目录)              │
│ Cluster 6   -> /ROM/VERIFY/ (目录)           │
│ Cluster 7   -> /ROM/MODE/   (目录)           │
│ Cluster 8   -> /RAM/TYPE/   (目录)           │
│ Cluster 9   -> /RAM/SIZE/   (目录)           │
│ Cluster 10  -> /RAM/BANKING/(目录)           │
│ Cluster 11  -> /RAM/VERIFY/ (目录)           │
│ Cluster 12  -> /ROM/STATUS.TXT               │
│ Cluster 13  -> /ROM/COMMIT.TXT               │
│ Cluster 14  -> /ROM/ERASE.TXT                │
│ Cluster 15  -> /ROM/MODE/SELECT.TXT          │
│ Cluster 16  -> /ROM/VERIFY/SELECT.TXT        │
│ Cluster 17  -> /RAM/STATUS.TXT               │
│ Cluster 18  -> /RAM/COMMIT.TXT               │
│ Cluster 19  -> /RAM/ERASE.TXT                │
│ Cluster 20  -> /RAM/CONFIG.TXT               │
│ Cluster 21  -> /RAM/TYPE/SELECT.TXT          │
│ Cluster 22  -> /RAM/SIZE/SELECT.TXT          │
│ Cluster 23  -> /RAM/BANKING/SELECT.TXT       │
│ Cluster 24  -> /RAM/VERIFY/SELECT.TXT        │
│ Cluster 25+ -> /ROM/CURRENT.GBA window       │
│ Cluster A  -> /ROM/UPLOAD.GBA window         │
│ Cluster B  -> /RAM/CURRENT.SAV window        │
│ Cluster C  -> /RAM/UPLOAD.SAV window         │
│ 其余       -> 参数展示文件                    │
└──────────────────────────────────────────────┘
```

### 20.2 设计要点

- 根目录、子目录、文件簇链都在编译期固定
- 所有“控制文件”都占用固定 1 cluster，即 512B
- 所有“状态展示文件”也固定 1 cluster，读取时动态生成文本
- `CURRENT.*` 和 `UPLOAD.*` 是大窗口文件，目录项显示为大文件，但底层不是普通存储
- 目录项中的时间戳、卷标、属性可用固定值，减少实现复杂度

### 20.3 持久化边界

必须明确：

- `SELECT.TXT`、`COMMIT.TXT`、`ERASE.TXT`、`CONFIG.TXT` 默认都是**会话态写入口**
- 这些写入默认只更新 MCU SRAM 中的状态结构，不要求写入持久存储
- 只有未来显式增加“保存默认配置”功能时，才会把极小量配置写入 STM32 内部 Flash
- `UPLOAD.GBA` / `UPLOAD.SAV` 也不应被理解为“写到 STM32 本地磁盘文件”

## 21. 目录项 / Cluster / LBA 映射表示例

下面给出一个**示意性映射表**。数字不要求第一版完全照抄，但建议实现时保持“单 cluster 小文件 + 连续 cluster 大窗口”的规律。

### 21.1 FAT16 参数假设

示例假设：

- Sector size = `512`
- Cluster size = `1 sector`
- Reserved sectors = `1`
- FAT count = `2`
- FAT size = `64 sectors`（示例值）
- Root entry count = `128`
- Root dir sectors = `8`

则：

- `boot_lba = 0`
- `fat1_lba = 1`
- `fat2_lba = 65`
- `root_lba = 129`
- `data_lba = 137`

簇到 LBA 的公式：

- `lba = data_lba + (cluster - 2)`

### 21.2 根目录项示例

| 路径 | 类型 | 起始簇 | 大小 | 属性 | 说明 |
| --- | --- | ---: | ---: | --- | --- |
| `/INFO.TXT` | 文件 | 2 | 512 | RO | 设备信息 |
| `/STATUS.TXT` | 文件 | 3 | 512 | RO | 全局状态 |
| `/ROM` | 目录 | 4 | 0 | DIR | ROM 主目录 |
| `/RAM` | 目录 | 5 | 0 | DIR | RAM 主目录 |

### 21.3 `/ROM` 目录项示例

| 路径 | 类型 | 起始簇 | 大小 | 属性 | 说明 |
| --- | --- | ---: | ---: | --- | --- |
| `/ROM/CURRENT.GBA` | 文件 | 25 | `rom_size` | RO | 当前卡 ROM 只读窗口 |
| `/ROM/UPLOAD.GBA` | 文件 | 4096 | `rom_max_size` | RW | ROM 流式编程窗口 |
| `/ROM/STATUS.TXT` | 文件 | 12 | 512 | RO | ROM 状态 |
| `/ROM/COMMIT.TXT` | 文件 | 13 | 512 | RW | ROM 提交命令 |
| `/ROM/ERASE.TXT` | 文件 | 14 | 512 | RW | ROM 擦除命令 |
| `/ROM/VERIFY` | 目录 | 6 | 0 | DIR | ROM 校验参数目录 |
| `/ROM/MODE` | 目录 | 7 | 0 | DIR | ROM 模式参数目录 |

### 21.4 `/RAM` 目录项示例

| 路径 | 类型 | 起始簇 | 大小 | 属性 | 说明 |
| --- | --- | ---: | ---: | --- | --- |
| `/RAM/CURRENT.SAV` | 文件 | 8192 | `sav_size` | RO | 当前存档只读窗口 |
| `/RAM/UPLOAD.SAV` | 文件 | 8448 | `sav_max_size` | RW | 存档写入窗口 |
| `/RAM/STATUS.TXT` | 文件 | 17 | 512 | RO | RAM 状态 |
| `/RAM/COMMIT.TXT` | 文件 | 18 | 512 | RW | RAM 提交命令 |
| `/RAM/ERASE.TXT` | 文件 | 19 | 512 | RW | RAM 擦除命令 |
| `/RAM/CONFIG.TXT` | 文件 | 20 | 512 | RW | RAM 复合配置 |
| `/RAM/TYPE` | 目录 | 8 | 0 | DIR | RAM 类型参数目录 |
| `/RAM/SIZE` | 目录 | 9 | 0 | DIR | RAM 大小参数目录 |
| `/RAM/BANKING` | 目录 | 10 | 0 | DIR | Banking 参数目录 |
| `/RAM/VERIFY` | 目录 | 11 | 0 | DIR | 校验开关目录 |

### 21.5 参数目录项示例

以 `/RAM/TYPE` 为例：

| 路径 | 类型 | 起始簇 | 大小 | 属性 | 说明 |
| --- | --- | ---: | ---: | --- | --- |
| `/RAM/TYPE/AUTO.TXT` | 文件 | 40 | 512 | RO | 候选项展示 |
| `/RAM/TYPE/SRAM.TXT` | 文件 | 41 | 512 | RO | 候选项展示 |
| `/RAM/TYPE/FRAM.TXT` | 文件 | 42 | 512 | RO | 候选项展示 |
| `/RAM/TYPE/FLASH64.TXT` | 文件 | 43 | 512 | RO | 候选项展示 |
| `/RAM/TYPE/FLASH128.TXT` | 文件 | 44 | 512 | RO | 候选项展示 |
| `/RAM/TYPE/SELECT.TXT` | 文件 | 21 | 512 | RW | 真正写入口 |

### 21.6 LBA 访问示例

例如：

- `data_lba = 137`
- `/RAM/TYPE/FRAM.TXT` 起始簇 = `42`

则该文件对应的首扇区：

- `lba = 137 + (42 - 2) = 177`

主机读取 `LBA 177` 时，固件行为为：

1. `virtual_disk_read(177, ...)`
2. 识别 `177 -> cluster 42 -> /RAM/TYPE/FRAM.TXT`
3. `file_views_render_option_file(group=RAM_TYPE, option=FRAM)`
4. 动态生成 512B 文本并返回

再例如：

- `/RAM/TYPE/SELECT.TXT` 起始簇 = `21`
- 对应 `lba = 137 + (21 - 2) = 156`

主机写 `LBA 156` 时：

1. `virtual_disk_write(156, buf, 512)`
2. 识别 `156 -> cluster 21 -> /RAM/TYPE/SELECT.TXT`
3. 调 `file_views_write_select(RAM_TYPE, buf)`
4. 解析为 `pending_config.ram_type = FRAM`
5. 返回成功，不要求真正把这 512B 保存到本地存储

## 22. 每个虚拟文件的读写行为表

下面给出推荐的统一行为定义。实现时应尽量避免“同一路径在不同状态下行为完全不同”，除非是明确记录在表中的状态机行为。

### 22.1 全局与根目录文件

| 路径 | 读行为 | 写行为 | 是否持久化 | 备注 |
| --- | --- | --- | --- | --- |
| `/INFO.TXT` | 动态生成设备信息 | 拒绝写入 | 否 | 只读视图 |
| `/STATUS.TXT` | 动态生成全局状态 | 拒绝写入 | 否 | 只读视图 |

### 22.2 ROM 相关文件

| 路径 | 读行为 | 写行为 | 是否持久化 | 备注 |
| --- | --- | --- | --- | --- |
| `/ROM/CURRENT.GBA` | 按 offset 从卡 ROM 读 | 拒绝写入 | 否 | 导出窗口 |
| `/ROM/UPLOAD.GBA` | 可返回空洞数据、最近写入状态或拒绝读取 | 按 offset 映射为 ROM 流式编程写 | 否 | 不是本地缓存文件 |
| `/ROM/STATUS.TXT` | 动态生成 ROM 状态 | 拒绝写入 | 否 | 只读视图 |
| `/ROM/COMMIT.TXT` | 返回帮助/最近命令说明 | 解析提交命令并启动或收尾任务 | 否 | 写即命令 |
| `/ROM/ERASE.TXT` | 返回支持的擦除命令说明 | 解析擦除命令并设置/启动擦除任务 | 否 | 写即命令 |
| `/ROM/MODE/READ.TXT` | 展示 READ 是否选中 | 拒绝写入 | 否 | 候选项 |
| `/ROM/MODE/PROGRAM.TXT` | 展示 PROGRAM 是否选中 | 拒绝写入 | 否 | 候选项 |
| `/ROM/MODE/ERASE_ONLY.TXT` | 展示 ERASE_ONLY 是否选中 | 拒绝写入 | 否 | 候选项 |
| `/ROM/MODE/SELECT.TXT` | 返回当前/帮助文本 | 解析并更新 `pending_config.rom_mode` | 否 | 写即命令 |
| `/ROM/VERIFY/ON.TXT` | 展示 ON 是否选中 | 拒绝写入 | 否 | 候选项 |
| `/ROM/VERIFY/OFF.TXT` | 展示 OFF 是否选中 | 拒绝写入 | 否 | 候选项 |
| `/ROM/VERIFY/SELECT.TXT` | 返回当前/帮助文本 | 解析并更新 `pending_config.rom_verify` | 否 | 写即命令 |

### 22.3 RAM 相关文件

| 路径 | 读行为 | 写行为 | 是否持久化 | 备注 |
| --- | --- | --- | --- | --- |
| `/RAM/CURRENT.SAV` | 按 offset 从目标存档区读 | 拒绝写入 | 否 | 导出窗口 |
| `/RAM/UPLOAD.SAV` | 可返回空洞数据、最近写入状态或拒绝读取 | 按 offset 作为存档上传/写入窗口 | 否 | 可做分块 staging 或直写 |
| `/RAM/STATUS.TXT` | 动态生成 RAM 状态 | 拒绝写入 | 否 | 只读视图 |
| `/RAM/COMMIT.TXT` | 返回帮助/最近命令说明 | 解析提交命令并启动任务 | 否 | 写即命令 |
| `/RAM/ERASE.TXT` | 返回支持命令说明 | 解析擦除命令 | 否 | 写即命令 |
| `/RAM/CONFIG.TXT` | 动态生成当前/待提交配置 | 解析 `key=value` 更新 `pending_config` | 否 | 复合配置入口 |

### 22.4 RAM 参数目录文件

| 路径模式 | 读行为 | 写行为 | 是否持久化 | 备注 |
| --- | --- | --- | --- | --- |
| `/RAM/TYPE/*.TXT`（候选项） | 展示该选项说明与是否选中 | 拒绝写入 | 否 | 只读展示 |
| `/RAM/TYPE/SELECT.TXT` | 返回当前值与帮助 | 解析写入，更新 `pending_config.ram_type` | 否 | 真正写入口 |
| `/RAM/SIZE/*.TXT`（候选项） | 展示大小项说明与是否选中 | 拒绝写入 | 否 | 只读展示 |
| `/RAM/SIZE/SELECT.TXT` | 返回当前值与帮助 | 解析写入，更新 `pending_config.ram_size` | 否 | 真正写入口 |
| `/RAM/BANKING/*.TXT`（候选项） | 展示 banking 项说明与是否选中 | 拒绝写入 | 否 | 只读展示 |
| `/RAM/BANKING/SELECT.TXT` | 返回当前值与帮助 | 解析写入，更新 `pending_config.ram_banking` | 否 | 真正写入口 |
| `/RAM/VERIFY/*.TXT`（候选项） | 展示开关状态 | 拒绝写入 | 否 | 只读展示 |
| `/RAM/VERIFY/SELECT.TXT` | 返回当前值与帮助 | 解析写入，更新 `pending_config.ram_verify` | 否 | 真正写入口 |

### 22.5 “写即命令 / 写即流 / 写即持久配置”分类

为了避免后续实现时混淆，建议把所有可写路径分成 3 类：

| 类别 | 代表文件 | 语义 | 存储位置 |
| --- | --- | --- | --- |
| 写即命令 | `SELECT.TXT` `COMMIT.TXT` `ERASE.TXT` | 写入后立即解析并更新状态/启动任务 | SRAM 会话态 |
| 写即流 | `UPLOAD.GBA` `UPLOAD.SAV` | 把主机写入的数据按 offset 映射到目标窗口 | 不要求本地持久保存 |
| 写即持久配置 | 未来 `SAVEDEFAULT.TXT` | 显式把小配置刷入 MCU 内部 Flash | STM32 Internal Flash |

默认第一版只实现前两类。

## 23. 实现建议：核心查表结构

为了让 `virtual_disk.c` 保持简单，建议实现时维护两张静态表。

### 23.1 `cluster -> file view` 表

示意：

```text
cluster_map[] = {
  {2,  FILE_INFO_TXT},
  {3,  FILE_STATUS_TXT},
  {12, FILE_ROM_STATUS_TXT},
  {13, FILE_ROM_COMMIT_TXT},
  {14, FILE_ROM_ERASE_TXT},
  {15, FILE_ROM_MODE_SELECT_TXT},
  {16, FILE_ROM_VERIFY_SELECT_TXT},
  {17, FILE_RAM_STATUS_TXT},
  {18, FILE_RAM_COMMIT_TXT},
  {19, FILE_RAM_ERASE_TXT},
  {20, FILE_RAM_CONFIG_TXT},
  {21, FILE_RAM_TYPE_SELECT_TXT},
  ...
}
```

### 23.2 文件描述表

示意字段建议：

| 字段 | 含义 |
| --- | --- |
| `file_id` | 文件枚举 |
| `path` | 逻辑路径 |
| `first_cluster` | 起始簇 |
| `cluster_count` | 占用簇数 |
| `size_mode` | 固定大小 / 动态大小 |
| `access_mode` | 只读 / 命令写 / 数据写 |
| `read_handler` | 读回调 |
| `write_handler` | 写回调 |

这样 `READ10/WRITE10` 只需：

1. `lba -> cluster`
2. `cluster -> file_id`
3. `file_id + file_offset -> handler`

逻辑非常清晰。

## 24. 推荐的第一版最小工程范围

如果要开始做实现，建议第一版只落到以下能力：

- 固定 FAT16 镜像
- `INFO.TXT`
- `STATUS.TXT`
- `/ROM/CURRENT.GBA`
- `/RAM/CURRENT.SAV`
- `/RAM/TYPE/*` 展示文件
- `/RAM/TYPE/SELECT.TXT`
- `/RAM/STATUS.TXT`

先不做：

- `/ROM/UPLOAD.GBA`
- `/RAM/UPLOAD.SAV`
- `COMMIT.TXT`
- `ERASE.TXT`

原因：

- 先验证 `MSC + 固定 FAT16 + 动态文件视图` 能稳定工作
- 再逐步引入写入、状态机和流式编程
