## Context

Current device lifecycle and serial transport concerns are split between `services/device-connection-manager.ts` and `services/serial-service.ts`, while `protocol/beggar_socket/protocol-adapter.ts` directly imports `SerialService` and `SerialConnection`. This causes protocol-layer code to know concrete platform transport details and keeps Web/Electron divergence spread across multiple layers.

The proposal requires a unified gateway abstraction for device lifecycle and a protocol-facing transport abstraction so protocol code no longer depends on concrete serial services.

## Goals / Non-Goals

**Goals:**
- Introduce a stable `DeviceGateway` interface for device lifecycle operations: `connect`, `disconnect`, `init`, `list`, `select`.
- Introduce a stable `Transport` interface for protocol operations: `send`, `read`, `setSignals`.
- Ensure `protocol-adapter` depends on `Transport` only, not `SerialService` or platform-specific connection types.
- Consolidate Web/Electron implementation differences under `platform/serial`.
- Support incremental migration without breaking current burner workflows.

**Non-Goals:**
- Rewriting burner application orchestration in this phase.
- Changing protocol command format, payload encoding, or business semantics.
- Fully removing legacy services in one step if compatibility shims are still needed.

## Decisions

### 1. Introduce platform contracts and move serial implementation behind them

Decision:
- Add contract layer under `web-client/src/platform/serial/types`:
  - `DeviceGateway` interface:
    - `list(filter?)`
    - `select(filter?)`
    - `connect(selection)`
    - `init(device)`
    - `disconnect(device)`
  - `Transport` interface:
    - `send(payload, timeoutMs?)`
    - `read(length, timeoutMs?, mode?)`
    - `setSignals(signals)`
- Device handle model separates transport from selection metadata (path/label/vendor info).

Rationale:
- Keeps protocol and orchestration independent from Electron/Web API shapes.
- Makes boundary checks simple: protocol may import only `Transport` contract.

Alternatives considered:
- Keep a single expanded `SerialService` and type-alias as abstraction.
  - Rejected because concrete singleton and platform branches remain visible to upper layers.

### 2. Split implementation by platform at `platform/serial`

Decision:
- Implement adapters in:
  - `platform/serial/web/*`
  - `platform/serial/electron/*`
- Provide one composition/root factory to resolve runtime implementation and return `DeviceGateway`.

Rationale:
- Concentrates environment branching in one boundary.
- Matches target architecture doc (`platform/serial` as convergence point).

Alternatives considered:
- Keep branching inside each method (`if isElectron`) in shared service classes.
  - Rejected due to recurring branching logic and larger test surface.

### 3. Refactor protocol adapter to consume `Transport`

Decision:
- Change `protocol-adapter` API to operate on `Transport` (or a device object that owns `transport: Transport`) and remove direct imports from `services/serial-service`.
- Preserve send/read timeout semantics while delegating transport details.

Rationale:
- Enforces protocol/transport decoupling required by Phase 2 acceptance.
- Allows protocol tests to run with mock transport independent of runtime.

Alternatives considered:
- Keep dual path in protocol adapter (`device.connection` vs `device.port`).
  - Rejected because it hard-codes transport variants into protocol layer.

### 4. Keep migration-compatible facades during transition

Decision:
- Provide temporary compatibility layer so existing callers of `DeviceConnectionManager` / `SerialService` can be migrated gradually.
- Add deprecation markers and route legacy methods internally to new gateway/transport implementations.

Rationale:
- Reduces refactor blast radius and allows phased PRs with behavior parity checks.

Alternatives considered:
- Big-bang replacement of all imports and call sites.
  - Rejected due to high regression risk in burner critical paths.

## Risks / Trade-offs

- [Risk] Contract mismatch between legacy `DeviceInfo` and new gateway handle model.
  Mitigation: define explicit mapping rules and keep adapter conversion helpers during migration.

- [Risk] Timeout/read behavior drift after protocol adapter refactor.
  Mitigation: lock existing timeout defaults and add transport-level parity tests for send/read edge cases.

- [Risk] Mixed old/new call paths coexist longer than expected.
  Mitigation: add lint/dependency guardrail checkpoints and migration checklist with owner per module.

- [Risk] Electron and Web implementations diverge subtly.
  Mitigation: shared contract test suite run against both implementations with the same scenario set.

## Migration Plan

1. Introduce `DeviceGateway` and `Transport` contracts under `platform/serial/types`.
2. Implement Web/Electron gateway + transport adapters under `platform/serial/web` and `platform/serial/electron`.
3. Add factory/composition entrypoint that provides active `DeviceGateway`.
4. Refactor `protocol-adapter` to accept `Transport` and remove direct `SerialService` imports.
5. Update burner-related callers to obtain transport via gateway-selected device/session.
6. Add/adjust dependency guardrail rule to block `protocol/* -> services/serial-service` direct imports.
7. Remove or minimize legacy manager/service API surface once all call sites migrate.

Rollback strategy:
- Keep legacy facade paths available until parity tests pass.
- If regressions occur, route factory output back through legacy implementation while keeping new contracts intact.

## Open Questions

- Should `list`/`select` behavior be fully standardized across Web and Electron, or should Web keep an explicit user-prompt semantic in the interface?
  - No, api in web / electron can differ as long as the contract is consistent and abstracts away the differences.
- Where should transport lifecycle ownership live for multi-operation sessions (gateway-level session object vs per-call transport retrieval)?
  - gateway-level session object.
- Do we need explicit signal initialization policy in contract (`init` vs direct `setSignals`) to avoid duplicate toggling logic?
  - No, keep it simple with `setSignals` and let implementation decide if it needs an init step.
