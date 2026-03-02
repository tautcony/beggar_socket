## 1. Contracts and serial platform structure

- [x] 1.1 Create `platform/serial/types` contracts for `DeviceGateway` and `Transport` with required methods (`connect/disconnect/init/list/select`, `send/read/setSignals`).
- [x] 1.2 Define shared serial/device handle types that associate connected device context with a protocol-usable `Transport`.
- [x] 1.3 Create `platform/serial/web` and `platform/serial/electron` module skeletons and add a single runtime factory entrypoint that resolves the active `DeviceGateway`.

## 2. Implement Web and Electron gateway/transport adapters

- [x] 2.1 Implement Web `DeviceGateway` + `Transport` adapter using Web Serial API with behavior compatible with current connection/init flow.
- [x] 2.2 Implement Electron `DeviceGateway` + `Transport` adapter wrapping `window.electronAPI.serial` with parity for open/list/select/setSignals/data read-write behavior.
- [x] 2.3 Add compatibility mapping helpers between legacy `DeviceInfo` shape and the new gateway-connected context where needed for incremental migration.

## 3. Refactor protocol adapter to depend on Transport only

- [x] 3.1 Update `protocol/beggar_socket/protocol-adapter.ts` signatures to consume `Transport` (or context that resolves `Transport`) and remove imports from `services/serial-service`.
- [x] 3.2 Preserve current timeout/error semantics in send/read paths while delegating all runtime-specific operations to `Transport`.
- [x] 3.3 Update protocol utility call sites to pass transport abstraction and remove direct branching on `device.connection`/`device.port` inside protocol layer.

## 4. Migrate burner integration and keep compatibility

- [x] 4.1 Update burner-facing integration paths to obtain connection and transport from `DeviceGateway` factory instead of directly instantiating/depending on `SerialService`.
- [x] 4.2 Route `DeviceConnectionManager`/`SerialService` legacy methods through new gateway/transport adapters as temporary compatibility facades with deprecation notes.
- [x] 4.3 Verify migrated burner flows keep existing user-visible behavior (busy state, cancellation, progress, result shape) across Web and Electron.

## 5. Guardrails and verification

- [x] 5.1 Extend dependency guardrails to fail when `src/protocol` imports `src/services/serial-service` directly.
- [x] 5.2 Add or update tests for gateway/transport contract behavior (send/read timeout, setSignals, connect/disconnect) and protocol adapter integration with mock `Transport`.
- [x] 5.3 Add acceptance checks confirming Web/Electron differences are contained in `platform/serial` and `protocol-adapter` no longer directly depends on `SerialService`.
