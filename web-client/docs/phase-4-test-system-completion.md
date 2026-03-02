# Phase 4 Test System Completion

## Scope
- Change: `phase-4-test-system-completion`
- Goal: 补齐“主流程 + 规则 + 工具”三层测试覆盖，建立稳定回归门禁。

## Coverage Matrix

| 场景 | 测试层 | 测试文件 | 最小断言 |
| --- | --- | --- | --- |
| 连接成功/失败 | 主流程集成 + 网关契约 | `tests/device-gateway.test.ts` | `DeviceGateway` 成功返回 handle，失败路径抛出/归一错误 |
| 读写流程 | 主流程集成 | `tests/burner-application.test.ts` | ROM/RAM 读写结果结构稳定、委托参数正确 |
| 取消流程 | 主流程集成 | `tests/burner-application.test.ts` | 取消后 `busy/abort` 收敛，后续流程可继续执行 |
| 超时与错误恢复 | 主流程集成 + 协议契约 | `tests/burner-application.test.ts`、`tests/protocol-transport.test.ts` | timeout/error 语义稳定，状态恢复后可继续执行 |
| 传输 send/read/setSignals 契约 | 规则契约层 | `tests/protocol-transport.test.ts` | 成功/失败/timeout 行为符合 `Transport` 契约 |
| 规则函数稳定性（parser） | 工具层 | `tests/rom-parser.test.ts` | MBC 检测与 fallback 语义稳定 |
| 会话与流程模板语义 | 规则契约层 | `tests/burner-application.test.ts` | `runBurnerFlow` 与 `BurnerSession` 生命周期收敛 |

## Test Layering

- 主流程集成层：
  - 面向用例编排，使用 mock adapter/transport 验证连接、读写、取消、恢复全链路语义。
- 规则契约层：
  - 面向 `DeviceGateway` / `Transport` / `runBurnerFlow` 等接口契约，验证行为不漂移。
- 工具层：
  - 面向 parser、formatter、crc 等纯函数规则，提供快速稳定回归。

## Baseline Commands

- `npm run test:run`
- `npm run lint`
- `npm run type-check`
- `npm run check:deps`
- `npm run build`

上述命令共同构成 Phase 4 验收门禁。

## Notes

- mock 测试优先保证稳定与快速反馈；真实设备 smoke 用于补充边缘时序验证。
- 若新增测试明显变慢，建议后续拆分 `test:run:fast` 与 `test:run:full`。
