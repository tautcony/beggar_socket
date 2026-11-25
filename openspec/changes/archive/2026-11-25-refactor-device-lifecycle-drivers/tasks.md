# Tasks

## 1. 端口发现

- [x] 1.1 接入核心注册表和设置选择，在 Web 获得已授权端口和打开前的 VID/PID。用网关及组件测试覆盖首选过滤、手动完整列表、缺少信息和已授权端口重试。
- [x] 1.2 Tauri 按用户设置优先定位端口，保留单匹配、多个匹配和无匹配逻辑。测试自动选择仅针对 match；多个匹配返回 `PortSelectionRequiredError`，无匹配不自动打开 mismatch，用户显式选择 mismatch 后才连接。
- [x] 1.3 记录所选配置、实际 VID/PID 与匹配结果。测试 STM 选择配 `0483:5740`、Beggar 选择配 GBFlash 端口和 GBFlash 选择配其他端口均按各自设置运行，字节记录能验证没有自动切换协议。

## 2. 会话生命周期

- [x] 2.1 将首次连接、指定端口、重连或重新建立会话接入 `establishSession`，以所选固件确定打开参数。用连接编排和操作协调器测试验证状态提交、互斥、迟到完成以及旧 generation 失效。
- [x] 2.2 实现 PendingSession → commit → ActiveSession；commit 前失败走 cleanupPending，commit 后 disconnect 走 teardown。测试 probe/resolve/initialize/close 失败清理和立即重试。
- [x] 2.3 在 `src/device-runtime/drivers/` 提取 `BeggarDriver implements ProtocolDriver<BeggarProbeFacts>`，将模拟建模为 TransportBackend，协议身份保持 Beggar/FlashGBX。用现有 Boost 测试覆盖标准 STM 跳过探测、Boost 成功（`boostTransport` 由 SessionResolver 派生，lifecycle 不改写 profile）、异常与不支持时复位关端口、模拟设备使用其已实现的能力。
- [x] 2.4 在 `src/device-runtime/drivers/` 提取 `FlashgbxDriver implements ProtocolDriver<FlashgbxProbeFacts>` 并复用握手与断开。运行现有协议测试，断言 CH340/CDC 识别、`auto` 展开为 2000000、无 DTR/RTS 脉冲、`DEVICE_MIN_FW` 版本门槛、probe/reset timeout（统一 250 ms）、错误阶段及唯一 teardown 序列（失败写入 `disconnect` 诊断）。前端保留 `ALLOWED_BAUD_RATES` 常量用于 UI 提前拦截，Rust 侧保持强制校验，不新增 Tauri 命令。
- [x] 2.5 验证自动发现不会打开 mismatch 端口，用户显式选择 mismatch 端口后记录 `DeviceDiagnostic(stage='transport')` 并按所选 variant 继续连接。

## 3. 适配器和连接显示

- [x] 3.1 在 `src/device-runtime/` 按会话装配 GBA、MBC5 适配器和模式同步，将适配器生命周期绑定连接身份；继续用 core change 已加的 `check:deps` 规则确认 `device-runtime` 不依赖 UI。用适配器、CartBurner 和 FlashGBX 事务测试验证切换会话、并发及模式同步。
- [x] 3.2 将分块限幅接到解析结果并保留现有算法。运行传输契约测试覆盖 STM、STC、Boost 和 GBFlash CH340/CDC 的读写大小、宿主差异和协议边界。
- [x] 3.3 通过右侧日志区（非仅 `console`）渲染实际连接的设备和固件信息、端口匹配结果及可操作的失败阶段提示。用 `device-connect.test.ts` 验证右侧日志输出、匹配诊断与失败阶段。

## 4. 集成验证

- [x] 4.1 在依赖 core SelectionProvider 的前提下按 core → lifecycle → parameters/UI 顺序运行 `npm run type-check`、`npm run check:deps`、`npm run test:run`。在可用的 Web/Tauri 环境记录 GBFlash L14、丐中丐（含 Boost）和碳酸丐的真机握手、卡带识别、ROM 校验及断开结果。
  - 软件检查：`npm run type-check`、`npm run check:deps`、`npm run test:run`（106 个测试文件、1,330 个用例）全部通过。
  - 真机实测（用户于 2026-11-25 确认完成）：GBFlash L14、标准 STM（丐中丐）、STM-Boost（丐中丐 Boost）与 STC（碳酸丐）在 Web/Tauri 环境下的握手、卡带识别、ROM 校验及断开流程均实测通过。
