# RAM Upload and Commit Workflow User Guide

## 概述 (Overview)

本文档描述 beggar_socket MCU 固件中 RAM 上传和提交的完整工作流程。

This document describes the complete RAM upload and commit workflow in the beggar_socket MCU firmware.

**重要提示 (Important Note)**: 本系统采用**显式提交模型**，即用户必须明确执行提交操作才会将数据写入卡带硬件。这样设计是为了确保数据完整性和操作安全性。

The system uses an **explicit commit model**, meaning users must explicitly execute a commit operation to write data to the cartridge hardware. This design ensures data integrity and operation safety.

---

## 工作流程 (Workflow)

### 标准流程 (Standard Workflow)

用户操作 RAM 数据的标准流程包含以下步骤：

The standard workflow for operating on RAM data includes the following steps:

```
1. 配置 RAM 类型 (Configure RAM Type)
   ↓
2. 应用配置 (Apply Configuration)
   ↓
3. (可选) 擦除 RAM (Optional: Erase RAM)
   ↓
4. 上传数据文件 (Upload Data File)
   ↓
5. 显式提交 (Explicit Commit)
   ↓
6. 查看状态/等待完成 (Check Status / Wait for Completion)
```

---

## 详细步骤说明 (Detailed Steps)

### 步骤 1: 配置 RAM 类型 (Configure RAM Type)

**目的**: 告诉系统您的卡带使用哪种 RAM 类型。

**Purpose**: Tell the system which RAM type your cartridge uses.

**操作方法**:

1. 打开文件 `/RAM/TYPE/SELECT.TXT`
2. 写入以下值之一:
   - `SRAM` - 用于 SRAM 类型存档
   - `FRAM` - 用于 FRAM (Ferroelectric RAM) 类型存档
   - `FLASH` - 用于 Flash Save 类型存档

**示例内容**:
```
SELECTION=FRAM
```

**说明**:
- SRAM: 最常见的 GBA 存档类型，直接写入无需特殊时序
- FRAM: 铁电 RAM，需要在每字节写入之间添加延迟
- FLASH: Flash 存储器，写入前需要擦除

---

### 步骤 2: 应用配置 (Apply Configuration)

**目的**: 将待定配置应用到当前生效的配置。

**Purpose**: Apply pending configuration to the current active configuration.

**操作方法**:

1. 打开文件 `/APPLY.TXT`
2. 写入以下内容:
   ```
   APPLY=1
   ```
   或
   ```
   APPLY=YES
   ```

**说明**:
- 系统采用"待定配置"和"当前配置"分离的设计
- 只有执行 APPLY 操作后，配置才会真正生效
- 这样可以一次修改多个参数，然后统一应用

---

### 步骤 3: (可选) 擦除 RAM (Optional: Erase RAM)

**目的**: 在写入新数据前清空 RAM 内容（主要用于 Flash 类型）。

**Purpose**: Clear RAM contents before writing new data (mainly for Flash type).

**操作方法**:

1. 打开文件 `/RAM/ERASE.TXT`
2. 写入以下内容:
   ```
   ERASE=1
   ```
   或
   ```
   ERASE=YES
   ```

**说明**:
- Flash 类型的存储器在写入前必须先擦除
- SRAM 和 FRAM 类型可以跳过此步骤
- 擦除操作会重置上传任务状态

---

### 步骤 4: 上传数据文件 (Upload Data File)

**目的**: 将存档文件数据复制到上传缓冲区。

**Purpose**: Stream save file data directly to cartridge RAM.

**操作方法**:

1. 将您的存档文件（`.sav` 文件）复制到 `/RAM/UPLOAD.SAV`
2. 可以使用任何文件管理器进行复制操作
3. 操作系统会将文件内容写入设备

**技术细节** (更新于 2026-03-10):
- **CRITICAL CHANGE**: 由于 STM32F103C8T6 只有 20KB RAM，无法分配 32KB 缓冲区
- **新流式架构**: 数据直接从 FAT16 写入流向卡带硬件，无需大缓冲区
- Sector buffer: **512 字节** (1个 FAT16 扇区) 用于暂存
- 数据**立即写入卡带硬件**，不在 MCU 内存中累积
- 写入以 1KB 块进行，确保硬件稳定性
- **重要**: 数据实时写入，不等待 COMMIT 命令

**状态转换** (流式模式):
- 初始状态: `IDLE`
- 开始接收数据后: **`COMMITTING`** (直接进入写入状态)
- `bytes_written` 字段实时更新已写入字节数

**Memory Efficiency**:
- Old approach: 32KB buffer (impossible on 20KB RAM!)
- New approach: 512 bytes sector buffer (98% reduction)

---

### 步骤 5: 显式提交 (Explicit Commit)

**目的**: 完成流式写入并验证数据完整性。

**Purpose**: Finalize streaming write and verify data integrity.

**操作方法**:

1. 打开文件 `/RAM/COMMIT.TXT`
2. 写入以下内容:
   ```
   COMMIT=1
   ```
   或
   ```
   COMMIT=YES
   ```
   或
   ```
   COMMIT=TRUE
   ```

**关键过程** (流式模式更新):

提交命令触发后，系统会执行以下步骤：

1. **验证状态**: 确认当前处于 `COMMITTING` 状态 (流式写入已完成)
2. **转换到 VERIFYING**: 开始验证流程
3. **读回验证** (流式模式新方法):
   - 由于数据已在卡带上，无需再次写入
   - 从卡带读回数据进行完整性检查
   - 验证策略: 检查数据不全为 0xFF (擦除状态) 或 0x00 (写入失败)
   - 至少 5% 字节应有数据变化
4. **完成**:
   - 验证通过 → 状态变为 `SUCCESS`
   - 验证失败 → 状态变为 `ERROR`

**流式写入 vs 缓冲写入对比**:

| 方面 | 旧方式 (缓冲) | 新方式 (流式) |
|------|---------------|---------------|
| 内存使用 | 32KB buffer | 512 bytes buffer |
| 写入时机 | COMMIT 触发 | 数据到达即写 |
| 验证方法 | 字节比对 | 完整性检查 |
| MCU RAM需求 | 不可行 (超过20KB) | 可行 (~620 bytes) |

---

### 步骤 6: 查看状态/等待完成 (Check Status / Wait for Completion)

**目的**: 监控操作进度和结果。

**Purpose**: Monitor operation progress and result.

**操作方法**:

1. 打开并读取文件 `/RAM/STATUS.TXT`
2. 查看当前状态信息

**状态文件格式**:

```
STATE=<状态>
RAM_TYPE=<RAM类型>
BYTES_WRITTEN=<已写入字节数>
TOTAL_BYTES=<总字节数>
ERROR=<错误信息>
```

**状态值说明** (流式模式更新):

| 状态 | 含义 | 说明 |
|------|------|------|
| `IDLE` | 空闲 | 初始状态，等待上传 |
| `COMMITTING` | 提交中 | 正在写入卡带硬件（**流式模式**：数据到达即写入） |
| `VERIFYING` | 验证中 | 正在验证写入的数据（**流式模式**：完整性检查） |
| `SUCCESS` | 成功 | 操作成功完成 |
| `ERROR` | 错误 | 操作失败 |

**注意**：流式模式下，不再有单独的 `UPLOADING` 状态。数据到达后立即进入 `COMMITTING` 状态并写入硬件。

**错误代码**:

| 错误代码 | 含义 | 解决方法 |
|---------|------|---------|
| `INVALID_STATE` | 无效状态 | 确保在 COMMITTING 状态下才执行 COMMIT |
| `WRITE_FAILED` | 写入失败 | 检查卡带连接，确认 RAM 类型正确 |
| `VERIFY_FAILED` | 验证失败 | 数据完整性检查失败，可能是卡带故障或数据全为 0xFF/0x00 |

---

## 为什么采用显式提交模型？ (Why Explicit Commit Model?)

### 技术原因 (Technical Reasons)

1. **FAT16 写入顺序问题**:
   - 操作系统写入文件时，FAT 元数据和数据区写入顺序是不确定的
   - MCU 无法可靠判断"整个文件已传输完成"
   - 如果过早开始烧录，会导致数据不完整

2. **主机缓存问题**:
   - 文件可能还在操作系统的缓存中
   - MCU 接收到的可能不是完整数据
   - 强制刷新缓存的时机难以确定

3. **硬件安全**:
   - 误判可能导致卡带数据损坏
   - 显式提交让用户明确控制写入时机
   - 可以在提交前检查状态文件确认数据已完全上传

### 用户体验优势 (User Experience Benefits)

1. **操作透明**: 用户清楚知道何时会真正写入硬件
2. **可预测性**: 不会出现"文件复制到一半就开始烧录"的情况
3. **可控性**: 用户可以在提交前中止操作
4. **安全性**: 减少意外损坏卡带的风险

---

## 完整示例 (Complete Example)

### 示例: 写入 FRAM 类型存档 (Example: Writing FRAM Save)

假设您有一个 8KB 的存档文件 `pokemon.sav`，卡带使用 FRAM 类型存储：

Assuming you have an 8KB save file `pokemon.sav`, and the cartridge uses FRAM storage:

```bash
# 1. 配置 RAM 类型为 FRAM
echo "SELECTION=FRAM" > /RAM/TYPE/SELECT.TXT

# 2. 应用配置
echo "APPLY=1" > /APPLY.TXT

# 3. 上传存档文件（流式写入：数据立即写入卡带）
cp pokemon.sav /RAM/UPLOAD.SAV

# 4. 查看状态（可选，确认数据已写入）
cat /RAM/STATUS.TXT
# 输出应显示: STATE=COMMITTING, BYTES_WRITTEN=8192
# 注意：流式模式下，数据已实时写入硬件

# 5. 提交验证（触发完整性检查）
echo "COMMIT=1" > /RAM/COMMIT.TXT

# 6. 等待并查看结果
while true; do
    cat /RAM/STATUS.TXT | grep "STATE="
    sleep 1
done
# 等待状态变为 SUCCESS
```

---

## 技术实现细节 (Technical Implementation Details)

### 流式写入架构 (Streaming Write Architecture)

**为什么采用流式写入？(Why Streaming Writes?)**

2026-03-10 架构更新的核心原因：

1. **硬件限制 (Hardware Constraint)**:
   - STM32F103C8T6 总 RAM: **20KB** (0x20000000-0x20005000)
   - 旧方案需求: 32KB 上传缓冲区
   - **物理不可能**: 缓冲区超过总 RAM 12.3KB！

2. **流式解决方案 (Streaming Solution)**:
   - FAT16 扇区缓冲: 512 字节
   - 状态结构: ~108 字节
   - 总计: **~620 字节** (98% 内存减少)

3. **数据流向 (Data Flow)**:
   ```
   Host OS → USB MSC → FAT16 Write → Sector Buffer (512B)
                                         ↓
                                    Cartridge Hardware
                                    (SRAM/FRAM/FLASH)
   ```

**架构对比 (Architecture Comparison)**:

| 方面 | 旧架构 (缓冲) | 新架构 (流式) |
|------|---------------|---------------|
| **内存占用** | 32KB 缓冲区 | 512B 扇区缓冲 |
| **可行性** | ❌ 不可能 (超20KB) | ✅ 可行 (~620B) |
| **写入时机** | COMMIT 触发批量写入 | 数据到达实时写入 |
| **写入速度** | 一次性写入 32KB | 流式写入，1KB 块 |
| **状态转换** | IDLE→UPLOADING→COMMITTING | IDLE→COMMITTING (直接) |
| **验证方法** | 字节对比 (有源数据) | 完整性检查 (无源数据) |
| **中断恢复** | 可重来 (数据在缓冲) | 不可逆 (已写硬件) |

**流式写入实现细节**:

```c
// cart_service.c 中的核心实现

// 1. 精简的状态结构 (仅 ~620 字节)
typedef struct {
    CartServiceRamJobState state;
    uint32_t bytes_written;      // 实时跟踪已写入字节
    uint32_t total_bytes;         // 最终大小
    uint32_t expected_size;       // 预期大小
    char error_message[96];
    uint8_t sector_buffer[512];   // FAT16 扇区暂存
} CartServiceRamJob;

// 2. 写入函数：数据到达即写入卡带
bool cart_service_write_save(uint32_t offset, const uint8_t *buf, uint32_t len)
{
    // 状态：IDLE → COMMITTING (首次写入)
    if (g_cart_service_ram_job.state == CART_SERVICE_RAM_JOB_STATE_IDLE) {
        g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_COMMITTING;
    }

    // 分 1KB 块写入硬件 (稳定性)
    while (chunk_offset < len) {
        chunk_size = min(len - chunk_offset, 1024);

        // 直接写入卡带硬件
        switch (ram_type) {
            case SRAM:  cart_service_write_save_sram(...);
            case FRAM:  cart_service_write_save_fram(...);
            case FLASH: cart_service_write_save_flash(...);
        }

        bytes_written += chunk_size;  // 实时更新进度
    }
}

// 3. COMMIT 函数：仅验证，不再写入
bool cart_service_commit_ram_upload(void)
{
    // 数据已在卡带上，只做完整性检查
    g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_VERIFYING;

    // 读回验证：检查不全为 0xFF 或 0x00
    if (!cart_service_verify_save_streaming(bytes_written)) {
        state = ERROR;
        return false;
    }

    state = SUCCESS;
}
```

### 1KB 分块写入 (1KB Chunked Writes)

为什么以 1KB 为单位分块写入？

**Why write in 1KB chunks?**

1. **内存限制**: STM32F103C8 MCU 的 RAM 资源有限
2. **硬件稳定性**: 较小的分块可以提高超时恢复能力
3. **进度跟踪**: 可以更细粒度地报告进度
4. **类型适配**: FRAM 需要逐字节延迟，分块可以增量应用

**实现代码片段**:

```c
#define CART_SERVICE_RAM_WRITE_CHUNK_SIZE 1024u

offset = 0u;
while (offset < write_size) {
    chunk_size = write_size - offset;
    if (chunk_size > CART_SERVICE_RAM_WRITE_CHUNK_SIZE) {
        chunk_size = CART_SERVICE_RAM_WRITE_CHUNK_SIZE;
    }

    // 根据 RAM 类型选择写入函数
    switch (ram_type) {
        case SRAM:  cart_service_write_save_sram(offset, buffer, chunk_size);
        case FRAM:  cart_service_write_save_fram(offset, buffer, chunk_size);
        case FLASH: cart_service_write_save_flash(offset, buffer, chunk_size);
    }

    offset += chunk_size;
}
```

### 状态机 (State Machine) - 流式模式

```
     ┌─────────────────────────────────────────┐
     │                                         │
     ▼                                         │
  [IDLE] ──写入 UPLOAD.SAV──> [COMMITTING]    │
     │                    (数据实时写入卡带)   │
     │                            │            │
     │                            │            │
     │                写入 COMMIT.TXT           │
     │                            │            │
     │                            ▼            │
     │                    [VERIFYING] ─────────┤
     │                    (完整性检查)         │
     │                            │            │
     │                 验证成功   │   验证失败 │
     │                            ▼            │
     └──── 写入 ──────────> [SUCCESS]          │
       ERASE.TXT                               │
                                               │
                         [ERROR] <─────────────┘
```

**流式模式关键变化**:
- 写入 UPLOAD.SAV 后立即进入 `COMMITTING` 状态（不再有 UPLOADING 状态）
- 数据在复制过程中实时写入卡带硬件
- COMMIT 命令仅触发验证流程，不再执行写入
- ERASE 命令可从任意状态返回 IDLE（重置状态机）

---

## 常见问题 (FAQ)

### Q1: 为什么不能像普通 U 盘一样直接复制文件？

**A**: 因为 FAT16 文件系统的写入是异步和乱序的。操作系统可能先写目录项，后写数据，也可能数据还在缓存中。MCU 无法准确判断"文件传输完成"的时机。**流式架构**虽然数据实时写入，但仍需要显式 COMMIT 来触发完整性验证，确保数据传输完整可靠。

### Q2: 如果忘记执行 COMMIT 会怎样？

**A** (流式模式更新): 数据已经实时写入到卡带硬件，但未经过完整性验证。状态会保持在 `COMMITTING`。建议始终执行 COMMIT 以确保数据完整性。如果断电或重置，已写入的数据会保留在卡带上。

### Q3: COMMIT 失败怎么办？

**A**:
1. 查看 `/RAM/STATUS.TXT` 中的 `ERROR` 字段了解失败原因
2. 如果是 `INVALID_STATE`，确保先上传了数据
3. 如果是 `WRITE_FAILED`，检查卡带连接和 RAM 类型配置
4. 如果是 `VERIFY_FAILED`，可能是卡带硬件故障或数据全为擦除状态 (0xFF) / 写入失败 (0x00)
5. 可以写入 `/RAM/ERASE.TXT` 重置状态后重试

### Q4: 可以中途取消吗？

**A** (流式模式更新): **警告**：由于流式架构数据实时写入卡带，一旦开始复制文件就无法安全取消。建议复制前仔细确认文件和配置。可以使用 `/RAM/ERASE.TXT` 重置状态机，但已写入卡带的数据无法撤销。

### Q5: 有没有内存限制？

**A** (流式模式更新): **流式架构已解决内存限制问题**！
- **旧架构**: 32KB 缓冲区，无法在 STM32F103C8T6 (20KB RAM) 上实现
- **新架构**: 仅需 512 字节扇区缓冲区 + ~108 字节状态结构 ≈ 620 字节
- **理论上限**: 支持任意大小的存档文件（受限于卡带硬件，通常 32KB）
- **内存效率**: 98% 内存减少，从不可能变为可行

### Q6: 为什么即使文件小也要按 1KB 分块？

**A**: 这是硬件稳定性和兼容性要求。即使只有 1KB 的数据，也会作为一个完整的 1KB 块来处理。这确保了对所有 RAM 类型的一致行为。

---

## 开发者参考 (Developer Reference)

### 关键文件位置 (Key File Locations)

- **状态机实现**: `mcu/chis_flash_burner/Core/Src/cart_service.c`
  - `cart_service_write_save()`: 数据累积 (lines 1415-1441)
  - `cart_service_commit_ram_upload()`: 提交流程 (lines 1506-1575)
  - `cart_service_verify_save()`: 验证流程 (lines 1457-1486)

- **FAT16 接口**: `mcu/chis_flash_burner/Core/Src/virtual_disk.c`
  - `write_data_sector()`: 处理文件写入 (lines 326-362)
  - `write_text_view()`: 处理命令文件 (lines 304-324)

- **类型定义**: `mcu/chis_flash_burner/Core/Inc/cart_service.h`
  - `CartServiceRamJobState`: 状态枚举 (lines 21-28)
  - `CartServiceRamType`: RAM 类型枚举 (lines 15-19)

### 常量定义 (Constants) - 流式模式更新

```c
// 流式架构后的内存占用
#define FAT16_SECTOR_SIZE 512u                                   // 512 字节扇区缓冲
#define CART_SERVICE_SAVE_SIZE_BYTES (32u * 1024u)               // 32KB (卡带最大容量)
#define CART_SERVICE_RAM_WRITE_CHUNK_SIZE 1024u                  // 1KB 写入块

// 实际内存占用：
// - sector_buffer[512]     : 512 字节
// - 状态结构其他字段        : ~108 字节
// - 总计                   : ~620 字节 (相比旧版 32KB 减少 98%)
```

**重要变化**:
- ❌ 移除 `CART_SERVICE_UPLOAD_BUFFER_SIZE` (32KB 缓冲区)
- ✅ 新增 `FAT16_SECTOR_SIZE` (512B 扇区缓冲)
- ✅ 总内存需求：从 32KB → 620 字节

---

## 更新日志 (Changelog)

### 2026-03-10 (v2.0 - 流式架构重大更新)

**重大架构变更 (Breaking Changes)**:
- 🔥 **流式写入架构**: 移除 32KB 上传缓冲区，改为 512B 扇区实时流式写入
- 🔥 **内存占用**: 从 32KB (物理不可能) → 620 字节 (98% 减少)
- 🔥 **状态机简化**: 移除 UPLOADING 状态，数据到达即进入 COMMITTING

**核心改进**:
- ✅ 解决 STM32F103C8T6 RAM 限制问题 (20KB 总 RAM)
- ✅ 实现数据从 FAT16 到卡带的零拷贝流式传输
- ✅ 1KB 分块写入机制确保硬件稳定性
- ✅ 类型特定的写入处理 (SRAM/FRAM/FLASH)
- ✅ 新的流式验证策略（完整性检查，而非字节对比）

**代码变更**:
- `cart_service.c`:
  - 重写 `CartServiceRamJob` 结构体（移除 32KB buffer）
  - 重写 `cart_service_write_save()` 为流式写入
  - 简化 `cart_service_commit_ram_upload()` 为验证专用
  - 新增 `cart_service_verify_save_streaming()` 完整性检查

**文档更新**:
- 更新 RAM-UPLOAD-WORKFLOW.md 全文档反映流式架构
- 更新所有状态机图、示例代码、FAQ
- 添加流式架构对比表和技术实现细节

### 2026-03-10 (v1.0 - 初始版本)
- 实现显式提交模型的文档化
- 添加完整的状态机支持
- 添加自动回读验证（旧架构）

### 未来计划 (Future Plans)
- ROM 上传和烧录功能 (`/ROM/UPLOAD.GBA`)
- ~~大文件流式写入支持~~ ✅ **已完成** (v2.0)
- 进度百分比显示（当前为字节数）
- 断点续传支持（流式架构下较难实现）
- CRC/Checksum 验证（替代当前的完整性检查）

---

## 相关文档 (Related Documentation)

- [MCU Virtual FAT16 Disk Design](./mcu-virtual-fat16-disk-design.md) - 完整的 FAT16 虚拟磁盘设计文档
- [MCU Firmware Wiki](./mcu-firmware-wiki.md) - 固件架构概览
- [Main README](../README.md) - 项目总览和协议说明

---

**Document Version**: 2.0 (Streaming Architecture)
**Last Updated**: 2026-03-10
**Author**: beggar_socket development team
**Major Changes**: Complete architectural overhaul to streaming writes, resolving STM32F103C8T6 RAM constraints
