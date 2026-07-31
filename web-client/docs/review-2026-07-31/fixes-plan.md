# Fixes Plan

## Batch 1: 连接生命周期收敛

处理 `P1-P1-1`。先在 use case 层建立单一 connect/disconnect/retry 互斥或 generation cancellation，再补交错时序测试；随后验证 Web、Tauri、模拟 gateway 和 HMR cleanup。

## Batch 2: ROM 构建输入不可变与 enum 对齐

处理 `P1-P2-1`、`P1-P2-2`、`P2-P2-3`。统一 cartridge type registry，决定 type 6 的支持或删除；构建器复制并规范化配置，避免 1-based/0-based 原地转换；限制标题长度并增加二进制 fixture。完成后验证连续构建结果字节级一致。

## Batch 3: multi-menu 异步任务协议

处理 `P1-P3-1`、`P2-P3-3`。为默认加载和用户选择任务引入 token/AbortController，所有 await 后检查最新任务和 scope；增加卸载、快速替换、默认资源延迟测试。

## Batch 4: 文件输入反馈

处理 `P2-P3-2`。为 FileDropZone 增加可观察的错误事件/Toast 和多文件部分成功语义，补 error/abort UI 回归测试。

## 建议验证顺序

1. `npm run test:run -- tests/connection-usecase-orchestration.test.ts tests/file-io.test.ts`
2. 新增 ROM builder fixture 后运行对应测试和全量 `npm run test:run`
3. `npm run lint && npm run type-check && npm run check:deps && npm run build`
4. 在具备 Rust 工具链的环境执行 `cargo check` 和 Tauri 打包冒烟测试
