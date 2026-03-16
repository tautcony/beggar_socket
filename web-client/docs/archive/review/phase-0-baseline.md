# Phase 0 审查报告：准备工作与基线建立

> 审查时间：2026-03-16  
> 审查文件数：2（基线文档）  
> 发现问题数：N/A（本 Phase 为基线建立，不产生问题清单）

## 已知问题基线摘要

以下为 `docs/webserial-vs-electron-serial-analysis.md` 中已记录的问题，作为后续 Phase 审查的参照基准：

| 严重度 | 代号 | 问题 | 位置 |
|--------|------|------|------|
| 🔴 P0 | C1 | Writer lock 每次 `send()` 都 acquire/release，高频通信下增加延迟和锁竞争 | `platform/serial/transports.ts` |
| 🔴 P0 | C2 | 超时触发时释放 writer lock 破坏 WritableStream 状态，导致后续通信无响应 | `platform/serial/transports.ts` |
| 🟡 P1 | C6 | WebSerial `bufferSize` 未设置，Chrome 默认 255 字节，不足以容纳最大协议包 | `platform/serial/web/device-gateway.ts` |
| 🟡 P1 | C1 | `pumpReadable` 异常退出后 readable stream 恢复困难，一次错误可能导致通信永久中断 | `platform/serial/transports.ts` |
| 🟢 P2 | C4 | Electron `serial-write` 不等待 `drain`，极端场景可能丢数据 | `electron/ipc-handlers.js` |
| 🟢 P2 | C4 | Electron IPC 数据序列化 `Uint8Array ↔ Array ↔ Buffer` 转换开销 | `electron/preload.js` + `electron/ipc-handlers.js` |

分析文档还提供了修复建议（持久化 Writer、增大 bufferSize、超时仅报错不破坏流、Electron write 增加 drain 等待）。

## 本次审查的模块边界列表

按分层架构从底到顶排列：

| Phase | 层级 | 模块路径 | 职责 |
|-------|------|----------|------|
| 1 | Infrastructure | `src/platform/serial/` | 传输层：WebSerial / Electron 串口抽象 |
| 2 | Infrastructure | `src/protocol/beggar_socket/` | 协议层：命令编码/解码、帧格式、ACK |
| 3 | Application | `src/features/burner/` | 应用层：用例编排、会话管理、领域模型 |
| 4 | Infrastructure/Legacy | `src/services/` | 服务层：适配器、设备连接管理、RTC、LK |
| 5 | Domain/Utils | `src/utils/` | 工具层：异步工具、解析器、CRC、进度 |
| 6 | State | `src/stores/` + `src/settings/` + `src/composables/` | 状态层：Pinia stores、设置、组合式函数 |
| 7 | Presentation | `src/views/` + `src/components/` | 展示层：Vue 组件与视图 |
| 8 | Runtime | `electron/` | Electron 主进程：IPC、preload、安全 |
| 9 | Cross-cutting | 全部 | 交叉审查：跨模块一致性与系统性问题 |

## 审查执行日期

- **开始日期**：2026-03-16
- **执行策略**：按 Phase 0–9 顺序逐模块审查，每个 Phase 完成后立即输出对应 markdown 文件
