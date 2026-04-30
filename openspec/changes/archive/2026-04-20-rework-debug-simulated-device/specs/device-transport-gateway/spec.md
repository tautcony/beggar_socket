## MODIFIED Requirements

### Requirement: Unified device gateway contract
The system SHALL provide a `DeviceGateway` contract that unifies device lifecycle operations across Web, Tauri, and simulated runtimes, including `connect`, `disconnect`, `init`, `list`, and `select`.

#### Scenario: Tauri gateway lifecycle operation
- **WHEN** the runtime is Tauri and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Tauri serialplugin implementation without exposing Tauri-specific APIs to upper layers

#### Scenario: Web gateway lifecycle operation
- **WHEN** the runtime is Web and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Web Serial implementation without exposing Web Serial API details to upper layers

#### Scenario: Simulated gateway lifecycle operation
- **WHEN** debug simulation is enabled and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through a simulated device runtime without exposing simulation-specific APIs to upper layers

#### Scenario: Gateway mapped to domain connection port
- **WHEN** application wiring composes Burner domain ports
- **THEN** `DeviceGateway` is adapted through a connection port implementation instead of being consumed directly by application use cases

#### Scenario: Stage-aware lifecycle failure semantics
- **WHEN** any gateway lifecycle stage (`list`, `select`, `connect`, `init`, `disconnect`) fails
- **THEN** the gateway returns normalized stage-aware failure outcomes that connection orchestration can map deterministically

#### Scenario: Disconnect cleanup survives close failure
- **WHEN** runtime-specific `transport.close()` throws during `disconnect`
- **THEN** the gateway still clears the in-memory device handle references needed to prevent stale connected state and allow a subsequent reconnect attempt

### Requirement: Device gateway integration contract coverage
The system SHALL provide integration tests for `DeviceGateway` lifecycle behavior using runtime-appropriate mocks or simulated runtimes so connect, disconnect, init, list, and select behaviors are verifiable for Web, Tauri, and simulated implementations.

#### Scenario: Gateway lifecycle success path is covered
- **WHEN** gateway integration tests run for runtime-specific implementations
- **THEN** the suite verifies `connect`, `init`, `list`, `select`, and `disconnect` complete with contract-compliant result semantics

#### Scenario: Gateway lifecycle failure path is covered
- **WHEN** gateway integration tests inject connection or initialization failures
- **THEN** the suite verifies failure semantics are deterministic and upper layers receive normalized error outcomes

#### Scenario: Disconnect and reconnect contract is covered
- **WHEN** gateway integration tests execute disconnect followed by reconnect
- **THEN** the suite verifies lifecycle contract continuity and fresh transport-context availability for upper layers

### Requirement: Runtime parity verification for gateway and transport behavior
The system SHALL verify that Web, Tauri, and simulated gateway/transport implementations preserve equivalent upper-layer behavior for burner protocol workflows.

#### Scenario: Runtime parity for protocol-facing behavior
- **WHEN** equivalent gateway/transport test scenarios are executed against Web, Tauri, and simulated implementations
- **THEN** observed success, failure, timeout, and signal-control semantics remain functionally equivalent for upper layers

### Requirement: DeviceHandle platform type includes Tauri
The system SHALL define `DeviceHandle.platform` to include `web`, `tauri`, and `simulated` so connected sessions can accurately describe hardware-backed and simulated runtimes.

#### Scenario: Tauri gateway returns tauri platform handle
- **WHEN** `TauriDeviceGateway.connect()` returns a `DeviceHandle`
- **THEN** the `platform` field is set to `'tauri'`

#### Scenario: Web gateway continues returning web platform handle
- **WHEN** `WebDeviceGateway.connect()` returns a `DeviceHandle`
- **THEN** the `platform` field remains `'web'`

#### Scenario: Simulated gateway returns simulated platform handle
- **WHEN** `SimulatedDeviceGateway.connect()` returns a `DeviceHandle`
- **THEN** the `platform` field is set to `'simulated'`

### Requirement: Gateway factory selects Tauri or Web implementation
The system SHALL update the gateway factory to create a `SimulatedDeviceGateway` when debug simulation is enabled, a `TauriDeviceGateway` when `isTauri()` returns `true` and simulation is disabled, and a `WebDeviceGateway` otherwise.

#### Scenario: Factory creates SimulatedDeviceGateway when simulation is enabled
- **WHEN** `getDeviceGateway()` is called while debug simulation is enabled
- **THEN** it returns an instance of `SimulatedDeviceGateway`

#### Scenario: Factory creates TauriDeviceGateway in Tauri runtime
- **WHEN** `getDeviceGateway()` is called in a Tauri runtime and simulation is disabled
- **THEN** it returns an instance of `TauriDeviceGateway`

#### Scenario: Factory creates WebDeviceGateway in browser
- **WHEN** `getDeviceGateway()` is called in a standard web browser and simulation is disabled
- **THEN** it returns an instance of `WebDeviceGateway`
