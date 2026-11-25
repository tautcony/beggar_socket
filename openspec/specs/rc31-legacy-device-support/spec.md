# rc31-legacy-device-support Specification

## Purpose
Defines how RC31 devices are discovered and driven through the existing legacy protocol.

## Requirements

### Requirement: RC31 legacy discovery
系统 SHALL 将 `0483:5740` 纳入 Beggar 手动候选端口列表，并仅在碳酸丐 variant 下将其判定为 match。选择丐中丐或 GBFlash 时同一端口为 mismatch，只出现在手动列表中且不参与自动发现。连接 SHALL 使用高级设置中的选项。选择碳酸丐时，RC31 SHALL 使用现有 Beggar 命令集。

#### Scenario: RC31 port is selectable and uses STC profile
- **WHEN** 设置选择碳酸丐并打开 `0483:5740` 串口
- **THEN** 串口匹配记录为成功，连接使用 STC 配置和现有 Beggar 命令

#### Scenario: Existing devices unchanged
- **WHEN** 列出 `0483:0721` 串口
- **THEN** 该端口仍可作为 Beggar 候选，描述信息和路径可用于匹配日志

#### Scenario: RC31 port with STM configuration
- **WHEN** 设置选择丐中丐并手动选择 `0483:5740` 串口
- **THEN** 系统记录不匹配，并按丐中丐选项连接

### Requirement: Legacy frame lengths compatible with RC31 first-byte dispatch
Legacy frames produced by ROM and RAM transfer planning SHALL have a frame-length low byte that is neither `>= 0xA0` nor `0x55`, which the unified chunk planner guarantees by using power-of-two chunk sizes of at least 64 bytes.

#### Scenario: Normalized page sizes produce safe F4 frames
- **WHEN** F4 frames are built for each normalized page size from 64 B to 4 KiB
- **THEN** every frame-length low byte is outside `>= 0xA0` and `0x55`
