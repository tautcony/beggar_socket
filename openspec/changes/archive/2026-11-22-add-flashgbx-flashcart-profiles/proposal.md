# Proposal: FlashGBX Flashcart Profiles (Step 3/3)

> 基线：以已提交的 `web-client`（HEAD）与 `FlashGBX/FlashGBX/` 为唯一依据，FlashGBX 相关代码一律从零新增。FlashGBX 与 web-client 均为 GPL-3.0，移植代码与 `fc_*.txt` 数据时保留原版权/许可证声明。
> 系列顺序：`add-flashgbx-device-connection`（1/3）→ `add-flashgbx-rom-save-adapters`（2/3）→ `add-flashgbx-flashcart-profiles`（3/3）。
> **前置：`add-flashgbx-rom-save-adapters` 已合入并归档**（依赖 FlashGBX 适配器与命令原语）。

## Why

没有有效 CFI、或需要自定义解锁/写入序列与写引脚的卡带，仅靠 CFI 无法处理。引入 `fc_*.txt` profile 体系覆盖这些卡带。

## What Changes

- 构建期脚本把 `fc_AGB_*.txt`（59）与 `fc_DMG_*.txt`（106）转换为带类型/校验的 `FlashcartProfile` 注册表，AGB/DMG 分包懒加载。解析规则复刻 FlashGBX（`0x..` 十六进制先转十进制再按 JSON 解析）。
- `FlashcartProfileService`：按模式过滤、Flash ID 匹配、`CFIInfo` 合成、写引脚与电压校验。
- 扩展端口契约：`getCartInfo` 接受 `CommandOptions`；`CommandResult` 增加结构化错误载荷（用于 `profile_ambiguous` 候选），并确保 `burner-use-case` 不吞掉该错误。
- FlashGBX 适配器集成 Auto 回退与手动覆盖；`ChipOperations.vue` 增加 profile 选择器，经 `contracts.ts` 传参（不直接导入 `services/`）。
- profile 仅限 FlashGBX 设备；`stm`/`stc` 与 ChisFlash 适配器不改。

## Capabilities

### New Capabilities
- `flashcart-profile-selection`

### Modified Capabilities
- `burner-settings-ui`：Chip Operations profile 选择器。

## Independent Acceptance

- 转换与校验测试通过；Auto 唯一/多匹配/无匹配与手动覆盖行为正确。
- 真机：至少一张非 CFI 卡带通过 profile 完成 ID、擦除、写入、校验。
- 第 2 步 CFI 流程无回归；`stm`/`stc` 不显示选择器。

## Impact

`src/data/flashcart-profiles/`、`scripts/gen-flashcart-profiles.*`、`FlashcartProfileService`、`services/flashgbx-*-adapter.ts`、`domain ports（getCartInfo）`、`types/command-result.ts`、`types/command-options.ts`、`features/burner/application/burner-use-case.ts`、`components/operaiton/{ChipOperations.vue,contracts.ts}`、`CartBurner.vue`、i18n（5 语言）。
