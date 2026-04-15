## Purpose

Define a unified device and transport gateway contract so protocol and application layers can remain independent from Web/Tauri serial implementation details.
## Requirements
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

### Requirement: Unified protocol transport contract
The system SHALL provide a `Transport` contract exposing `send`, `read`, and `setSignals` operations that protocol-layer code can use independent of runtime-specific serial implementations.

#### Scenario: Protocol send/read through transport
- **WHEN** protocol logic performs packet send and packet read operations
- **THEN** it uses only `Transport` operations and receives consistent success, error, and timeout behavior regardless of runtime

#### Scenario: Signal initialization through transport
- **WHEN** device initialization requires toggling serial control signals
- **THEN** callers invoke `setSignals` on `Transport` instead of using runtime-specific serial APIs directly

#### Scenario: Protocol layer consumes transport-only contract
- **WHEN** protocol modules perform communication for Burner flows
- **THEN** protocol call paths consume only `Transport` contract APIs and do not depend on concrete serial service classes

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

### Requirement: Device gateway integration contract coverage
The system SHALL provide integration tests for `DeviceGateway` lifecycle behavior using runtime-appropriate mocks so connect, disconnect, init, list, and select behaviors are verifiable for both success and failure outcomes.

#### Scenario: Gateway lifecycle success path is covered
- **WHEN** gateway integration tests run for runtime-specific implementations
- **THEN** the suite verifies `connect`, `init`, `list`, `select`, and `disconnect` complete with contract-compliant result semantics

#### Scenario: Gateway lifecycle failure path is covered
- **WHEN** gateway integration tests inject connection or initialization failures
- **THEN** the suite verifies failure semantics are deterministic and upper layers receive normalized error outcomes

#### Scenario: Disconnect and reconnect contract is covered
- **WHEN** gateway integration tests execute disconnect followed by reconnect
- **THEN** the suite verifies lifecycle contract continuity and fresh transport-context availability for upper layers

### Requirement: Transport error and timeout contract regression coverage
The system SHALL provide regression tests for `Transport` send/read/setSignals behavior so timeout and error semantics remain consistent across runtime implementations.

#### Scenario: Transport read timeout semantics are covered
- **WHEN** transport read operations exceed configured timeout in tests
- **THEN** the suite verifies timeout error behavior matches the shared transport contract

#### Scenario: Transport send and signal behavior is covered
- **WHEN** transport tests execute send and signal-control operations
- **THEN** the suite verifies success/error propagation semantics remain consistent for protocol-layer callers

### Requirement: Runtime parity verification for gateway and transport behavior
The system SHALL verify that Web and Tauri gateway/transport implementations preserve equivalent upper-layer behavior for burner protocol workflows.

#### Scenario: Runtime parity for protocol-facing behavior
- **WHEN** equivalent gateway/transport test scenarios are executed against Web and Tauri implementations
- **THEN** observed success, failure, timeout, and signal-control semantics remain functionally equivalent for upper layers

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
