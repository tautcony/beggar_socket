# Spec Delta

## ADDED Requirements

### Requirement: FlashGBX packet size upper bound
高级设置 SHALL 允许 `flashgbx` 封包大小上限至 `0x2000`。

#### Scenario: Packet size upper bound
- **WHEN** 用户为 `flashgbx` 输入 `0x2000`
- **THEN** 校验通过，输入超过 `0x2000` 被拒绝
