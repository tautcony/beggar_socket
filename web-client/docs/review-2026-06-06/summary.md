# Code Review Summary

日期: 2026-06-06
范围: `web-client`
输出: `web-client/docs/review-2026-06-06/`

## 统计

| 严重度 | 数量 |
| --- | ---: |
| P0 | 0 |
| P1 | 3 |
| P2 | 4 |
| P3 | 1 |
| 合计 | 8 |

## 高优先级 Findings

### P1-01 init rollback 失败会跳过连接状态收敛

- 位置: `src/features/burner/application/connection-use-case.ts:228`
- 触发: init 失败后 rollback disconnect 也失败。
- 影响: 原始 init failure 被覆盖，snapshot 可能停在 `connecting`，调用方拿不到规范化失败。
- 修复: rollback disconnect 改 best-effort，先 mark init failure；补组合失败测试。

### P1-02 disconnectDevice 失败时 legacy DeviceInfo 未清理

- 位置: `src/services/device-connection-manager.ts:287`
- 触发: 底层 close/driver 断开失败。
- 影响: orchestration 已断开但传入 `DeviceInfo` 仍保留 transport/port，`isDeviceConnected()` 可能继续返回 true。
- 修复: 清理 legacy device 放到 finally；补 manager 层 close 失败测试。

### P1-03 操作后 resetCommandBuffer 不在 finally

- 位置: `src/components/CartBurner.vue:406` 等 11 处。
- 触发: 命令完成后，保存文件/日志/toast/结果处理在 reset 前抛错。
- 影响: 设备 command buffer 可能不复位，下一条命令 ACK/读包错位或超时。
- 修复: 抽 operation cleanup helper，把 `resetCommandBuffer()` 放入不可跳过的 finally。

## 其他 Findings

- P2-01 connected 状态重复 prepareConnection 可替换 snapshot 而不释放旧 handle。
- P2-02 stale_context 分支未释放刚打开的新 handle。
- P2-03 FileReader 只处理 onload，error/abort 静默卡住文件选择。
- P2-04 multi-menu 背景图异步处理卸载后仍可更新状态和发 toast。
- P3-01 部分下载链路未用 finally revoke object URL。

## 跨模块问题

1. 连接状态有两套载体: orchestration snapshot 和 legacy `DeviceInfo`。失败路径只更新其中一套时，会出现半完成状态。
2. 设备协议清理散落在 UI 操作体末尾，没有统一 finally 保障；这使非协议后处理异常能影响下一次协议交互。
3. 文件读取缺少统一边界层。通用 FileDropZone、multi-menu 专用读取和下载 helper 行为不一致，测试也只覆盖成功路径。

## 差异化反证复盘

已横向复查:

- 分发/协议入口: ACK/payload 已走 atomic `sendAndReceive`；短包、超时、transport failure 有测试。
- 异步失败/取消/超时: 发现 init rollback、disconnect legacy sync、operation reset finally、FileReader error/abort 缺口。
- 状态写入半完成: 发现 orchestration 与 legacy DeviceInfo 分叉；未发现 Pinia store 重大半提交。
- 重建/清理链路: 发现 repeated prepare 和 stale_context handle cleanup 缺口。
- 内容渲染/富文本/导出: System notice v-html 已经 DOMPurify；下载 object URL finally 不一致为 P3。
- 高杠杆工具函数: mutex、withTimeout、markdown、port filter 轻量复查，未新增高风险缺陷。

## 未覆盖区域

- 未运行完整测试，本轮是静态审查加代码路径复读。
- `services/lk/romBuilder.ts` 内部构建算法只做轻量上下文阅读，未做完整算法正确性 review。
- Tauri Rust 命令实现和打包权限只做入口级浏览，未做桌面安全专项。
