# Spec Delta

## Purpose

支持 FlashGBX `fc_AGB_*.txt` / `fc_DMG_*.txt` 烧录卡 profile，用于在 CFI 缺失时自动 Flash ID 匹配，以及手动选择，仅在 FlashGBX 设备上可用。

## ADDED Requirements

### Requirement: Flashcart profile registry
系统 SHALL 打包经构建期脚本转换并校验的 `FlashcartProfile` 注册表（`AGB`、`DMG`），包含 Flash ID（含嵌套集合与 `flash_id_offsets`）、电压、容量、扇区几何、缓冲区大小、写引脚（`WR`/`AUDIO`/`VIN`/`WR+RESET`）、命令序列与 wait-for 规则；数据 SHALL 按类型懒加载。转换 SHALL 在遇到未知字段、非法占位符或几何不一致时失败。

#### Scenario: Query by mode
- **WHEN** UI 或适配器按 `GBA` 或 `MBC5` 请求 profile
- **THEN** 仅返回 `type === 'AGB'` 或 `'DMG'` 的 profile

#### Scenario: Conversion validation
- **WHEN** 运行转换脚本且遇到未知字段、未知占位符或 `wait_for` 结构非法
- **THEN** 脚本失败并指出文件名

#### Scenario: Known geometry exceptions
- **WHEN** 某 profile 的 `sector_size` 总和与 `flash_size` 不一致（如 `fc_AGB_TH50VSF3680.txt`）
- **THEN** 它必须出现在显式例外快照中，否则脚本失败

#### Scenario: FlashGBX-compatible parsing
- **WHEN** 转换含 `0x..` 十六进制的原文件
- **THEN** 解析结果与 FlashGBX 的 hex→dec 再 JSON 解析一致

### Requirement: Profiles only on FlashGBX devices
profile 选择与应用 SHALL 仅在 `capabilities.nativeFlashgbxProtocol` 为真时可用。

#### Scenario: ChisFlash device
- **WHEN** 连接 `stm` 或 `stc`
- **THEN** Chip Operations 不显示 profile 选择器，适配器忽略 profile 选项

### Requirement: Automatic Flash ID matching fallback
在 `Auto` 模式下，当 CFI 缺失或几何不完整时，系统 SHALL 以候选 profile 的 `read_identifier` 匹配 Flash ID，每次探测后执行 `reset` 序列，并合成 `CFIInfo`。

#### Scenario: Unique match
- **WHEN** 无 `"QRY"` 且 Flash ID 唯一匹配
- **THEN** 适配器使用该 profile 合成 `CFIInfo` 并记录名称

#### Scenario: Ambiguous match
- **WHEN** 多个 profile 匹配同一 Flash ID
- **THEN** 适配器返回错误码 `profile_ambiguous` 及结构化候选列表（经 `CommandResult` 结构化载荷，不放入 `data`），`burner-use-case` 原样透传，UI 提示用户手动选择

#### Scenario: No match
- **WHEN** 无任何匹配
- **THEN** 返回 `profile_not_found`，沿用"无法识别卡带"提示

#### Scenario: Probe does not pollute later operations
- **WHEN** Flash ID 探测完成
- **THEN** 已执行 `reset` 序列，后续读写不受影响

### Requirement: Manual profile override
用户 SHALL 能在 `ChipOperations` 选择具体 profile，覆盖 CFI/ID 探测，使用其命令集、扇区布局、缓冲区、电压与写引脚。

#### Scenario: Manual selection
- **WHEN** 用户选择某 profile 并执行读 ID/擦除/写 ROM
- **THEN** 适配器使用其 `read_identifier`、`sector_erase`、`chip_erase`、`buffer_write`/`single_write`、`flash_size` 与扇区布局

#### Scenario: Unsupported write pin
- **WHEN** profile 的 `write_pin` 为 `AUDIO` 或 `VIN` 而设备 `audioWePin` 为 `false`
- **THEN** 系统拒绝写操作并返回明确的 `unsupported` 错误

#### Scenario: Voltage mismatch
- **WHEN** profile 的 `voltage` 与设备可提供的电压不符（如设备无电源控制却需要 5V 切换）
- **THEN** 系统提示并拒绝，而不是静默继续
