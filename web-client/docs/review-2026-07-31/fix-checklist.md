# Review Findings Fix Checklist

> 来源: `docs/review-2026-07-31/`  
> 最后更新: 2026-07-31

状态约定: `[ ]` 未开始；`[~]` 部分完成；`[x]` 已完成且有验证证据；`N/A` 不适用。

## P1-P1-1 — 连接生命周期竞态

- 来源: [`phase-1-connection-state.md`](./phases/phase-1-connection-state.md)
- 总体状态: [ ]
- [ ] 复现 connect-in-flight + disconnect/retry 交错时序
- [ ] 实施统一互斥或 generation cancellation
- [ ] 增加 connect/disconnect/retry failure 回归测试
- [ ] 验证 Web/Tauri/模拟 gateway、HMR cleanup 和重复点击
- [ ] 执行测试、类型和构建验证并记录结果
- [ ] 发布/监控/文档动作: N/A

## P1-P2-1 — cartridge type 6 enum 不一致

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [ ]
- [ ] 决定补齐 type 6 定义或删除 UI 选项
- [ ] 增加 UI registry 与 builder registry 一致性测试
- [ ] 增加选择该类型的构建回归测试
- [ ] 验证容量、sector/block 布局和固件兼容性
- [ ] 执行验证命令并记录结果
- [ ] 发布/文档动作: N/A

## P1-P2-2 — 重复构建污染配置

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [ ]
- [ ] 复现连续构建并记录 item-list 差异
- [ ] 复制/规范化 `GameConfig`，移除原地递减
- [ ] 增加连续构建字节级一致性测试
- [ ] 验证 save slot、字体、排序和缺失 ROM 路径
- [ ] 执行全量测试和构建
- [ ] 发布/文档动作: N/A

## P1-P3-1 — 默认资源 latest-wins/卸载竞态

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [ ]
- [ ] 复现默认资源延迟 + 用户选择/卸载
- [ ] 引入任务 token、AbortController 和 await 后 disposed 检查
- [ ] 增加默认覆盖、快速替换、卸载无 toast/ref 写入测试
- [ ] 验证背景预览 URL、菜单 ROM 和构建输入一致
- [ ] 执行测试、lint 和类型检查
- [ ] 发布/文档动作: N/A

## P2-P2-3 — 标题长度越界

- 来源: [`phase-2-multimenu-rom-builder.md`](./phases/phase-2-multimenu-rom-builder.md)
- 总体状态: [ ]
- [ ] 复现超过 48 code unit 的标题
- [ ] UI/构建器统一 clamp 并按协议编码计算长度
- [ ] 增加 ASCII、CJK、surrogate pair 边界测试
- [ ] 验证 item list 后续字段未被长度字段污染
- [ ] 执行 ROM builder fixture 测试
- [ ] 发布/文档动作: N/A

## P2-P3-2 — 文件读取失败无用户反馈

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [ ]
- [ ] 复现 FileReader error/abort
- [ ] 增加 `file-error` 或统一 Toast 反馈及多文件部分成功语义
- [ ] 增加组件层回归测试
- [ ] 验证旧文件状态、重试和禁用态
- [ ] 执行测试并记录结果
- [ ] 发布/文档动作: N/A

## P2-P3-3 — 快速选择旧任务覆盖新输入

- 来源: [`phase-3-views-state-files.md`](./phases/phase-3-views-state-files.md)
- 总体状态: [ ]
- [ ] 复现两个读取/图像处理任务反序完成
- [ ] 引入 request id 或独立 AbortController
- [ ] 增加菜单、背景、游戏 ROM 快速替换测试
- [ ] 验证预览、文件名、数据和构建输入一致
- [ ] 执行全量测试
- [ ] 发布/文档动作: N/A
