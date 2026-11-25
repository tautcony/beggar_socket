## Purpose

Define the connection orchestration use case contract for Burner-facing workflows so connection lifecycle behavior is centralized, deterministic, and recoverable.

## Requirements

### Requirement: Application-layer connection use case orchestration
系统 SHALL 通过统一的连接编排处理选串口、打开串口、协议验证、初始化和断开。首次连接、指定串口连接和重连 SHALL 使用相同的会话建立流程。

#### Scenario: UI requests connection preparation
- **WHEN** 界面发起连接、提交指定串口或请求重连
- **THEN** 编排按所选配置执行建立会话所需的步骤并返回统一结果

#### Scenario: UI requests disconnect
- **WHEN** 界面请求断开
- **THEN** 编排执行适用的协议收尾，关闭串口并释放当前会话

#### Scenario: Pending connection fails before commit
- **WHEN** open 后、active session commit 前的 probe、resolve 或 initialize 失败
- **THEN** 编排调用 `cleanupPending()` 清理协议状态并关闭 pending transport，报告主错误及清理结果，不发布活动会话

#### Scenario: Active session is disconnected
- **WHEN** session 已 commit 后断开
- **THEN** 编排调用 `teardown(activeSession)`，再关闭 transport 并清除活动 session

### Requirement: Connection state machine contract
系统 SHALL 保持 `idle`、`selecting`、`connecting`、`connected`、`disconnecting` 和 `failed` 状态。只有协议验证、初始化和会话解析全部成功后，系统 SHALL 发布已连接状态。

#### Scenario: Successful connect transition sequence
- **WHEN** 用户选择串口且打开、协议验证、解析和初始化均成功
- **THEN** 状态从 `idle` 或 `selecting` 经 `connecting` 到达 `connected`，并发布已解析会话

#### Scenario: Failed initialization transition sequence
- **WHEN** 打开串口后协议验证、解析或初始化失败
- **THEN** 状态进入 `failed`，清理已打开的串口并报告失败阶段，界面无活动会话

### Requirement: Connection error normalization and recovery semantics
系统 SHALL 将连接与初始化失败归一为稳定的错误结果，并 SHALL 支持无需刷新页面即可立即重试/重连。错误结果 SHALL 携带失败阶段（`select`、`connect`、`probe`、`resolve`、`initialize`、`disconnect` 或既有 `unknown`）和对应 code，供界面选择文案。每次失败 SHALL 同时产出 `DeviceDiagnostic`（`code`、`severity`、`message`、`stage`），使界面与调用方无需解析日志文本；主错误与清理失败分别保留为独立诊断条目。

#### Scenario: Connect failure normalization
- **WHEN** runtime connection fails due to permission, transport, or device errors
- **THEN** orchestration returns a normalized failure result with stage-aware error classification

#### Scenario: Failure yields a diagnostic
- **WHEN** 连接在任一新阶段（`probe`、`resolve`、`initialize`）失败
- **THEN** 结果附带与失败阶段一致的 `DeviceDiagnostic`，界面据此展示原因，不依赖日志字符串

#### Scenario: Recovery after failure
- **WHEN** user retries after a failed connection attempt
- **THEN** orchestration starts from a clean connection context and can reach `connected` state without stale failure residue

#### Scenario: Disconnect cleanup failure still clears orchestration state
- **WHEN** the underlying gateway reports a failure while disconnecting
- **THEN** orchestration clears its active connection state before surfacing the failure so the next connect attempt does not inherit stale handles
- **AND** 收尾命令失败与端口关闭失败分别记录为 `disconnect` 阶段的诊断

#### Scenario: Invalid connection context fails fast
- **WHEN** orchestration receives a connection handle whose context cannot be treated as a valid `DeviceHandle`
- **THEN** it returns a normalized connection failure instead of crashing later through an unchecked type assertion

#### Scenario: Protocol stage maps to an actionable message
- **WHEN** probe、resolve 或 initialize 阶段失败
- **THEN** 结果保留该阶段与驱动给出的原因，界面据此提示检查传输、固件版本或高级设置，且不把阶段折叠为通用 `connect` 失败

### Requirement: Connection orchestration integration coverage
The system SHALL provide integration tests for connection orchestration covering success, failure, cancellation/interrupt, and reconnect behavior.

#### Scenario: Success and failure paths are covered
- **WHEN** connection orchestration integration tests run
- **THEN** the suite verifies deterministic outputs and state transitions for both successful lifecycle and failure branches

#### Scenario: Reconnect behavior is covered
- **WHEN** integration tests perform disconnect and reconnect cycles
- **THEN** the suite verifies lifecycle consistency and contract-compliant state recovery across repeated attempts

### Requirement: Connection disconnect regression coverage
The system SHALL provide orchestration-level tests for disconnect cleanup and reconnect after disconnect-path failures.

#### Scenario: Disconnect failure followed by reconnect
- **WHEN** an orchestration test injects a gateway disconnect failure and then retries connection
- **THEN** the suite verifies the retry starts from a clean state and can reach `connected` without a manual page reset

### Requirement: Single authoritative connection context state
连接编排 SHALL 通过同一会话保存传输、串口信息、解析后的设备 profile 和连接身份。活动会话的设备和固件选择 SHALL 固定至重连或重新建立会话。

#### Scenario: Port info update preserves effective firmware profile
- **WHEN** 连接建立期间补全串口信息
- **THEN** 改动只影响串口信息及匹配诊断，设备与固件仍由本次设置选项决定

#### Scenario: Effective firmware profile fixed for connection and operation lifetime
- **WHEN** 在活动会话期间保存不同的设备或固件选项
- **THEN** 当前操作继续使用会话里的设备和固件，重连或重新建立会话时读取新选择

#### Scenario: Disconnect clears active transport and connection identity
- **WHEN** 用户断开设备或替换连接
- **THEN** 旧会话、适配器和连接身份失效，后续操作通过新会话访问设备

### Requirement: Session-provided protocol adapter and display
系统 SHALL 使用活动会话提供的协议适配器、模式同步策略和显示信息。所选设备、固件、端口匹配结果以及失败阶段和原因 SHALL 以 `DeviceDiagnostic` 记录，连接日志渲染同一组诊断。

#### Scenario: Adapter selection follows active session
- **WHEN** 界面在 Beggar 或 FlashGBX 会话中打开 GBA 或 MBC5 操作
- **THEN** 该会话提供对应适配器和适用的硬件模式同步，连接信息显示实际使用的设备和固件

#### Scenario: Protocol failure is actionable
- **WHEN** 握手或初始化失败
- **THEN** 界面指出所选设备及失败阶段，提示检查高级设置和串口，日志保留匹配结果与失败原因

### Requirement: Explicit Boost session establishment
真实串口连接 SHALL 仅在选择丐中丐（Boost）时验证 Boost 固件。验证成功后的 `runtimeFeatures.boostTransport` SHALL 由 core `SessionResolver` 按规则派生（`variantId === 'beggar-stm-boost'` 且 verification 为 `verified`），lifecycle SHALL NOT 在解析后手工赋值或改写 `SessionProfile`。探测 SHALL 使用固定 250 ms 超时（与现有 `boost_probe(transport, 250)` 一致），不使用可配置的包接收超时。验证失败 SHALL 尽力恢复默认协议状态并关闭串口。模拟连接继续使用已实现的底层协议及其已实现能力。

#### Scenario: User selects standard STM
- **WHEN** 高级设置选择标准丐中丐
- **THEN** 连接跳过 Boost 探测，使用标准 STM 协议

#### Scenario: User selects Boost with compatible firmware
- **WHEN** 高级设置选择丐中丐（Boost）且真机完成 Boost 握手
- **THEN** 会话绑定 STM-Boost，`SessionResolver` 派生出 `runtimeFeatures.boostTransport = true`

#### Scenario: Lifecycle does not patch the profile
- **WHEN** 任一 Boost 会话完成解析
- **THEN** `SessionProfile` 由 `SessionResolver` 一次生成，生命周期不修改 `runtimeFeatures` 或其它 profile 字段

#### Scenario: Boost probe is unsupported or fails
- **WHEN** Boost 握手超时、返回不支持或以错误结束
- **THEN** 尝试复位协议状态并关闭串口，报告失败并提示可在高级设置切回标准 STM
- **AND** 不发布标准 STM 或 Boost 的活动会话

#### Scenario: Debug simulation skips hardware probe
- **WHEN** 调试模拟运行建立连接
- **THEN** 跳过真机 Boost 探测，暴露模拟实现实际具备的能力
