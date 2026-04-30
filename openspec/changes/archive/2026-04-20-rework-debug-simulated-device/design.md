## Context

Today debug mode is implemented by branching above the connection and protocol stack:

- `DeviceConnectionManager.requestDevice()` returns a fabricated `DeviceInfo`.
- `DeviceConnectionManager.initializeDevice()` skips initialization.
- `CartBurner.vue` swaps `GBAAdapter`/`MBC5Adapter` for `MockAdapter`.

That gives the UI something to operate on, but it does not exercise the real production path:

`DeviceConnect` -> `ConnectionOrchestrationUseCase` -> `DeviceGateway` -> `Transport` -> protocol helpers -> real cartridge adapters.

The repo already has a clean gateway/transport abstraction, so the redesign should use that seam instead of adding more adapter-level mocks.

## Goals / Non-Goals

**Goals:**
- Keep debug sessions on the same burner, protocol, and adapter code paths as production.
- Model simulated devices as a first-class gateway/transport runtime.
- Preserve the existing debug panel as the place to enable simulation, set delay, and inject failures.
- Allow automated tests to validate simulated connection and protocol flows without browser or Tauri serial APIs.
- Remove runtime dependence on `MockAdapter`.

**Non-Goals:**
- Building a full MCU firmware emulator with cycle-accurate behavior.
- Perfectly emulating every flash chip quirk; the simulated runtime only needs contract-faithful behavior for supported burner flows.
- Changing the public burner UI workflow outside debug/simulation controls.

## Decisions

### 1. Add a `SimulatedDeviceGateway` and `SimulatedTransport`

Debug mode will no longer fabricate `DeviceInfo` directly. Instead, the serial factory will return a simulated gateway when debug simulation is enabled. `ConnectionOrchestrationUseCase`, `DeviceConnectionManager`, and all protocol helpers will continue to use the same contracts they already use for Web/Tauri.

Why:
- This preserves the production call graph.
- It concentrates simulation behavior at the infrastructure seam where the app already abstracts runtime differences.

Alternative considered:
- Keep `MockAdapter` and add more mocked behaviors there. Rejected because it still bypasses the protocol and gateway layers.

### 2. Promote simulation settings from adapter helpers to runtime configuration

`DebugSettings` will keep UI-facing settings such as enabled state, delay, and error injection, but it will additionally expose the active simulation mode/profile consumed by the simulated gateway/transport/runtime state.

Why:
- The existing settings UI can remain mostly intact.
- Simulation behavior becomes transport-driven rather than adapter-driven.

Alternative considered:
- Introduce a separate store just for simulation. Rejected for this change because the current debug settings already persist the right class of values and the redesign does not need a broader settings migration.

### 3. Model the simulated device as protocol-aware memory/state, not as high-level burner operations

The simulated runtime will maintain ROM/RAM/flash state and answer protocol commands by parsing transport payloads, enqueueing ACK/data packets, and honoring the existing protocol helper expectations.

Why:
- Real adapters and protocol helpers keep running unchanged.
- Debug tool commands and burner flows share the same simulated backend.

Alternative considered:
- Hook at protocol utility functions (`sendPackage`, `getPackage`) with special cases. Rejected because it would hide simulation from the transport contract and create another side path.

### 4. Expand `DeviceHandle.platform` and gateway factory selection to include `simulated`

The handle contract will explicitly represent simulated connections with `platform: 'simulated'`. The gateway factory will prefer simulated runtime when debug simulation is enabled; otherwise it will keep the existing Web/Tauri branching.

Why:
- A simulated connection is not semantically Web or Tauri.
- Tests and logs can distinguish simulated versus hardware sessions.

Alternative considered:
- Pretend simulated handles are `web`. Rejected because it obscures behavior and weakens type safety.

### 5. Remove `MockAdapter` from the active runtime path

`CartBurner.vue` will always construct the real `GBAAdapter` and `MBC5Adapter` once a device is connected, regardless of whether that device is simulated or hardware-backed.

Why:
- This is the core objective of the change.

Alternative considered:
- Keep `MockAdapter` only as a private test helper. Deferred unless a later test still benefits from it.

## Risks / Trade-offs

- [Protocol coverage gaps] -> The simulated transport may initially miss edge-case commands used by some burner flows. Mitigation: implement the command set exercised by current adapters and add targeted regression tests.
- [Behavior drift from hardware] -> Simulated erase/program timing and flash semantics are approximate. Mitigation: keep simulation deterministic, document limitations, and confine it to debug/testing flows.
- [More infrastructure code] -> Moving simulation into transport/gateway adds lower-level code. Mitigation: keep runtime state isolated under `platform/serial/simulated` and avoid touching protocol logic unless required.
- [Existing tests relying on `MockAdapter`] -> Some tests or exports may assume the old mock path exists. Mitigation: migrate tests to the simulated gateway path and remove dead exports only after replacements are in place.

## Migration Plan

1. Introduce simulated runtime state plus `SimulatedTransport` and `SimulatedDeviceGateway`.
2. Update serial factory/types and `DeviceConnectionManager` so debug mode connects through the simulated gateway instead of returning fabricated `DeviceInfo`.
3. Update `CartBurner.vue` to always instantiate real adapters and remove the debug-only `MockAdapter` branch.
4. Rework debug settings/panel wording and behavior around simulated devices.
5. Add and update tests for gateway factory selection, device connection, and protocol/device flows.
6. Remove dead `MockAdapter` exports/files once no runtime path depends on them.

Rollback:
- Re-enable the old `MockAdapter` path by restoring the previous branches in `DeviceConnectionManager` and `CartBurner.vue` if simulated transport proves incomplete.

## Open Questions

- None for implementation start; chip-profile fidelity can be iterated after the shared simulated runtime path lands.
