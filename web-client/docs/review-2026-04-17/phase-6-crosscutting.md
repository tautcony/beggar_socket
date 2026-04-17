# Phase 6 审查报告: 交叉审查

> 日期: 2026-04-17
> 文件数: 跨模块
> 发现: P0(0) / P1(1) / P2(2) / INFO(1)

## Findings

### [P1-01] GBA/GBC 二元性导致系统级镜像复制

- 位置: 贯穿 `protocol/` → `services/` → `tool-functions.ts` → `components/emulator/` 四层
- 触发条件: 项目支持 GBA 和 GBC/MBC5 两个硬件平台，但在每一层都采用独立实现而非参数化抽象。四层叠加的重复总量估计超过 5000 行:

| 层 | GBA 实现 | GBC/MBC5 实现 | 重复估计 |
|----|---------|-------------|---------|
| 协议层 | `rom_*` 系列函数 | `gbc_*` 系列函数 | ~200 行 |
| 适配器层 | `GBAAdapter` (1658 行) | `MBC5Adapter` (1850 行) | ~2500 行 |
| 工具层 | `ppbUnlockGBA` (260 行) | `ppbUnlockMBC5` (210 行) | ~370 行 |
| 模拟器层 | `GBAEmulator.vue` | `GBCEmulator.vue` + `GBEmulator.vue` | ~300 行 |

- 影响: 这是项目中**最大的技术债**。任何横切关注点（进度报告策略、错误处理模式、重试策略、日志格式）的修改都需要在两个平台的实现中同步，是回归风险的最主要来源
- 修复方向:
  - 定义 `PlatformOps` 接口层，封装 GBA/GBC 差异（协议调用、地址映射、bank 窗口）
  - 将通用操作流程（read/write/erase/verify）实现为模板方法，通过 `PlatformOps` 委托平台差异
  - 这是一个大型重构，建议按操作类型分批推进

### [P2-01] 错误消息字符串未集中管理

- 位置: 跨 `features/burner/adapters/`, `features/burner/application/domain/error-mapping.ts`, `platform/serial/`
- 触发条件: 回退错误消息、诊断信息格式、连接失败描述分散在 30+ 个位置
- 影响: 无法统一调整错误表述，i18n 覆盖不全
- 修复方向: 建立错误消息常量集或使用 i18n key

### [P2-02] 设置/配置类均采用静态类 + localStorage 模式

- 位置: `settings/advanced-settings.ts`, `settings/debug-settings.ts`, `stores/recent-file-names-store.ts`, `services/system-notice-service.ts`
- 触发条件: 4 个模块各自实现 localStorage 读写、错误处理、默认值回退
- 影响: localStorage 交互模式分散，无统一的序列化/反序列化和错误处理
- 修复方向: 考虑统一的 `PersistentStorage<T>` 工具类或 Pinia 持久化插件

### [INFO-01] 命名约定不一致汇总

- 位置: 全项目
- 触发条件: 跨模块存在多种命名风格混用

| 类别 | 示例 | 建议 |
|------|------|------|
| 文件名 | `useCartBurnerFileState.ts` (camelCase) vs `rom-assembly-utils.ts` (kebab-case) | 统一为 kebab-case |
| 方法名 | `switchROMBank()` vs `switchRomBank()` | 统一缩写大写规则 |
| 协议函数 | `rom_get_id()` (snake_case) vs `gbc_rom_get_id()` | 保持但记录约定 |
| 目录名 | `operaiton` (拼写错误) | 修正为 `operation` |
| 类型 | `RamType` (PascalCase) vs `ramType` (参数) | 参数命名正确，无问题 |
| 常量 | `ROM_BANK_SIZE` vs `romPageSize` (AdvancedSettings 属性) | 区分不可变常量和可变配置 |
| 度量命名 | `totalRxChunks` (Web) vs `totalRxReads` (Tauri) | 统一度量语义 |

- 修复方向: 建立命名约定文档，对照修正

## 差异化反证审查

### 所有分发入口 / 命令入口 / 协议入口
- 风格/重复层面: 不涉及新发现

### 所有异步链路
- 风格/重复层面: 超时错误构造已在 Phase 2 覆盖

### 所有状态写入链路
- 风格/重复层面: DEFAULT_PROGRESS 已在 Phase 4 覆盖

### 所有内容渲染点、富文本点、导出链路
- 风格/重复层面: i18n 遗漏已在 Phase 3 覆盖

### 所有高杠杆工具函数
- 风格/重复层面: parser 偏移量、CRC、颜色生成已在 Phase 5 覆盖

### 跨模块一致性
- GBA/GBC 二元性重复已作为系统级问题 P1-01 标出
- 错误消息分散已标出
- localStorage 模式分散已标出

## 漏检复盘

- 已主动复查的模式:
  - 四层 GBA/GBC 镜像: 已作为最高优先级标出
  - 错误消息分散: 已标出
  - 配置持久化分散: 已标出
  - 命名不一致: 已系统性汇总
- 本次交叉审查未新增超出 Phase 1-5 的发现

## 未覆盖区域

- `tests/` — 测试代码的重复（如 mock 模式）未审查，因本次聚焦 src/
- `i18n/locales/` — 翻译文件的一致性未审查
