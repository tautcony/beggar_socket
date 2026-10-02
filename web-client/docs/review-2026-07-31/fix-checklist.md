# Review Findings Fix Checklist

> 来源: `docs/review-2026-07-31/`
> 最后核对: 2026-10-03（代码与单测证据；硬件/浏览器验收仍分开记录）

状态约定: `[ ]` 未开始；`[~]` 部分完成；`[x]` 已完成且有验证证据；`N/A` 不适用。

## P1-P1-1 — 连接生命周期竞态

- 来源: [`phase-1-connection-state.md`](./phases/phase-1-connection-state.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现 connect-in-flight + disconnect/retry 交错时序
- [x] 实施统一互斥或 generation cancellation
- [x] 增加 connect/disconnect/retry failure 回归测试
- [ ] 验证 Web/Tauri/模拟 gateway、HMR cleanup 和重复点击
- [ ] 执行测试、类型和构建验证并记录结果
- [ ] 发布/监控/文档动作: N/A

## P1-P2-1 — cartridge type 6 enum 不一致

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 决定补齐 type 6 定义或删除 UI 选项
- [ ] 增加 UI registry 与 builder registry 一致性测试
- [x] 增加选择该类型的构建回归测试
- [ ] 验证容量、sector/block 布局和固件兼容性
- [x] 执行验证命令并记录结果
- [ ] 发布/文档动作: N/A

## P1-P2-2 — 重复构建污染配置

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现连续构建并记录 item-list 差异
- [x] 复制/规范化 `GameConfig`，移除原地递减
- [x] 增加连续构建字节级一致性测试
- [x] 验证 save slot、字体、排序和缺失 ROM 路径
- [ ] 执行全量测试和构建
- [ ] 发布/文档动作: N/A

## P1-P3-1 — 默认资源 latest-wins/卸载竞态

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现默认资源延迟 + 用户选择/卸载
- [x] 引入任务 token、AbortController 和 await 后 disposed 检查
- [x] 增加默认覆盖、快速替换、卸载无 toast/ref 写入测试
- [ ] 验证背景预览 URL、菜单 ROM 和构建输入一致
- [ ] 执行测试、lint 和类型检查
- [ ] 发布/文档动作: N/A

## P2-P2-3 — 标题长度越界

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现超过 48 code unit 的标题
- [x] UI/构建器统一 clamp 并按协议编码计算长度
- [x] 增加 ASCII、CJK、surrogate pair 边界测试
- [x] 验证 item list 后续字段未被长度字段污染
- [x] 执行 ROM builder fixture 测试
- [ ] 发布/文档动作: N/A

## P2-P3-2 — 文件读取失败无用户反馈

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现 FileReader error/abort
- [x] 增加 `file-error` 或统一 Toast 反馈及多文件部分成功语义
- [x] 增加组件层回归测试
- [ ] 验证旧文件状态、重试和禁用态
- [x] 执行测试并记录结果
- [ ] 发布/文档动作: N/A

## P2-P3-3 — 快速选择旧任务覆盖新输入

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [~]（代码修复有证据；未勾选验收仍待完成）
- [x] 复现两个读取/图像处理任务反序完成
- [x] 引入 request id 或独立 AbortController
- [~] 增加菜单、背景、游戏 ROM 快速替换测试（菜单/背景反序与游戏 pending 去重已有；游戏替换反序未覆盖）
- [ ] 验证预览、文件名、数据和构建输入一致
- [ ] 执行全量测试
- [ ] 发布/文档动作: N/A

## 2026-10-03 核对证据

- 连接：`src/features/burner/application/connection-use-case.ts` 与 `tests/features/burner/connection-usecase-orchestration.test.ts`；操作/断连 owner 见 `tests/features/burner/device-operation-owner.test.ts`。Web/Tauri/模拟 gateway 单测存在；HMR 与真实重复点击浏览器验收未执行。
- type 6：`src/views/gba-multi-menu/RomBuildPanel.vue` 当前只提供 1–5；`tests/lk-rom-builder.test.ts` 拒绝 6。尚无 UI registry 自动一致性合同；未声称 type 6 被实现或固件兼容性通过。
- 重复构建：`tests/lk-rom-builder.test.ts` 精确字节/输入不变；`tests/lk-build-context.test.ts` 并发与阶段隔离；`tests/lk-capacity-layout.test.ts` 存档/字体/完整布局边界。真菜单启动、存档访问未验收。
- 默认资源与快速替换：`tests/use-multi-menu-state.test.ts` 覆盖反序菜单/背景、默认覆盖、卸载后无状态/toast、游戏文件 pending 去重；真实背景预览与页面交互验收待补。
- 标题：`src/views/gba-multi-menu/GameRomPanel.vue` maxlength=48；`tests/lk-rom-builder.test.ts` ASCII/CJK/surrogate pair 编码长度。单测已验证编码边界，未重新执行实体菜单显示检查。
- 文件错误：`tests/file-drop-zone.test.ts` error/abort/部分多文件成功并保留旧文件；`tests/file-io.test.ts` 与 `tests/composables/cartburner/file-state.test.ts` 提供读取与导出辅助覆盖。浏览器重试/禁用状态交互仍需验收。

本任务核对时执行 documentation-contracts、lk-rom-builder、lk-build-context、lk-capacity-layout、use-multi-menu-state、file-drop-zone、file-io、connection-usecase-orchestration，共 8 文件 108 tests 通过（Node 24.19.0）。上述证据说明代码与对应 focused tests；不代替全部运行时验收。各项“执行全量测试/构建”等子项保留未勾选，最终集成结果由[实施记录](../../../docs/review-2026-10-02/implementation.md)单独记录，避免将历史或尚未结束的运行标成验收完成。发布/文档动作中的 N/A 沿用历史说明。
