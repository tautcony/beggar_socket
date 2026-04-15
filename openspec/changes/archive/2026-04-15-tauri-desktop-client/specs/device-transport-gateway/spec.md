## MODIFIED Requirements

### Requirement: Unified device gateway contract
The system SHALL provide a `DeviceGateway` contract that unifies device lifecycle operations across Web and Tauri runtimes, including `connect`, `disconnect`, `init`, `list`, and `select`.

#### Scenario: Tauri gateway lifecycle operation
- **WHEN** the runtime is Tauri and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Tauri serialplugin implementation without exposing Tauri-specific APIs to upper layers

#### Scenario: Web gateway lifecycle operation
- **WHEN** the runtime is Web and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Web Serial implementation without exposing Web Serial API details to upper layers

#### Scenario: Gateway mapped to domain connection port
- **WHEN** application wiring composes Burner domain ports
- **THEN** `DeviceGateway` is adapted through a connection port implementation instead of being consumed directly by application use cases

#### Scenario: Stage-aware lifecycle failure semantics
- **WHEN** any gateway lifecycle stage (`list`, `select`, `connect`, `init`, `disconnect`) fails
- **THEN** the gateway returns normalized stage-aware failure outcomes that connection orchestration can map deterministically

### Requirement: Device selection and transport association
The system SHALL expose a gateway result model where selected/connected device context includes or resolves the associated `Transport` needed by protocol workflows.

#### Scenario: Connect returns protocol-usable context
- **WHEN** a caller connects to a selected device through `DeviceGateway`
- **THEN** the returned context can provide a `Transport` instance required by protocol adapter operations

#### Scenario: Disconnect invalidates transport usage
- **WHEN** the caller disconnects a device through `DeviceGateway`
- **THEN** subsequent operations through the associated transport fail predictably until a new connection is established

#### Scenario: Domain protocol port receives transport through adapter
- **WHEN** Burner orchestration calls protocol operations through domain ports
- **THEN** the bound port adapter resolves the underlying `Transport` from gateway context without exposing gateway internals to use cases

#### Scenario: Reconnect returns fresh connection context
- **WHEN** a caller reconnects after disconnect or failure
- **THEN** the gateway exposes a fresh connection context and does not reuse stale transport/session bindings

### Requirement: Runtime parity verification for gateway and transport behavior
The system SHALL verify that Web and Tauri gateway/transport implementations preserve equivalent upper-layer behavior for burner protocol workflows.

#### Scenario: Runtime parity for protocol-facing behavior
- **WHEN** equivalent gateway/transport test scenarios are executed against Web and Tauri implementations
- **THEN** observed success, failure, timeout, and signal-control semantics remain functionally equivalent for upper layers

## ADDED Requirements

### Requirement: DeviceHandle platform type includes Tauri
The system SHALL update the `DeviceHandle.platform` type from `'web' | 'electron'` to `'web' | 'tauri'` to reflect the replacement of Electron with Tauri as the native desktop runtime.

#### Scenario: Tauri gateway returns tauri platform handle
- **WHEN** `TauriDeviceGateway.connect()` returns a `DeviceHandle`
- **THEN** the `platform` field is set to `'tauri'`

#### Scenario: Web gateway continues returning web platform handle
- **WHEN** `WebDeviceGateway.connect()` returns a `DeviceHandle`
- **THEN** the `platform` field remains `'web'`

### Requirement: Gateway factory selects Tauri or Web implementation
The system SHALL update the gateway factory to create a `TauriDeviceGateway` when `isTauri()` returns `true`, and `WebDeviceGateway` otherwise, replacing the previous `isElectron()` branching logic.

#### Scenario: Factory creates TauriDeviceGateway in Tauri runtime
- **WHEN** `getDeviceGateway()` is called in a Tauri runtime
- **THEN** it returns an instance of `TauriDeviceGateway`

#### Scenario: Factory creates WebDeviceGateway in browser
- **WHEN** `getDeviceGateway()` is called in a standard web browser
- **THEN** it returns an instance of `WebDeviceGateway`

## REMOVED Requirements

### Requirement: Unified device gateway contract — Electron scenario
**Reason**: Electron runtime is being completely replaced by Tauri. The Electron gateway implementation (`ElectronDeviceGateway`) and all `isElectron()` branching are removed.
**Migration**: Use `TauriDeviceGateway` for desktop native serial communication. The `isTauri()` check replaces `isElectron()` in all platform detection logic.
