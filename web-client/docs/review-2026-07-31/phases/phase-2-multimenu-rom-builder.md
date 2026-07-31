# Phase 2 审查报告: Multi-menu ROM Builder

> 日期: 2026-07-31  
> 文件数: 8  
> 发现: P0(0) / P1(2) / P2(1) / INFO(0)  
> 导航: [返回 review index](../index.md) | [查看修复 checklist](../fix-checklist.md)

## 已审查文件

- `src/views/gba-multi-menu/RomBuildPanel.vue`
- `src/views/gba-multi-menu/GameRomPanel.vue`
- `src/views/gba-multi-menu/SaveFilePanel.vue`
- `src/composables/useMultiMenuState.ts`
- `src/services/lk/romBuilder.ts`
- `src/services/lk/imageUtils.ts`
- `src/services/lk/types.ts`
- `tests/imageUtils.test.ts`

## Findings

### P1-P2-1: [P1] UI 可选的 cartridge type 6 在构建器中不存在，选择后必然失败

- 位置: `src/views/gba-multi-menu/RomBuildPanel.vue:17-34`; `src/services/lk/types.ts:13-20`; `src/services/lk/romBuilder.ts:25-31`
- 触发条件: 在构建配置中选择“6. ChisFlash 2.0G (256MB)”并点击构建。
- 影响: `prepareCompilation(6)` 直接抛出 `Invalid cartridge type: 6`，该 UI 选项永远不能生成 ROM。
- 证据: 运行时复现测试确认 `prepareCompilation(6)` 抛出该错误。
- 置信度: 高。
- 修复方向: 要么补齐 type 6 的 `flash_size/sector_size/block_size` 定义和相应格式测试，要么删除该选项；避免 UI enum 与服务 enum 分别维护。

### P1-P2-2: [P1] buildRom 原地修改 UI 配置，重复构建生成被污染的 item metadata

- 位置: `src/composables/useMultiMenuState.ts:326-352`; `src/services/lk/romBuilder.ts:115-118, 142-145, 245-259`
- 触发条件: 同一 multi-menu 页面成功构建一次后，不修改游戏配置再次点击构建。
- 影响: 第一次构建会把 `title_font`、`save_slot` 原地递减；第二次继续递减并把 `-1` 写成 `0xFF`，生成的 ROM code 和 item list 与第一次不同，存档槽和字体元数据错误，但构建仍返回成功。
- 证据: 临时 Vitest 复现：同一输入两次构建后配置为 `title_font=-1/save_slot=-1`，第二个 ROM 的 item-list 首字节为 `0xFF`。
- 置信度: 高。
- 修复方向: 构建器内部复制/规范化 `GameConfig`，不要修改调用方对象；明确 `title_font`、`save_slot` 的外部 1-based 与二进制 0-based 转换，并增加重复构建等价性断言。

### P2-P2-3: [P2] 标题长度字段未按固定 0x30 字符槽截断

- 位置: `src/views/gba-multi-menu/GameRomPanel.vue:68-75`; `src/services/lk/romBuilder.ts:250-271`
- 触发条件: 用户输入超过 48 个 UTF-16 code unit 的标题。
- 影响: payload 只写入前 48 个字符，但 byte 1 仍写入完整 `title.length`（并可能溢出为 0-255）；固件按长度读取时会越过固定 0x60 字节标题区域，导致后续字段错位或显示乱码。
- 证据: 静态路径；UI 没有 `maxlength`，构建器也没有统一 clamp。
- 置信度: 高（依赖固定 item 结构契约）。
- 修复方向: 在 UI 和构建器双重限制为协议允许长度，按实际编码单位计算长度；增加超长 ASCII、CJK 和 surrogate pair 测试。

## 漏检复盘

- 默认分支/未知输入: 已检查 cartridge enum、字体/存档槽输入；type 6 缺口已确认。
- 异步失败/前提失效: 已检查动态图片库加载、构建失败状态；见 Phase 3 的资源竞态。
- 半完成状态: 已检查 save sector 与 item list 的写入顺序；重复 build 的配置污染是本 phase 主问题。
- 渲染/导出/编码: 已检查标题 UTF-16 写入和输出命名；未发现新的 object URL 泄漏。

## 未覆盖区域

- 没有固件端 item-list 解析器或契约 fixture，标题长度影响按二进制布局推断。
