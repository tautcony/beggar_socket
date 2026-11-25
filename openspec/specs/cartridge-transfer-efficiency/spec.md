# cartridge-transfer-efficiency Specification

## Purpose
Defines client-side measures that remove transfer overhead on existing firmware protocols, and the measurements used to judge them.

## Requirements

### Requirement: Skip erased-state program chunks
After a sector has been erased in the current write (initial erase or recovery re-erase), the system SHALL NOT send a program request for a planned chunk whose bytes are all `0xFF`, SHALL count that chunk as completed, and SHALL report the skipped byte total. Verification SHALL still read skipped ranges.

#### Scenario: Padded image sends fewer program requests
- **WHEN** a 6 MiB ROM is written with `size = 8 MiB`
- **THEN** no program request is sent for the trailing 2 MiB of `0xFF`, the write completes at 8 MiB, and the summary reports 2 MiB skipped

#### Scenario: Skipped range is still verified
- **WHEN** a skipped range reads back with a non-`0xFF` byte
- **THEN** verification fails at that address

### Requirement: Firmware-aware ROM read chunk size
Beggar ROM 读取和校验 SHALL 使用所选固件的分块规则、ROM 读页设置和统一分块规划器。标准 STM、STC 和 STM-Boost 的固件读上限分别为 4 KiB、32 KiB 和 8 KiB。实际分块 SHALL 保留各固件的现有宿主限制、对齐和地址范围规则。

旧兼容未知 profile 的 4 KiB 上限 SHALL 只保留在过渡兼容门面中，用于尚未迁移的调用方；新的会话解析 SHALL NOT 产生 unknown 会话，缺少注册定义的设备以 `unsupported` 失败而不是回退到宽松读上限。

#### Scenario: STM profile cap
- **WHEN** 标准 STM 的 `romReadPageSize` 设为 32 KiB
- **THEN** 单次 ROM 读请求至多为 4 KiB

#### Scenario: STC profile larger reads on GBA
- **WHEN** STC 的 `romReadPageSize` 设为 32 KiB 且从对齐的 GBA ROM 地址读取
- **THEN** 读请求为 32 KiB，分块规划器可在 ROM bank 或范围边界收窄请求

#### Scenario: Boost uses shared settings and its own read cap
- **WHEN** 用户用共用 STM 封包设置连接 STM-Boost，且请求或宿主允许大块读取
- **THEN** 读分块沿用 Boost 限幅逻辑且至多为 8 KiB，写分块仍受继承的 STM 写规则限制

#### Scenario: Read and write page sizes are independent
- **WHEN** 用户保存不同的 ROM 读页和写页设置
- **THEN** 读规划使用读页设置，写规划使用写页设置。读页缺省值按该固件现有默认规则初始化

### Requirement: Transfer timing summary
The system SHALL report, for each ROM write, erase time, transfer time, total time, program request count, retry count, and skipped bytes, and for each read/verify, request count and effective throughput computed from bytes in the target range only.

#### Scenario: Replayed bytes excluded from effective throughput
- **WHEN** a sector is replayed once during a write
- **THEN** the retry count is 1 and effective throughput uses the target range size, not target size plus replayed bytes
