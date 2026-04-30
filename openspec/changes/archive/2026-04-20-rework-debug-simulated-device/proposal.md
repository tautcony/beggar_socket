## Why

The current debug mode swaps in a dedicated `MockAdapter` and short-circuits connection/init logic in `DeviceConnectionManager`. That bypasses the real gateway, transport, protocol, and adapter paths, so debug sessions cannot exercise or validate the production burner code that actually ships.

We need a debug flow that keeps the production call path intact while still allowing local simulated devices, deterministic delays, and injected failures for UI and protocol verification.

## What Changes

- Replace adapter-level mock branching with a simulated device runtime that plugs into the existing `DeviceGateway` and `Transport` contracts.
- Add a simulated device gateway/transport pair that can be selected when debug mode enables device simulation, so burner flows still pass through connection orchestration, protocol helpers, and real `GBAAdapter`/`MBC5Adapter` logic.
- Move debug-mode behavior from "return fake `DeviceInfo` / use `MockAdapter`" to "connect to a simulated device handle" and keep `initializeDevice()` on the normal lifecycle path.
- Rework debug settings and debug panel controls around simulation profiles/configuration instead of adapter-only delay helpers.
- Remove or stop exporting the obsolete `MockAdapter` path once no runtime flow depends on it.
- Add regression tests that verify simulated-device connections, protocol operations, and burner integration continue to use the shared transport/gateway contracts.

## Capabilities

### New Capabilities
- `debug-simulated-device`: Define how debug mode exposes simulated devices, simulation settings, and deterministic failure/delay injection while preserving the production burner workflow.

### Modified Capabilities
- `device-transport-gateway`: Extend the gateway/transport contract so a simulated runtime can participate in list/select/connect/init/disconnect flows using the same upper-layer interfaces as Web and Tauri.

## Impact

- Affected code: `src/settings/debug-settings.ts`, `src/components/DebugPanel.vue`, `src/components/CartBurner.vue`, `src/services/device-connection-manager.ts`, `src/platform/serial/**/*`, `src/features/burner/adapters/**/*`, related tests.
- Removed/replaced runtime path: `src/services/mock-adapter.ts` and any `debugMode` branches that bypass connection or adapter initialization.
- New code: simulated device gateway/transport/runtime state and related fixtures/tests.
