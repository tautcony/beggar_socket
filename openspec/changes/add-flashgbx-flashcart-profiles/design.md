# Design: FlashGBX Flashcart Profiles

## Context

参考：`Flashcart.py`、`config/fc_*.txt`、`FlashGBX.py` 的加载逻辑、`LK_Device.py` 中使用 profile 的流程。已提交 `web-client`：`CommandResult.data` 为 `Uint8Array`；`getCartInfo` 端口无 `CommandOptions`；`burner-use-case` 会吞掉未知错误；`ChipOperations.vue` 位于 `components/operaiton/` 且被 `check-architecture-deps.cjs` 禁止导入 `platform/`/`services/`/`features/burner/application/`。

## Goals / Non-Goals

**Goals**：profile 注册表、Auto 回退、手动覆盖、选择器。

**Non-Goals**：`stm`/`stc` 支持 profile（需先分析 ChisFlash 命令可表达范围，另起 change）；运行时解析 `.txt`；用户自定义 profile 导入。

## Decisions

### Decision 1：profile 仅限 `flashgbx` 设备
profile 的 `commands`（任意 `[addr, data]` 序列与占位符）、`write_pin`、`buffer_write` 依赖 FlashGBX 的 `SET_FLASH_CMD`/`FLASH_PROGRAM`/`CART_WRITE_FLASH_CMD` 原语，ChisFlash 无等价能力。选择器仅在 `capabilities.nativeFlashgbxProtocol` 为真时显示。`GBAAdapter`/`MBC5Adapter` 不改。

### Decision 2：转换脚本复刻 FlashGBX 解析
- 先 `re.sub("(0x[0-9A-F]+)", hex→dec)` 再 JSON 解析（`FlashGBX.py` 加载逻辑），因此原文件不是标准 JSON。
- 字段以 165 个文件的实际扫描为准（统计显示：`voltage`/`type`/`names`/`commands`/`command_set` 全有；常见 `flash_ids`、`flash_size`、`sector_size`、`sector_size_from_cfi`、`write_pin`、`buffer_write`、`reset_every`、`voltage_variants`、`flash_id_offsets`、`unlock`、`read_status_register`、`status_register_mask/value`、`flash_bank_size`、`flash_bank_select_type`、`read_identifier_at`、`set_irq_high`、`set_audio_high`、`audio_gates_flash_write`、`rumble`、`rtc`、`manual_select`、`fast_write`、`enable_pullups`、`enable_pullup_wr`、`double_die`、`bank_switch`、`start_addr`、`first_bank`、`mbc` 等）；脚本遇到未知字段即失败，由人确认后加入白名单。
- 字段名：`flash_id_offsets`（非 `flash_ids_offsets`）；`flash_ids` 可能嵌套（`Flashcart.py` 的 `GetFlashIDSets`）。
- `sector_size`：`int`、`[size,count][]` 或省略（配合 `sector_size_from_cfi`）。
- 命令占位符：`SA`、`PA`、`PD`、`BS`，以及 `SA+2`、`SA+0x84` 等带偏移形式、`ID`、`WR`（以实际扫描为准）；`*_wait_for` 为三元组。
- **几何校验不能要求扇区总和等于 `flash_size`**：例如 `fc_AGB_TH50VSF3680.txt` 的 `sector_size` 合计 `0x1000000` 而 `flash_size` 为 `0x800000`（双区/双 die 描述）。改为：校验结构合法并生成已知例外快照；例外须在转换产物里显式标注。
- 体积：AGB/DMG 拆为两个动态 `import()` chunk。

### Decision 3：端口与结果契约扩展
- `getCartInfo`（domain port）增加 `CommandOptions` 参数（含 `flashcartProfile?`）。
- `CommandResult` 增加结构化载荷字段（如 `details?: unknown`），用于 `profile_ambiguous` 的候选列表；`CommandResult.data` 仍为 `Uint8Array`，不复用。
- `burner-use-case` 对 `profile_ambiguous`/`profile_not_found` 原样透传并映射为 UI 提示，不吞掉。
- `ChipOperations.vue` 只通过 `contracts.ts`（props/events）接收候选与发出选择，不导入 `services/`。

### Decision 4：Auto 回退的探测顺序
以 `LK_Device.py` 的实现为准（实现前核对其 profile 加载与 `ReadID`/CFI 段落，约 2558–2745 行）：先用候选 profile 的 `read_identifier` 读 Flash ID，再读 CFI；不是「仅在无 `QRY` 时才探测」。每次探测后必须执行 profile 的 `reset` 序列，避免污染后续流程；`read_identifier_at`、`flash_id_offsets`、`voltage_variants` 须被考虑。
- 唯一匹配 → 合成 `CFIInfo` 并记录日志。
- 多匹配 → `profile_ambiguous`（含候选）。
- 无匹配 → `profile_not_found`。
- 手动覆盖：跳过探测，但校验 `voltage` 与 `write_pin`（`AUDIO`/`VIN` 需要 `audioWePin`）。

## Risks / Trade-offs

- Flash ID 冲突：多匹配不自动选择。
- `AUDIO`/`VIN`：能力不足时拒绝（`unsupported`）。
- 错误 profile 可能损坏卡带：手动覆盖前展示 profile 名称与电压/容量摘要。
- `fc_*.txt` 字段众多：白名单加快照测试，防止静默漏字段。

## Verification

转换产物 schema/计数（AGB 59 / DMG 106）/Flash ID 冲突/几何例外快照；`FlashcartProfileService` 单测；适配器 profile 路径单测；`burner-use-case` 透传测试；组件契约与 5 语言 i18n；真机非 CFI 卡带验证。
