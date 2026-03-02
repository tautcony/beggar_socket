## Why

The current serial/device responsibilities are split across `DeviceConnectionManager` and `SerialService`, and `protocol-adapter` still depends on concrete serial implementation details. This creates cross-layer coupling and makes Web/Electron divergence harder to control during ongoing architecture refactoring.

## What Changes

- Introduce a unified device-facing gateway contract that consolidates overlapping connection and initialization responsibilities.
- Introduce a transport contract used by protocol-layer components for data exchange and signal control, removing direct dependency on concrete serial services.
- Refactor protocol integration points so protocol logic depends only on `Transport` abstractions.
- Consolidate Web/Electron serial differences under `platform/serial` with consistent upper-layer interfaces.
- Align module boundaries with the existing layered architecture goals and dependency guardrails.

## Capabilities

### New Capabilities
- `device-transport-gateway`: Define unified `DeviceGateway` and `Transport` contracts, including lifecycle operations (`connect/disconnect/init/list/select`) and transport operations (`send/read/setSignals`) for protocol-independent orchestration.

### Modified Capabilities
- `burner-application-orchestration`: Update orchestration integration requirements so burner flows and adapters interact through `DeviceGateway`/`Transport` abstractions rather than concrete serial service types.
- `architecture-dependency-guardrails`: Extend boundary requirements to ensure protocol adapter modules do not directly depend on `SerialService` and that platform-specific serial implementations stay contained under `platform/serial`.

## Impact

- Affected code:
  - `web-client/src/services` (connection and serial responsibilities)
  - `web-client/src/protocol` (adapter dependency direction)
  - `web-client/src/platform/serial` (Web/Electron implementations and shared types/contracts)
- Affected architecture:
  - Dependency direction from protocol to transport abstraction only
  - Clearer separation between protocol behavior and platform serial implementation
- Affected validation:
  - Architecture checks and refactor acceptance need to verify `protocol-adapter` no longer directly depends on `SerialService`.
