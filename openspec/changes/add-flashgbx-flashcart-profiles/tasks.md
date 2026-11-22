## 1. Data

- [ ] 1.1 定义 `FlashcartProfile` 类型；实现 `gen-flashcart-profiles` 脚本（复刻 FlashGBX 的 hex→dec 再解析；字段白名单；占位符含 `SA+N`/`ID`/`WR`；`flash_id_offsets`；嵌套 `flash_ids`；`voltage_variants`；几何例外快照；AGB/DMG 分包）；schema、计数（AGB 59 / DMG 106）与 Flash ID 冲突快照测试。
- [ ] 1.2 构建产物保留 FlashGBX 版权/许可证声明。

## 2. Contracts, service & adapters

- [ ] 2.1 `getCartInfo` 增加 `CommandOptions`；`CommandResult` 增加结构化载荷；`burner-use-case` 透传 `profile_ambiguous`/`profile_not_found`；测试。
- [ ] 2.2 `FlashcartProfileService`：按模式过滤、`flash_ids`（含嵌套）+ `flash_id_offsets` 匹配、`CFIInfo` 合成、`write_pin` 与 `voltage` 校验；测试覆盖唯一、多匹配、无匹配、`AUDIO`/`VIN` 拒绝。
- [ ] 2.3 核对 `LK_Device.py` 的 profile 探测顺序并写入 design；`FlashgbxGbaAdapter`/`FlashgbxMbcAdapter` 集成 Auto 回退（探测后 `reset`）与手动覆盖；非 CFI profile 单测。

## 3. UI & acceptance

- [ ] 3.1 `ChipOperations.vue` 选择器（仅 `nativeFlashgbxProtocol`；按 GBA/MBC5 过滤；默认 `Auto (CFI)`；模式切换重置）；候选列表经 `contracts.ts`；5 语言 i18n 与组件测试；确保通过 `check-architecture-deps`。
- [ ] 3.2 真机非 CFI 卡带验证并记录；`npm test`、`npm run build`、`cargo test`。
