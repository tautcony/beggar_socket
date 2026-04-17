## Context

三个 emulator 组件（Flash、SRAM、EEPROM）各约 200 行，模板结构和逻辑几乎一致。差异仅在：
1. 组件名和芯片类型标签文本
2. 特定芯片类型的配置选项（如 Flash 有 sector erase 选项）
3. i18n 键名

## Goals / Non-Goals

**Goals:**
- 提取共享模板和逻辑到 `BaseEmulator.vue`
- 三个具体组件仅定义差异部分（props/slots）
- 保持完全一致的 UI 行为和外观

**Non-Goals:**
- 不改变模拟器的功能逻辑
- 不合并为单一组件（保留三个入口以便路由和按需加载）

## Decisions

### D1: 使用 composition（props + slots）而非继承

`BaseEmulator.vue` 接受 `type` prop 和 named slots。具体组件通过 props 和 slots 注入差异部分。

**替代方案**: mixin / extends。未采用，因为 Vue 3 Composition API 推荐组合而非继承，且 `<script setup>` 不支持 extends。

### D2: 差异通过 props 枚举

定义 `EmulatorType = 'flash' | 'sram' | 'eeprom'`，BaseEmulator 根据 type 自动选择 i18n 键、图标和默认配置。

## Risks / Trade-offs

- [风险] slots 增加模板复杂度 → 保持 slot 数量最少（最多 1-2 个 named slots）
- [取舍] 基础组件需要覆盖所有三种类型的条件逻辑 → 通过 type prop 控制，逻辑简单
