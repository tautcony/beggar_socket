# 代码审查汇总

> 日期: 2026-04-17
> 范围: web-client/src/ 全目录
> 审查重点: 代码风格、重复代码、重复逻辑抽取、可维护性
> Phase 数: 6 (Phase 0 基线 + Phase 1-5 审查 + Phase 6 交叉)

## 统计

| 严重度 | 数量 |
|--------|------|
| P0 | 0 |
| P1 | 16 |
| P2 | 23 |
| INFO | 10 |
| **合计** | **49** |

## 高优先级问题 (P1)

| # | Phase | 问题描述 | 重复行数估计 | 文件 |
|---|-------|---------|------------|------|
| 1 | 6 | GBA/GBC 二元性导致系统级四层镜像复制 | ~5000 行 | 贯穿全项目 |
| 2 | 1 | GBAAdapter/MBC5Adapter 核心操作逻辑 85-95% 镜像 | ~3000 行 | `services/{gba,mbc5}-adapter.ts` |
| 3 | 1 | PPB Unlock GBA/MBC5 大段复制 | ~420 行 | `services/tool-functions.ts` |
| 4 | 1 | 适配器内 4+ 方法超过 250 行 | — | `services/{gba,mbc5}-adapter.ts` |
| 5 | 1 | 适配器中 8+ 方法重复进度初始化模板 | ~160 行 | `services/{gba,mbc5}-adapter.ts` |
| 6 | 1 | 8 个时序常量在两个适配器中独立定义 | ~16 行 | `services/{gba,mbc5}-adapter.ts` |
| 7 | 2 | GBA/GBC 协议函数结构性复制 | ~200 行 | `protocol/beggar_socket/protocol.ts` |
| 8 | 2 | 传输层超时错误消息构造 100% 重复 | ~30 行 | `platform/serial/{transports,tauri/tauri-serial-transport}.ts` |
| 9 | 2 | 设备网关 init 信号序列跨平台重复 | ~20 行 | `platform/serial/{tauri,web}/device-gateway.ts` |
| 10 | 3 | 三个模拟器组件模板/样式/生命周期几乎完全相同 | ~300 行 | `components/emulator/*.vue` |
| 11 | 3 | 操作面板 CSS 和空白检测逻辑重复 | ~80 行 | `components/operaiton/*.vue` |
| 12 | 3 | GBAMultiMenuView.vue 极度臃肿 (2200 行) | — | `views/GBAMultiMenuView.vue` |
| 13 | 4 | AdvancedSettings 16 组 getter/setter 机械重复 | ~128 行 | `settings/advanced-settings.ts` |
| 14 | 4 | AdvancedSettings validateSettings() 验证逻辑重复 | ~71 行 | `settings/advanced-settings.ts` |
| 15 | 5 | CFIParser.parse() ~380 行超长单方法 | — | `utils/parsers/cfi-parser.ts` |
| 16 | 5 | rom-parser.ts 中函数过长且偏移量散列 | — | `utils/parsers/rom-parser.ts` |

## 各 Phase 摘要

| Phase | 模块 | P1 | P2 | INFO |
|-------|------|----|----|------|
| 1 | 适配器层重复代码 | 5 | 3 | 2 |
| 2 | 协议与传输层重复 | 3 | 4 | 1 |
| 3 | 组件与视图层重复 | 3 | 4 | 2 |
| 4 | 编排/状态/配置层 | 2 | 5 | 2 |
| 5 | 工具与类型层 | 2 | 5 | 2 |
| 6 | 交叉审查 | 1 | 2 | 1 |

## 跨模块系统性问题

### 1. GBA/GBC 二元镜像是最大技术债

从协议层到 UI 层，GBA 和 GBC/MBC5 的差异仅在地址映射、数据编码、bank 窗口大小等参数，但代码以复制粘贴的方式在四层（协议→适配器→工具→模拟器）各自独立实现。估计总重复量超过 5000 行，是项目中**一半以上的可维护性问题的根源**。

### 2. 魔数/偏移量散布

ROM/CFI 解析器、协议函数、适配器、ROM assembly 工具中累计 100+ 个硬编码数值，缺乏命名常量。这既影响可读性，也使重构和验证困难。

### 3. 配置/持久化模式碎片化

AdvancedSettings、DebugSettings、RecentFileNamesStore、SystemNoticeService 各自实现 localStorage 交互，无共享持久化抽象。

### 4. 超大文件问题

| 文件 | 行数 | 建议 |
|------|------|------|
| `GBAMultiMenuView.vue` | 2200 | 拆分为 4-5 子组件 |
| `mbc5-adapter.ts` | 1850 | 提取通用操作到基类 |
| `gba-adapter.ts` | 1658 | 提取通用操作到基类 |
| `CartBurner.vue` | 1300 | 考虑拆分 |
| `RomAssemblyView.vue` | 1100 | 评估拆分 |
| `tool-functions.ts` | 670 | 提取公共 PPB 核心 |
| `cfi-parser.ts` | 596 | 分解 parse() |
| `rom-parser.ts` | 570 | 提取常量，分解函数 |
| `advanced-settings.ts` | 518 | 数据驱动 getter/setter |

## 差异化反证复盘

已横向复查的模式:
- **重复代码块**: 已覆盖四层 GBA/GBC 镜像、AdvancedSettings 模板、操作面板、模拟器、DEFAULT_PROGRESS、ROM/RAM handler
- **魔数/硬编码字符串**: 已系统性检查所有源文件，标注高密度区域
- **超长函数/文件**: 已标注 9 个超大文件和 6+ 个超长方法
- **命名不一致**: 已汇总文件名、方法名、度量命名、目录拼写等问题
- **类型重复**: FileInfo 双重定义已标出
- **配置模式分散**: localStorage 使用不统一已标出

这一轮复盘未新增发现。

## 未覆盖区域

- `tests/` — 测试代码的 mock 模式重复未审查
- `i18n/locales/` — 翻译文件的键一致性未审查
- `services/lk/cli.ts` — CLI 工具代码，独立功能，仅轻度覆盖
