# Agent Findings

本轮使用 2 个 sub-agent 做独立候选探查。主 agent 对候选发现逐条复读代码后决定采纳、合并、降级或驳回。

## Agent A: 平台/协议/传输

范围: `platform/serial`, `protocol/beggar_socket`, `serial-service`, `device-connection-manager`, connection tests。

### 采纳

- `DeviceConnectionManager.disconnectDevice()` 失败路径未清 legacy `DeviceInfo`: 采纳为 P1-02。
- connected 状态重复 prepare 可能泄漏旧 handle: 采纳为 P2-01。
- stale_context 分支不释放新 handle: 采纳为 P2-02。

### 合并/扩展

- 主 agent 额外发现 init failure rollback disconnect 失败会越过 `markFailure()`，记录为 P1-01。该问题与 Agent A 的 connection cleanup 类发现合并在 Phase 1。

### 驳回或不进入 Findings

- WebSerialTransport、TauriSerialTransport、协议 atomic read/write、Mutex 重复 release: agent 未发现缺陷，主 agent 复核后同意不报告。

## Agent B: 视图/状态/文件

范围: `views`, `components`, `composables`, `stores`, router/App，相关测试。

### 采纳

- `FileDropZone` FileReader error/abort 未处理: 采纳为 P2-03。
- `useMultiMenuState` 文件读取和背景图异步处理缺少失败/卸载保护: 采纳并拆为 P2-03、P2-04。
- 下载链路 object URL 未 finally revoke: 采纳为 P3-01。

### 降级为残留疑点

- `CartBurner` 在 `deviceReady` 为 true 时如果 `props.device` 对象替换，adapter 可能继续绑定旧设备。主 agent 复查常规父组件流程后，当前 disconnect/connect 通常会先置 `deviceReady=false`，生产触发条件不够强。本轮不列为确认缺陷，建议后续在自动重连/HMR 流程变更时加 device identity guard 测试。

### 驳回或不进入 Findings

- System notice `v-html`: 主 agent 复核 `renderMarkdown()` 使用 DOMPurify，当前不作为缺陷报告。
- DeviceConnect 连点重入、session 取消恢复、SectorVisualization timer: 已有门闩/清理/测试或证据不足。
