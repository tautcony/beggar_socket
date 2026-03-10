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

**Purpose**: Copy save file data to the upload buffer.

**操作方法**:

1. 将您的存档文件（`.sav` 文件）复制到 `/RAM/UPLOAD.SAV`
2. 可以使用任何文件管理器进行复制操作
3. 操作系统会将文件内容写入设备

**技术细节**:
- 上传缓冲区大小: **32KB** (0x8000 字节)
- 系统会累积接收到的数据，记录 `bytes_written` 计数
- 数据在此阶段**仅存储在 MCU 的内存缓冲区中**
- **重要**: 此时数据尚未写入卡带硬件

**状态转换**:
- 初始状态: `IDLE`
- 开始接收数据后: `UPLOADING`
- `bytes_written` 字段会随着数据接收递增

---

### 步骤 5: 显式提交 (Explicit Commit)

**目的**: 触发将上传的数据实际写入卡带 RAM 的操作。

**Purpose**: Trigger the actual write of uploaded data to the cartridge RAM.

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

**关键过程**:

提交命令触发后，系统会执行以下步骤：

1. **验证状态**: 确认当前处于 `UPLOADING` 状态
2. **转换到 COMMITTING**: 开始写入流程
3. **分块写入**: 以 **1KB (1024字节)** 为单位将数据写入卡带
   - 即使文件很小，也会按 1KB 分块处理
   - 这确保了硬件兼容性和稳定性
4. **类型特定处理**:
   - **SRAM**: 直接批量写入
   - **FRAM**: 逐字节写入，每字节之间添加延迟周期
   - **FLASH**: 逐字节写入，带内存屏障
5. **转换到 VERIFYING**: 写入完成后开始验证
6. **回读验证**: 从卡带读回数据，与上传的数据逐字节比对
7. **完成**:
   - 验证通过 → 状态变为 `SUCCESS`
   - 验证失败 → 状态变为 `ERROR`

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

**状态值说明**:

| 状态 | 含义 | 说明 |
|------|------|------|
| `IDLE` | 空闲 | 初始状态，等待上传 |
| `UPLOADING` | 上传中 | 正在接收数据 |
| `COMMITTING` | 提交中 | 正在写入卡带硬件 |
| `VERIFYING` | 验证中 | 正在验证写入的数据 |
| `SUCCESS` | 成功 | 操作成功完成 |
| `ERROR` | 错误 | 操作失败 |

**错误代码**:

| 错误代码 | 含义 | 解决方法 |
|---------|------|---------|
| `INVALID_STATE` | 无效状态 | 确保在 UPLOADING 状态下才执行 COMMIT |
| `WRITE_FAILED` | 写入失败 | 检查卡带连接，确认 RAM 类型正确 |
| `VERIFY_FAILED` | 验证失败 | 数据读回不匹配，可能是卡带故障 |

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

# 3. 上传存档文件
cp pokemon.sav /RAM/UPLOAD.SAV

# 4. 查看状态（可选，确认数据已上传）
cat /RAM/STATUS.TXT
# 输出应显示: STATE=UPLOADING, BYTES_WRITTEN=8192

# 5. 提交写入
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

### 状态机 (State Machine)

```
     ┌─────────────────────────────────────────┐
     │                                         │
     ▼                                         │
  [IDLE] ──写入 UPLOAD.SAV──> [UPLOADING]     │
     │                            │            │
     │                            │            │
     └──────────┐                 │            │
                │                 │            │
                │   写入 COMMIT.TXT│           │
                │                 ▼            │
                │         [COMMITTING] ────────┤
                │                 │            │
                │      写入完成   │            │
                │                 ▼            │
     写入       │         [VERIFYING] ─────────┤
   ERASE.TXT    │                 │            │
                │      验证成功   │   验证失败 │
                │                 ▼            │
                └────────> [SUCCESS]           │
                                               │
                                               │
                         [ERROR] <─────────────┘
```

---

## 常见问题 (FAQ)

### Q1: 为什么不能像普通 U 盘一样直接复制文件？

**A**: 因为 FAT16 文件系统的写入是异步和乱序的。操作系统可能先写目录项，后写数据，也可能数据还在缓存中。MCU 无法准确判断"文件传输完成"的时机。显式提交模型确保只有在用户确认数据完整后才开始写入硬件。

### Q2: 如果忘记执行 COMMIT 会怎样？

**A**: 数据只会停留在 MCU 的内存缓冲区中，不会写入卡带。断电或重置后数据会丢失。状态会保持在 `UPLOADING`。

### Q3: COMMIT 失败怎么办？

**A**:
1. 查看 `/RAM/STATUS.TXT` 中的 `ERROR` 字段了解失败原因
2. 如果是 `INVALID_STATE`，确保先上传了数据
3. 如果是 `WRITE_FAILED`，检查卡带连接和 RAM 类型配置
4. 如果是 `VERIFY_FAILED`，可能是卡带硬件故障
5. 可以写入 `/RAM/ERASE.TXT` 重置状态后重试

### Q4: 可以中途取消吗？

**A**: 在 `UPLOADING` 状态时可以写入 `/RAM/ERASE.TXT` 来重置。一旦进入 `COMMITTING` 状态，操作无法中止。

### Q5: 32KB 缓冲区满了怎么办？

**A**: 当前实现限制为 32KB。如果需要写入更大的存档，需要分多次操作或等待固件更新支持流式写入。

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

### 常量定义 (Constants)

```c
#define CART_SERVICE_SAVE_SIZE_BYTES (32u * 1024u)          // 32KB
#define CART_SERVICE_UPLOAD_BUFFER_SIZE CART_SERVICE_SAVE_SIZE_BYTES
#define CART_SERVICE_RAM_WRITE_CHUNK_SIZE 1024u             // 1KB
```

---

## 更新日志 (Changelog)

### 2026-03-10
- 实现 1KB 分块写入机制
- 添加完整的状态机支持
- 实现类型特定的写入处理 (SRAM/FRAM/FLASH)
- 添加自动回读验证

### 未来计划 (Future Plans)
- ROM 上传和烧录功能 (`/ROM/UPLOAD.GBA`)
- 大文件流式写入支持
- 进度百分比显示
- 断点续传支持

---

## 相关文档 (Related Documentation)

- [MCU Virtual FAT16 Disk Design](./mcu-virtual-fat16-disk-design.md) - 完整的 FAT16 虚拟磁盘设计文档
- [MCU Firmware Wiki](./mcu-firmware-wiki.md) - 固件架构概览
- [Main README](../README.md) - 项目总览和协议说明

---

**Document Version**: 1.0
**Last Updated**: 2026-03-10
**Author**: beggar_socket development team
