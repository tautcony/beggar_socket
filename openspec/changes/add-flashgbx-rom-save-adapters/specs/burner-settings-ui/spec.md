# Spec Delta

## ADDED Requirements

### Requirement: FlashGBX ACK flow control option
当选中 `flashgbx` 时，高级设置 SHALL 提供 ACK 流控开关，并 SHALL 允许 `flashgbx` 封包大小上限至 `0x2000`；5 种语言均包含新增文案。

#### Scenario: Toggle ACK
- **WHEN** 用户开启 ACK 流控并保存
- **THEN** 下次连接时在支持的设备上启用 ACK，不支持的设备忽略并提示

#### Scenario: Packet size upper bound
- **WHEN** 用户为 `flashgbx` 输入 `0x2000`
- **THEN** 校验通过，输入超过 `0x2000` 被拒绝
