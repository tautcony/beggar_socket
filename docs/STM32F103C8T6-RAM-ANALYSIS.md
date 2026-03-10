# STM32F103C8T6 RAM 使用分析 / RAM Usage Analysis

**MCU型号 / MCU Model**: STM32F103C8T6 (STM32F1系列，非STM32F0)
**文档日期 / Document Date**: 2026-03-10
**分析版本 / Analysis Version**: 1.0

---

## 目录 / Table of Contents

1. [硬件规格 / Hardware Specifications](#硬件规格--hardware-specifications)
2. [内存布局 / Memory Layout](#内存布局--memory-layout)
3. [RAM使用统计 / RAM Usage Statistics](#ram使用统计--ram-usage-statistics)
4. [主要内存分配 / Major Memory Allocations](#主要内存分配--major-memory-allocations)
5. [可用RAM计算 / Available RAM Calculation](#可用ram计算--available-ram-calculation)
6. [内存优化建议 / Memory Optimization Recommendations](#内存优化建议--memory-optimization-recommendations)
7. [历史内存问题 / Historical Memory Issues](#历史内存问题--historical-memory-issues)

---

## 硬件规格 / Hardware Specifications

### MCU 基本信息 / MCU Basic Information

| 项目 / Item | 规格 / Specification |
|------------|---------------------|
| **型号 / Model** | STM32F103C8T6 |
| **系列 / Series** | STM32F1 (Medium Density) |
| **核心 / Core** | ARM Cortex-M3 |
| **主频 / Clock** | 72 MHz (max) |
| **Flash** | 64 KB (0x08000000 - 0x0800FFFF) |
| **RAM** | **20 KB (0x20000000 - 0x20004FFF)** |
| **封装 / Package** | LQFP48 |

**重要说明 / Important Note**:
- 本项目使用的是 **STM32F103C8T6**，属于 **STM32F1** 系列
- **不是 STM32F0** 系列！
- This project uses **STM32F103C8T6**, which is **STM32F1** series
- **NOT STM32F0** series!

### 内存地址映射 / Memory Address Mapping

```
Flash Memory (ROM):
  Start: 0x08000000
  End:   0x0800FFFF
  Size:  64 KB

RAM (SRAM):
  Start: 0x20000000
  End:   0x20004FFF
  Size:  20 KB (20,480 bytes)
```

**来源 / Source**: `mcu/chis_flash_burner/STM32F103C8TX_FLASH.ld` (Linker Script)

---

## 内存布局 / Memory Layout

### Linker Script 内存定义 / Linker Script Memory Definition

```c
/* From: STM32F103C8TX_FLASH.ld */

MEMORY
{
  RAM    (xrw)    : ORIGIN = 0x20000000,   LENGTH = 20K
  FLASH  (rx)     : ORIGIN = 0x8000000,    LENGTH = 64K
}

/* Heap and Stack */
_Min_Heap_Size = 0x200;      /* 512 bytes minimum heap */
_Min_Stack_Size = 0x400;     /* 1024 bytes minimum stack */
_estack = 0x20005000;        /* End of RAM */
```

### RAM 区段划分 / RAM Section Layout

```
┌─────────────────────────────────────────────────────────┐
│  0x20000000                                             │
│  ├─ .data section                                       │
│  │   └─ Initialized global/static variables            │
│  │       (copied from FLASH at startup)                 │
│  │                                                       │
│  ├─ .bss section                                        │
│  │   └─ Uninitialized global/static variables          │
│  │       (zeroed at startup)                            │
│  │                                                       │
│  ├─ Heap (grows upward ↑)                               │
│  │   └─ malloc/free allocations                         │
│  │       Minimum: 512 bytes                             │
│  │                                                       │
│  │   ... Available RAM ...                              │
│  │                                                       │
│  │   ↓ Stack (grows downward)                           │
│  └─ Stack                                                │
│      └─ Function calls, local variables                 │
│          Minimum: 1024 bytes                            │
│  0x20005000 (_estack)                                   │
└─────────────────────────────────────────────────────────┘
```

**Memory Layout Details**:
- **Stack**: Starts at 0x20005000 (top of RAM), grows downward
- **Heap**: Starts after `.bss` section, grows upward
- **Gap**: The space between heap and stack is available RAM
- **Protection**: The `_sbrk()` function ensures heap doesn't collide with stack

---

## RAM使用统计 / RAM Usage Statistics

### 总体内存使用 / Overall Memory Usage

| 类别 / Category | 大小 / Size | 百分比 / Percentage | 说明 / Description |
|----------------|------------|-------------------|-------------------|
| **总RAM / Total RAM** | 20,480 bytes | 100% | STM32F103C8T6 总RAM |
| **保留最小堆 / Min Heap** | 512 bytes | 2.5% | 动态内存分配 |
| **保留最小栈 / Min Stack** | 1,024 bytes | 5.0% | 函数调用栈 |
| **已知大型缓冲区 / Known Large Buffers** | ~11,620 bytes | 56.7% | 见下表详细分析 |
| **估计.data + .bss / Estimated .data + .bss** | ~2,000 bytes | 9.8% | 其他全局变量 |
| **估计可用RAM / Estimated Available RAM** | **~5,324 bytes** | **26%** | 可用空间 |

**注意 / Note**: 实际可用RAM需要通过编译生成的 `.map` 文件精确分析。上述是基于代码静态分析的估算。

---

## 主要内存分配 / Major Memory Allocations

### 1. UART 通信缓冲区 / UART Communication Buffers

**文件 / File**: `mcu/chis_flash_burner/Core/Src/uart.c`

```c
// Line 50-53
uint8_t cmdBuf[5500];        // Command buffer: 5,500 bytes
uint8_t responBuf[5500];     // Response buffer: 5,500 bytes
```

**用途 / Purpose**:
- `cmdBuf`: 接收来自主机的命令数据
- `responBuf`: 准备发送给主机的响应数据
- Used for USB CDC communication (virtual COM port)

**内存占用 / Memory Usage**:
- **cmdBuf**: 5,500 bytes
- **responBuf**: 5,500 bytes
- **总计 / Total**: **11,000 bytes (53.7% of total RAM)**

**分析 / Analysis**:
- 这是**最大的单一内存消耗**
- 支持最大5KB的协议数据包
- 必须保留在RAM中以支持快速USB数据传输
- This is the **largest single memory consumer**
- Supports maximum 5KB protocol packets
- Must remain in RAM for fast USB data transfer

---

### 2. CartService RAM Job 结构 / CartService RAM Job Structure

**文件 / File**: `mcu/chis_flash_burner/Core/Src/cart_service.c`

```c
// Lines 82-107
typedef struct {
    CartServiceRamJobState state;      // 4 bytes
    uint32_t bytes_written;            // 4 bytes
    uint32_t total_bytes;              // 4 bytes
    uint32_t expected_size;            // 4 bytes
    char error_message[96];            // 96 bytes
    uint8_t sector_buffer[512];        // 512 bytes (FAT16 sector)
} CartServiceRamJob;

// Line 111
static CartServiceRamJob g_cart_service_ram_job;
```

**内存占用 / Memory Usage**: **620 bytes (3.0% of total RAM)**

**用途 / Purpose**:
- 管理存档文件上传到卡带RAM的流式写入过程
- `sector_buffer`: FAT16扇区暂存缓冲区（512字节）
- `error_message`: 错误信息字符串
- Manages streaming writes of save files to cartridge RAM
- `sector_buffer`: FAT16 sector staging buffer (512 bytes)
- `error_message`: Error message string

**重大改进 / Major Improvement** (2026-03-10):
- **旧版本 / Old version**: 32KB upload buffer (物理不可能 / physically impossible!)
- **新版本 / New version**: 620 bytes (98% 内存减少 / 98% memory reduction)
- **详情见 / Details**: [历史内存问题 / Historical Memory Issues](#历史内存问题--historical-memory-issues)

---

### 3. 系统预留内存 / System Reserved Memory

**文件 / File**: `mcu/chis_flash_burner/STM32F103C8TX_FLASH.ld`

```c
_Min_Heap_Size = 0x200;      // 512 bytes (0.5 KB)
_Min_Stack_Size = 0x400;     // 1024 bytes (1 KB)
```

**内存占用 / Memory Usage**: **1,536 bytes (7.5% of total RAM)**

**用途 / Purpose**:
- **Heap**: 动态内存分配 (`malloc`, `calloc`, `free`)
- **Stack**: 函数调用栈、局部变量、中断上下文保存
- **Heap**: Dynamic memory allocation (`malloc`, `calloc`, `free`)
- **Stack**: Function call stack, local variables, interrupt context saving

**注意 / Note**: 这只是**最小保留值**。实际运行时，栈可能增长到更大。

---

### 4. USB 设备库内部缓冲区 / USB Device Library Internal Buffers

**位置 / Location**: STM32 USB Device Middleware

**估算内存 / Estimated Memory**: ~200-500 bytes

**包含 / Includes**:
- USB endpoint buffers
- USB control transfer buffers
- Device descriptor storage

**注意 / Note**: USB库的确切内存占用需要查看编译后的 `.map` 文件。

---

### 5. 其他全局变量 / Other Global Variables

**估算 / Estimated**: ~2,000 bytes

**包含 / Includes**:
- 外设句柄 / Peripheral handles (UART, USB, GPIO, etc.)
- 配置数据 / Configuration data
- 状态变量 / State variables
- 常量字符串 / Constant strings (in `.rodata`, stored in FLASH)

---

## 可用RAM计算 / Available RAM Calculation

### 详细计算 / Detailed Calculation

```
总RAM / Total RAM:                          20,480 bytes (100%)

已分配 / Allocated:
  - cmdBuf                                   5,500 bytes
  - responBuf                                5,500 bytes
  - g_cart_service_ram_job                     620 bytes
  - Min Heap                                   512 bytes
  - Min Stack                                1,024 bytes
  - USB Library (估算)                         400 bytes
  - 其他全局变量 (估算)                       2,000 bytes
  ─────────────────────────────────────────────────────────
  已用小计 / Subtotal Used:                15,556 bytes (75.9%)

估计可用RAM / Estimated Available RAM:      4,924 bytes (24.1%)
```

### 保守估计 / Conservative Estimate

考虑到未知的中间变量、栈增长和其他开销：

**实际可用RAM / Practical Available RAM**: **约 4,000 - 5,000 bytes (19-24%)**

### 关键观察 / Key Observations

1. **UART缓冲区占主导 / UART Buffers Dominate**:
   - `cmdBuf` + `responBuf` = 11,000 bytes (53.7%)
   - 这是最大的单一内存消耗者

2. **堆栈预留较小 / Stack/Heap Reserve is Small**:
   - 仅1.5KB，对于复杂应用可能不足
   - 实际运行时栈可能增长超过最小值

3. **流式架构关键 / Streaming Architecture Critical**:
   - 旧版32KB缓冲区方案**物理不可能**
   - 新版620字节方案**解决了RAM限制问题**

---

## 内存优化建议 / Memory Optimization Recommendations

### 高优先级 / High Priority

#### 1. 考虑减少UART缓冲区大小 / Consider Reducing UART Buffer Size

**当前 / Current**: 5,500 bytes × 2 = 11,000 bytes

**建议 / Recommendation**:
- 分析实际协议最大包大小
- 如果实际不需要5KB包，可以减小缓冲区
- Analyze actual protocol maximum packet size
- Reduce buffers if 5KB packets are not actually needed

**示例 / Example**:
```c
// 如果协议实际最大4KB / If protocol actually uses max 4KB
uint8_t cmdBuf[4096];        // 减少1,404 bytes
uint8_t responBuf[4096];     // 减少1,404 bytes
// 节省 / Savings: 2,808 bytes (13.7% of total RAM)
```

#### 2. 优化栈使用 / Optimize Stack Usage

**建议 / Recommendations**:
- 避免在函数中声明大型局部数组
- 使用动态分配或全局缓冲区池
- 使用静态分析工具检查最大栈深度
- Avoid large local arrays in functions
- Use dynamic allocation or global buffer pools
- Use static analysis tools to check maximum stack depth

### 中优先级 / Medium Priority

#### 3. 实现缓冲区共享 / Implement Buffer Sharing

**思路 / Idea**:
- `cmdBuf` 和 `responBuf` 不会同时使用
- 考虑使用单个缓冲区 + 状态机管理
- `cmdBuf` and `responBuf` are not used simultaneously
- Consider using a single buffer + state machine management

**示例 / Example**:
```c
uint8_t uartBuffer[5500];    // 共享缓冲区
enum { CMD_MODE, RESPONSE_MODE } bufferMode;
```

**节省 / Savings**: 5,500 bytes (26.8% of total RAM)

#### 4. 使用DMA减少拷贝 / Use DMA to Reduce Copying

- 配置USB使用DMA直接访问缓冲区
- 减少内存拷贝操作
- Configure USB to use DMA for direct buffer access
- Reduce memory copy operations

### 低优先级 / Low Priority

#### 5. 代码优化 / Code Optimization

- 使用 `-Os` 编译优化（减少代码大小，间接减少栈使用）
- 移除未使用的库函数
- Use `-Os` compilation optimization (reduce code size, indirectly reduce stack usage)
- Remove unused library functions

---

## 历史内存问题 / Historical Memory Issues

### 问题: 32KB 上传缓冲区方案 / Issue: 32KB Upload Buffer Approach

**日期 / Date**: 发现于 2026-03-10 / Discovered on 2026-03-10

**问题描述 / Problem Description**:

原设计方案试图分配一个32KB的缓冲区来存储上传的存档文件：

The original design attempted to allocate a 32KB buffer for save file uploads:

```c
// ❌ 旧代码 (物理不可能) / Old code (physically impossible)
#define CART_SERVICE_UPLOAD_BUFFER_SIZE (32u * 1024u)  // 32 KB
uint8_t upload_buffer[CART_SERVICE_UPLOAD_BUFFER_SIZE];
```

**为什么是问题 / Why This Was a Problem**:

```
32 KB 缓冲区需求 / 32 KB buffer requirement = 32,768 bytes
STM32F103C8T6 总RAM / STM32F103C8T6 total RAM = 20,480 bytes

差额 / Deficit: 32,768 - 20,480 = 12,288 bytes (超出60%)
```

**物理不可能 / Physically Impossible**: 无法在20KB RAM中分配32KB缓冲区！

---

### 解决方案: 流式写入架构 / Solution: Streaming Write Architecture

**实施日期 / Implementation Date**: 2026-03-10

**核心思想 / Core Idea**:
- 不在MCU内存中累积完整文件
- 数据以512字节扇区为单位流式处理
- 数据到达后立即写入卡带硬件
- Do not accumulate complete file in MCU memory
- Process data in 512-byte sector streams
- Write directly to cartridge hardware as data arrives

**新架构数据流 / New Architecture Data Flow**:

```
Host OS → USB MSC → FAT16 Write → Sector Buffer (512B)
                                       ↓
                              Cartridge Hardware
                              (SRAM/FRAM/FLASH)
                              1KB chunks
```

**内存使用对比 / Memory Usage Comparison**:

| 方案 / Approach | RAM需求 / RAM Required | 可行性 / Feasibility |
|----------------|---------------------|-------------------|
| 旧方案 / Old | 32,768 bytes | ❌ **不可能** / IMPOSSIBLE |
| 新方案 / New | 620 bytes | ✅ **可行** / FEASIBLE |
| **减少 / Reduction** | **-32,148 bytes** | **98% 内存节省** / 98% savings |

**相关文件 / Related Files**:
- Code: `mcu/chis_flash_burner/Core/Src/cart_service.c` (lines 82-111, 1459-1666)
- Docs: `docs/RAM-UPLOAD-WORKFLOW.md` (complete workflow documentation)

**相关提交 / Related Commits**:
- `0a62939`: fix: replace 32KB buffer with streaming writes to fit in 20KB RAM
- `068bbb8`: docs: update RAM upload workflow to reflect streaming architecture

---

## 内存分析工具 / Memory Analysis Tools

### 1. 编译后分析 / Post-Compilation Analysis

**生成 .map 文件 / Generate .map file**:

```bash
# 在编译时添加 / Add during compilation
arm-none-eabi-gcc ... -Wl,-Map=output.map
```

**分析内容 / Analyze Contents**:
- `.data` section size
- `.bss` section size
- 每个全局变量的地址和大小
- 堆栈使用情况

### 2. 运行时分析 / Runtime Analysis

**实现堆监控函数 / Implement Heap Monitoring Function**:

```c
#include <malloc.h>

extern char _end;        // End of bss (heap start)
extern char _estack;     // End of stack
extern char _Min_Stack_Size;

void print_memory_usage(void)
{
    struct mallinfo mi = mallinfo();
    uint32_t heap_used = mi.uordblks;
    uint32_t heap_free = mi.fordblks;

    uint32_t total_ram = 20480;
    uint32_t stack_reserved = (uint32_t)&_Min_Stack_Size;

    printf("Heap Used: %lu bytes\n", heap_used);
    printf("Heap Free: %lu bytes\n", heap_free);
    printf("Stack Reserved: %lu bytes\n", stack_reserved);
}
```

### 3. 静态分析工具 / Static Analysis Tools

**推荐工具 / Recommended Tools**:
- **arm-none-eabi-size**: 快速查看段大小
- **STM32CubeIDE**: 内置内存分析视图
- **Segger SystemView**: 运行时性能分析
- **FreeRTOS Task Stack Checker**: 如果使用RTOS

**示例命令 / Example Command**:
```bash
arm-none-eabi-size -A your_firmware.elf
```

---

## 结论 / Conclusion

### 当前状态 / Current Status

✅ **RAM使用合理但紧张 / RAM Usage Reasonable but Tight**

- 总RAM: 20,480 bytes
- 已用: ~15,556 bytes (76%)
- 可用: ~4,924 bytes (24%)

### 关键发现 / Key Findings

1. **UART缓冲区是最大消耗者 / UART Buffers are Largest Consumer**
   - 11,000 bytes (53.7% of total RAM)
   - 优化潜力最大 / Greatest optimization potential

2. **流式架构成功解决了RAM限制 / Streaming Architecture Successfully Solved RAM Constraints**
   - 从不可能的32KB → 可行的620字节
   - 关键架构决策 / Critical architectural decision

3. **预留内存较小 / Reserved Memory is Small**
   - 堆+栈仅1.5KB / Heap+Stack only 1.5KB
   - 需要注意避免栈溢出 / Need to avoid stack overflow

### 建议 / Recommendations

**立即行动 / Immediate Actions**:
1. ✅ 流式架构已实现 (已完成 / Already done)
2. 🔍 生成并分析 .map 文件以获得精确数据
3. 📊 实现运行时内存监控

**未来优化 / Future Optimizations**:
1. 考虑减少UART缓冲区大小（如果协议允许）
2. 实现缓冲区共享以节省5.5KB
3. 优化栈使用，避免大型局部数组

---

## 参考文档 / Reference Documents

- [RAM Upload Workflow](./RAM-UPLOAD-WORKFLOW.md) - 流式架构详细说明
- [MCU Virtual FAT16 Disk Design](./mcu-virtual-fat16-disk-design.md) - 虚拟磁盘实现
- [STM32F103C8T6 Datasheet](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf) - 官方芯片手册

---

**文档版本 / Document Version**: 1.0
**最后更新 / Last Updated**: 2026-03-10
**作者 / Author**: beggar_socket development team
