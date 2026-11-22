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
已核对 `FlashGBX/FlashGBX/LK_Device.py`（第 2552–2750 行）的完整探测流程：
1. 读取基线 ROM 头（`0x00` 起 8 字节）。
2. 对当前模式（`AGB`/`DMG`）候选 profile 排序：含 `m29w640` 标记的优先（防其他命令误写损坏），跳过无 `command_set` 或 `manual_select === true` 的 profile。
3. **特例早退探测**（按以下顺序）：
   - `m29w640`：`reset` → `read(0, 8)` 基线 → `read_identifier` → `read(0, 8)` ID → 若匹配，`reset` → `read_cfi` → `read(0, 0x400)` → `reset` → 校验 CFI `deviceSize === 0x800000`。
   - `DMG` `BLAZE_XPLODER`：写寄存器 `0x06=1` → `reset` → `read(0x4000, 8)` → `read_identifier` → `read(0x4000, 8)` → `reset`。
   - `DMG` `DATEL_ORBITV2`：`read(read_identifier_at, 10)` → `unlock_read` → `unlock` → `read_identifier` → `read(read_identifier_at, 10)` → `reset`。
   - `DMG` `GBMEMORY`：`read(0, 8)` → `unlock` → `read_identifier` → `read(0, 8)` → `reset`。
   - `DMG` `dmg-mbc5-32m-flash`（需 `audioWePin`）：按 `set_audio_high && fw_ver >= 14` 选择 `WR` + `DMG_AUDIO_ENABLED=1` 或 `AUDIO` WE 引脚，验证 Flash ID 后 `reset`（含 `[[0, 0xFF], [0, 0xF0]]`）并恢复 `WE_PIN=WR` / `DMG_AUDIO_ENABLED=0`。
   - `AGB` `GBAMP`：`read(0x1E8F<<1, 2) + read(0x168F<<1, 2)` → `unlock_read` → `read_identifier` → `read(0x1E8F<<1, 2) + read(0x168F<<1, 2)` → `reset`。
   - `DMG` `BUNG_16M`（需 `audioWePin`）：`WE_PIN=AUDIO`，切 bank 2/1/2 执行 `read_identifier`，在 bank 2 读 `0x00` 4 字节，执行 `reset` 及 `[[0, 0xFF], [0, 0xF0]]` 并恢复 `WE_PIN=WR`。
4. **预复位与命令分组**：收集剩余 profile 的唯一 `reset`/`unlock` 序列并逐一执行；按 `(commands.read_identifier, read_identifier_at ?? 0)` 分组（DMG 跳过首地址 `> 0x7000`），按 `read_identifier[0][0]` 升序排列。
5. **通用分组探测**（若特例未命中）：
   - `DMG` 遍历 `we_pins`：`audioWePin` 为真时 `['WR', 'AUDIO']`，否则 `['WR']`，每次设置 `FLASH_WE_PIN`（1/2）；`AGB` 为 `[null]`。
   - 对每个分组执行：`reset` → `baseline = readRom(addr, len)` → `read_identifier` → `id = readRom(addr, len)` → `finally: reset`。
   - 仅匹配当前 `we_pin` 兼容的 profile（`FlashcartProfileService.matchesObservation`，支持 `flash_id_offsets` 与嵌套 `flash_ids`），最后统一发送 `[[0, 0xFF], [0, 0xF0]]` 复位。
6. **结果处理**：
   - 适配器在 `Auto` 模式下先尝试标准 CFI；若 CFI 缺失或无效，再执行上述 `LK_Device.py` 回退探测。
   - 唯一匹配 → 校验 `voltage` 与 `write_pin` 后合成 `CFIInfo` 并记录日志。
   - 多匹配 → `profile_ambiguous`（`details.candidates` 含候选摘要）。
   - 无匹配 → `profile_not_found`。
   - 手动覆盖（`flashcartProfileId`）：跳过探测，但校验 `voltage` 与 `write_pin`（`AUDIO`/`VIN` 需要 `audioWePin`）。

## Risks / Trade-offs

- Flash ID 冲突：多匹配不自动选择。
- `AUDIO`/`VIN`：能力不足时拒绝（`unsupported`）。
- 错误 profile 可能损坏卡带：手动覆盖前展示 profile 名称与电压/容量摘要。
- `fc_*.txt` 字段众多：白名单加快照测试，防止静默漏字段。

## Verification

转换产物 schema/计数（AGB 59 / DMG 106）/Flash ID 冲突/几何例外快照；`FlashcartProfileService` 单测；适配器 profile 路径单测；`burner-use-case` 透传测试；组件契约与 5 语言 i18n；真机非 CFI 卡带验证。
