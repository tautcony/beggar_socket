# MCU 固件实现 Wiki

本文档基于 `mcu/chis_flash_burner` 代码整理，目标是帮助后续维护者快速理解这套 MCU 固件的职责、分层、命令流和关键实现细节。

## 1. 工程定位

- 固件目标：`STM32F103C8T6/TX`，工程名为 `chis_flash_burner`
- 功能定位：通过 USB CDC 虚拟串口接收上位机命令，直接驱动卡带总线，完成 GBA/GBC ROM、RAM、FRAM 读写与烧录
- 关键目录：
  - `mcu/chis_flash_burner/Core/Src/main.c`：启动、时钟、GPIO、主循环
  - `mcu/chis_flash_burner/Core/Src/uart.c`：协议解析、命令分发、烧录流程
  - `mcu/chis_flash_burner/Core/Src/cart_adapter.c`：卡带地址/数据总线读写适配层
  - `mcu/chis_flash_burner/USB_DEVICE/App/usbd_cdc_if.c`：USB CDC 与协议层桥接
  - `mcu/chis_flash_burner/CMakeLists.txt`：构建脚本与编译选项

## 2. 总体架构

固件逻辑可以分成 4 层：

1. **USB 设备层**
   - STM32 USB FS + CDC 类
   - 将设备暴露为虚拟串口
2. **协议层**
   - 接收上位机发来的定制二进制命令包
   - 维护接收缓冲、命令分发、应答发送
3. **设备操作层**
   - 按命令类型实现 ROM/RAM/GBC/FRAM 的擦除、编程、透传读写
4. **硬件总线适配层**
   - 通过 GPIO 直接模拟地址线、数据线、`CS/RD/WR`
   - 控制总线方向与关键时序

整体调用链如下：

`USB OUT 包` → `CDC_Receive_FS()` → `uart_cmdRecv()` → `main()` 轮询 `uart_cmdHandler()` → 对应 `rom/ram/gbc` 操作 → `CDC_Transmit_FS()` 返回 ACK 或数据

## 3. 启动与主循环

### 3.1 启动流程

`mcu/chis_flash_burner/Core/Src/main.c` 做的事情比较少，主流程非常直接：

1. `HAL_Init()`
2. `SystemClock_Config()`
3. `MX_GPIO_Init()`
4. `MX_USB_DEVICE_Init()`
5. 进入死循环，持续调用 `uart_cmdHandler()`
6. 空闲时执行 `__WFI()` 进入低功耗等待中断

### 3.2 时钟配置

- 外部高速晶振 `HSE`
- PLL 倍频到 `72 MHz`
- USB 时钟使用 `PLL / 1.5`，即 `48 MHz`

这说明工程是标准 STM32F103 USB FS 配置。

### 3.3 主循环特点

主循环不是事件驱动状态机，而是：

- USB 中断把数据塞进接收缓冲
- 前台循环检测“是否收到完整命令”
- 一次只执行一条命令

这套模型简单直接，也解释了代码里为什么会有：

- `busy` 标志位
- 命令缓冲清空机制
- 多处 `__WFI()`，在等待 USB 发送空闲或 Flash 编程完成时让 CPU 睡眠

## 4. GPIO 与总线映射

### 4.1 引脚角色

在 `mcu/chis_flash_burner/Core/Inc/main.h` 中可以看出硬件总线的基本映射：

- `GPIOB[15:0]` → `AD[15:0]`
- `GPIOA[7:0]` → `A[23:16]` 或 8 位数据口
- `PA8` → `CS1`
- `PC13` → `CS2`
- `PA9` → `RD`
- `PA10` → `WR`
- `PC14` → LED

### 4.2 总线复用方式

这套板子不是完整独立地址总线，而是做了复用：

- **GBA ROM 模式**
  - `GPIOB[15:0]` 用作低 16 位地址/16 位数据
  - `GPIOA[7:0]` 用作高地址 `A[23:16]`
- **RAM/GBC 模式**
  - `GPIOB[15:0]` 主要承载地址
  - `GPIOA[7:0]` 承载 8 位数据

因此 `cart_adapter.c` 里会看到：

- `cart_setDirection_ad()`：切 `GPIOB` 输入/输出方向
- `cart_setDirection_a()`：切 `GPIOA[7:0]` 输入/输出方向

### 4.3 为什么大量直接操作寄存器

`cart_adapter.c` 明显绕开了 HAL GPIO API，直接写：

- `GPIOx->CRL/CRH`
- `GPIOx->ODR`
- `GPIOx->IDR`
- `GPIOx->BSRR`

原因很明确：

1. **时序要求严格**，HAL 太慢且不稳定
2. **需要可预测的指令序列**
3. **要频繁切换 GPIO 方向**，直接改配置寄存器更高效

## 5. `cart_adapter.c`：总线适配层

这一层是整个固件最“硬件相关”的部分，本质上是在软件里模拟卡带总线时序。

### 5.1 基础原语

- `cart_setDirection_ad(dir)`：设置 `GPIOB` 为输入上拉或 50MHz 推挽输出
- `cart_setDirection_a(dir)`：设置 `GPIOA[7:0]` 为输入上拉或 50MHz 推挽输出
- `cart_readBus_ad()` / `cart_writeBus_ad()`：读取/写入 `GPIOB[15:0]`
- `cart_readBus_a()` / `cart_writeBus_a()`：读取/写入 `GPIOA[7:0]`

### 5.2 四类访问原语

#### `cart_romRead(addr, buf, len)`

- 把 `addr[23:16]` 放到 `GPIOA[7:0]`
- 把 `addr[15:0]` 放到 `GPIOB[15:0]`
- 拉低 `CS1`
- 将 `GPIOB` 切成输入
- 循环拉低 `RD` 采样数据

特点：

- 地址先锁存，之后连续读只反复触发 `RD`
- 适合底层 NOR Flash 连续读

#### `cart_romWrite(addr, buf, len)`

- 同样先锁存起始地址
- 拉低 `CS1`
- 保持总线输出模式
- 循环向 `GPIOB` 写 16 位数据并翻转 `WR`

这里默认目标设备支持“写一个字后内部地址自增”的访问方式，因此无需每个字都重新写地址。

#### `cart_ramRead(addr, buf, len)` / `cart_ramWrite(addr, buf, len)`

- `CS2` 作为片选
- 每次循环都显式更新 `GPIOB` 上的地址
- 数据通过 `GPIOA[7:0]` 读写

这更像典型 8 位 SRAM/FRAM 总线模型。

#### `cart_gbcRead(addr, buf, len)` / `cart_gbcWrite(addr, buf, len)`

- 与 RAM 访问形式很接近
- 但片选使用 `CS1`
- 面向 GB/GBC 卡带空间

### 5.3 时序保障手段

`cart_adapter.h` 里有几项非常关键：

- `NO_OPTIMIZE`
- `NO_INLINE`
- `MEMORY_BARRIER()`
- `TIMING_DELAY()`

其中 `TIMING_DELAY()` 在 `Debug` 和 `Release` 下插入不同数量的 `nop`，目的很明确：

- 避免优化后波形过快
- 保证 `CS/RD/WR` 脉宽、地址保持、数据建立时间满足器件要求

`CMakeLists.txt` 里还专门限制了优化策略：

- `Debug`：`-Og`
- `Release`：`-O1`
- 额外关闭若干重排/调度优化

这说明该工程对“编译器改变时序”非常敏感。

## 6. USB CDC 接入层

`mcu/chis_flash_burner/USB_DEVICE/App/usbd_cdc_if.c` 主要做了两件事。

### 6.1 数据接收

`CDC_Receive_FS()`：

- 收到一包 USB OUT 数据后调用 `uart_cmdRecv(Buf, *Len)`
- 然后立刻重新挂接下一次接收 `USBD_CDC_ReceivePacket()`

也就是说协议层自己负责拼包，USB 层只负责把分包原样转交。

### 6.2 控制线复用为“软复位命令缓冲”

`CDC_SET_CONTROL_LINE_STATE` 会解析：

- `RTS`
- `DTR`

再调用 `uart_setControlLine(rts, dtr)`。

当前实现里，只要检测到 `RTS` 或 `DTR` 从 0 变 1，就会：

- 清空命令缓冲 `cmdBuf`
- 清空响应缓冲 `responBuf`
- 清除 `busy`
- LED 闪烁 3 次作为提示

这和根目录 `README.md` 中的协议说明一致：上位机可以通过拉高 DTR 来重置 MCU 的命令缓冲。

## 7. `uart.c`：协议与命令执行核心

### 7.1 缓冲与数据结构

`uart.c` 定义了几种打包结构：

- `Desc_cmdHeader_t`
  - `cmdSize`：整个命令包长度
  - `cmdCode`：命令码
  - `payload[]`
- `Desc_cmdBody_write_t`
  - `baseAddress`
  - `payload[]`
- `Desc_cmdBody_read_t`
  - `baseAddress`
  - `readSize`
  - `crc16`
- `Desc_respon_t`
  - `crc16`
  - `payload[]`

缓冲大小：

- `cmdBuf[5500]`
- `responBuf[5500]`

单次收发上限大约就是 5KB 量级。

### 7.2 协议特点

和 `README.md` 一致，当前实现的几个关键特点是：

- 小端序
- 包头前两个字节是总长度
- CRC 字段保留但**实际上不校验也不计算**
- 数据响应包前 2 字节仍保留 CRC 占位
- ACK 固定返回 `0xAA`

代码里虽然有 `modbusCRC16()`，但目前仅保留，未参与实际逻辑。

### 7.3 接收与命令边界判定

`uart_cmdRecv()` 的策略很简单：

- 如果 `busy=1`，直接丢弃新数据
- 否则把收到的数据追加到 `cmdBuf`
- 不做复杂流控，也不做分段命令状态机

`uart_cmdHandler()` 每轮检查：

- `cmdBuf_p > 2`
- `cmdBuf_p >= uart_cmd->cmdSize`

满足后就认为一条完整命令到齐，开始执行。

### 7.4 发送策略

#### `uart_responAck()`

- 等待 USB CDC `TxState == 0`
- 发送单字节 `0xAA`

#### `uart_responData()`

- 可将有效数据拷入 `responBuf.payload`
- 按 `512` 字节分片经 `CDC_Transmit_FS()` 发送
- 同样会先等待 `TxState == 0`

因此协议层默认认为：

- USB OUT 可能分包，需要自己拼
- USB IN 也可能需要主动切分，避免一次发太大

## 8. 命令实现说明

### 8.1 GBA / 主卡 ROM 命令

#### `0xF0` `romGetID()`

- 发送典型 AMD/Fujitsu 兼容 NOR 的 Autoselect 序列：`AA 55 90`
- 读取地址 `0x00/0x01/0x0E/0x0F`
- 返回 8 字节 ID
- 最后发送 `0xF0` 退出 ID 模式

#### `0xF1` `romEraseChip()`

- 发送整片擦除命令序列
- **注意：函数返回 ACK 时并未等待擦除真正完成**

这和 `README.md` 的说明一致：只是发出命令，不额外判断擦除结果。

#### `0xF2` `romEraseBlock()`

- 当前仅返回 ACK
- 注释写明“本项目无用”，可视为保留接口

#### `0xF3` `romEraseSector()`

- 从命令负载提取扇区地址
- 发送扇区擦除序列
- 调用 `romWaitForDone()` 轮询完成

这里的地址处理值得注意：

- `sectorAddress = (baseAddress >> 1) & 0x00ff0000`

说明固件把外部字节地址换算成 16 位总线字地址，并只保留高位段来定位扇区。

#### `0xF4` `romProgram()`

支持两种编程模式：

1. **单字编程**：`bufferWriteBytes == 0`
   - 发送 `AA 55 A0`
   - 写 1 个 16 位字
   - 调用 `romWaitForDone()`
2. **Write Buffer Programming**：`bufferWriteBytes != 0`
   - 发送 `AA 55 25`
   - 写入本次字数减一
   - 连续装载数据
   - 发送 `29` 确认编程
   - 等待最后一个字完成

这部分说明目标 GBA Flash 芯片至少兼容 AMD 命令集中的写缓冲编程。

#### `0xF5` `romWrite()`

- 底层透传写
- 不做 Flash 命令封装
- 适合调试、特殊命令、时序验证

#### `0xF6` `romRead()`

- 读取字节数 `readSize`
- 换算成字数后调用 `cart_romRead()`
- 原样返回数据

### 8.2 GBA / 主卡 RAM 命令

#### `0xF7` `ramWrite()`

- 对 `CS2` 空间做 8 位写入
- 代码中特别说明：**bank 切换由上位机负责**

#### `0xF8` `ramRead()`

- 对 `CS2` 空间做 8 位读取
- 同样不处理 bank 切换

#### `0xF9` `ramProgramFlash()`

- 面向挂在 RAM 侧、但实际是 Flash 型存档的器件
- 使用 8 位命令序列：`AA 55 A0`
- 逐字节写入并调用 `ramWaitForDone()`

这说明设计者兼容了“外观看起来像 SRAM 地址空间，实则是 8 位 Flash Save”的卡带。

#### `0xE7` / `0xE8`

- `ramWrite_forFram()`
- `ramRead_forFram()`

这是给慢速 FRAM / 特殊存储器准备的变体：

- 每读/写 1 字节后插入可配置 `latency` 个 `NOP`

### 8.3 GBC 命令

#### `0xFA` / `0xFB`

- `gbcWrite()`
- `gbcRead()`

为 GB/GBC 空间提供 8 位透传访问。

#### `0xFC` `gbcRomProgram()`

逻辑和 GBA ROM 编程类似，但总线宽度为 8 位：

- 单字节编程：`AA 55 A0`
- 多字节缓冲编程：`AA 55 25 ... 29`
- 完成检测走 `gbcRomWaitForDone()`

地址也采用 GB/GBC 常见的 `0xAAA/0x555` 命令地址。

#### `0xEA` / `0xEB`

- `gbcWrite_forFram()`
- `gbcRead_forFram()`

与 RAM 的 FRAM 变体一致，也是每字节插入可配置延迟。

## 9. 完成检测与超时策略

代码里有三个“等待完成”函数：

- `romWaitForDone()`
- `ramWaitForDone()`
- `gbcRomWaitForDone()`

共同特点：

- 都带 `OPERATION_TIMEOUT = 10000`
- 轮询目标地址读回值
- 期间如果检测到 `cmdBuf_p == 0` 也会提前退出

### 9.1 `romWaitForDone()` 的判定逻辑

它不是直接比对整个 16 位值，而是：

- 只比较 DQ7（`0x0080`）

这符合常见 NOR Flash 的 DQ7 Data Polling 思路。

### 9.2 为什么 `cmdBuf_p == 0` 会中断等待

因为 `uart_setControlLine()` 在检测到 DTR/RTS 上升沿后会清空接收缓冲，等价于人为取消当前命令。这样上位机可以在卡死或超长等待时尝试恢复设备。

## 10. 构建与优化策略

`mcu/chis_flash_burner/CMakeLists.txt` 有几个非常值得保留的设计：

- `Release` 只用 `-O1`，不用 `-O2`
- 显式关闭部分指令调度与函数重排优化
- 通过 `BUILD_TIMESTAMP` 注入构建时间戳宏
- 后处理生成：
  - `.elf`
  - `.hex`
  - `.bin`

这说明本工程把“时序稳定可控”放在“极限性能”之前。

## 11. 当前实现的几个关键结论

### 11.1 这是“直接 GPIO 打总线”的方案

固件没有抽象出复杂驱动框架，本质就是：

- USB 收命令
- GPIO 翻地址线/数据线/控制线
- 轮询器件完成状态

优点是简单、可控、接近硬件；缺点是：

- 时序强依赖编译器与主频
- 可移植性弱
- 很多协议约束需要上位机配合完成

### 11.2 上位机承担了不少职责

当前 MCU 固件明确把这些工作留给上位机：

- RAM/Save bank 切换
- 命令包分片与发送顺序控制
- 擦写流程编排
- 错误恢复时通过 DTR/RTS 清缓冲

因此 MCU 更像一个“总线执行器”，而不是完整业务控制器。

### 11.3 CRC 目前只是占位字段

协议格式保留了 CRC，但代码没有真正启用校验。优点是省时间、省带宽开销；缺点是：

- USB 层之外没有端到端命令完整性检测
- 出现协议错包时更依赖上位机重试与控制线复位

### 11.4 `romEraseBlock()` 还没真正实现

如果后续需要支持 block erase，建议结合目标 Flash 数据手册确认：

- block 地址粒度
- 命令地址是否与 sector erase 一致
- 完成检测方式

## 12. 后续维护建议

### 12.1 若继续迭代固件，优先关注这些点

1. **补充命令结果码**
   - 目前多数操作只回 `0xAA`
   - 超时、校验失败、器件忙等错误无法区分
2. **把 CRC 做成可选开关**
   - 保留兼容现有上位机的同时，允许调试或长链路场景启用
3. **明确各命令的地址单位**
   - 当前有的按字节地址，有的内部换算成字地址，容易混淆
4. **把时序常量与器件类型绑定**
   - 尤其是 FRAM latency、Write Buffer 大小、轮询策略
5. **为 `romEraseBlock()` 增加真实实现或明确标记废弃**

### 12.2 若继续写上位机或调试工具，建议牢记

- DTR/RTS 上升沿会清空 MCU 命令状态
- ACK 只表示命令流已执行到某一步，不一定代表最终物理操作成功
- 部分写入命令要求数据长度是偶数或符合器件缓冲大小
- RAM/Save bank 切换要由上位机自己完成

## 13. 一句话总结

这套 MCU 固件是一个围绕 `STM32F103 + USB CDC + GPIO 并行总线` 搭建的卡带访问执行器：上层协议很薄，核心价值集中在 `uart.c` 的烧录流程和 `cart_adapter.c` 的总线时序控制。
