# Phase 0 审查报告: Baseline

> 日期: 2026-07-31  
> 文件数: `web-client` 全模块（排除 `node_modules/`、`dist/`、`coverage/`、构建产物）  
> 发现: P0(0) / P1(0) / P2(0) / INFO(0)  
> 导航: [返回 review index](../index.md) | [查看修复 checklist](../fix-checklist.md)

## 技术栈与实际边界

- Vue 3 + TypeScript + Vite；浏览器 Web Serial 与 Tauri 串口运行时共用 `platform/serial`、`features/burner` 和服务适配器。
- 页面/组件负责用户输入和操作编排；`features/burner/application` 负责用例和连接快照；`services/lk` 是独立的多卡菜单 ROM 构建链；`src-tauri` 提供原生保存文件命令。
- 文档声明的主要依赖方向为 Presentation -> Application -> Infrastructure；`npm run check:deps` 当前通过。

## 验证基线

| 命令 | 结果 |
|---|---|
| `npm run lint` | 通过 |
| `npm run type-check` | 通过 |
| `npm run check:deps` | 通过，无违规边 |
| `npm run test:run` | 通过，43 个文件 / 416 项 |
| `cargo check`（`src-tauri`） | 未执行成功，当前 shell 无 `cargo` |

## 历史审查对照

2026-06-06 的 8 项问题主要集中在连接回滚、legacy 状态清理、命令缓冲复位、FileReader 错误和 object URL 生命周期。当前工作区的未提交修改已覆盖这些问题的大部分主路径；本次不重复计入已确认已修复项，但补查了它们的相邻竞态和跨平台路径。

## 风险枚举结果

- 默认分支/未知输入：发现 UI 暴露的 cartridge type 6 无对应构建定义。
- 异步失败/上下文失效：发现默认 multi-menu 资源加载与用户输入存在 latest-wins 竞态；连接用例的 connect/disconnect 不是互斥事务。
- 半完成状态：发现 ROM 构建器原地修改 UI 配置，重复构建产生派生状态污染。
- 渲染/导出：未发现新的 HTML 注入；FileDropZone 读取失败只写控制台，用户无反馈。
- 隐式协议：发现多卡菜单标题长度字段未随固定 0x30 字符存储边界截断。

## 漏检复盘

- 已主动检查默认分支、异步 rejection、重入、状态半提交、对象 URL、`v-html`/DOMPurify、编码和协议长度边界。
- `services/lk` 的完整硬件格式兼容性仍缺少固件端契约测试；本次只确认了静态布局和可复现的重复构建/类型选择问题。

## 未覆盖区域

- Tauri Rust 实际编译、签名和打包权限未验证（环境缺少 `cargo`）。
- 真实 Web Serial/Tauri 设备断连、超时和固件响应只能通过静态路径和现有模拟测试覆盖。
