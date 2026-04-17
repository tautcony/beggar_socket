## Context

web-client 项目中大量魔数和重复常量散布在多个模块，代码审查（review-2026-04-17）发现 100+ 处硬编码值和多处重复定义。当前缺少统一的常量组织策略，每个模块自行定义所需的常量。

## Goals / Non-Goals

**Goals:**
- 消除所有跨文件的重复常量定义
- 为协议命令、ROM header 偏移量、串口配置等高频魔数建立命名常量
- 建立常量按领域分组存放的约定
- 零行为变更，所有现有测试继续通过

**Non-Goals:**
- 不改变任何运行时行为或 API 接口
- 不重构函数签名或控制流
- 不提取仅在单个文件内使用的局部魔数（局部常量由各文件自行管理）
- 不涉及 parser/adapter 的函数分解（留给 `parser-decomposition` 和 `adapter-template-method` 变更）

## Decisions

### D1: 常量存放位置按领域划分

| 常量类别 | 存放位置 | 理由 |
|---------|---------|------|
| 协议命令/ACK/地址 | `protocol/beggar_socket/constants.ts` | 协议层专用，不应向外暴露 |
| ROM header 偏移量 | `utils/parsers/constants.ts` | parser 和 editor 共用 |
| 适配器时序常量 | `services/cartridge-adapter.ts` (基类静态属性) | 两个子类共享 |
| 串口配置 | `platform/serial/constants.ts` | 跨平台网关共享 |
| DEFAULT_PROGRESS | `types/progress-info.ts` (与类型定义同处) | 与 ProgressInfo 类型紧密关联 |
| PACKET_HEADER_SIZE | `protocol/beggar_socket/payload-builder.ts` (文件顶部常量) | 仅该文件使用 |

**替代方案**: 建立单一的 `src/constants/` 顶级目录。未采用，因为这会打破模块内聚性，且常量与其使用者距离过远。

### D2: FileInfo 类型去重方式

从 `types/rom-assembly.ts` 删除重复的 `FileInfo` 定义，改为从 `types/file-info.ts` 导入。

## Risks / Trade-offs

- [风险] 大量文件的 import 路径变更可能导致遗漏 → 通过 `npm run type-check` 和 `npm run build` 验证
- [风险] 常量命名可能不够直观 → 使用领域术语命名（如 `FLASH_CMD_UNLOCK_1` 而非 `CMD_AA`）
- [取舍] 部分协议层魔数（如 flash 解锁序列地址）在 GBA 和 GBC 间不同，本次仅提取为并列常量，不做参数化抽象（留给 `protocol-platform-abstraction`）
