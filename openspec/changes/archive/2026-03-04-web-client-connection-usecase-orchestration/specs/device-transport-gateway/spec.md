## MODIFIED Requirements

### Requirement: Unified device gateway contract
The system SHALL provide a `DeviceGateway` contract that unifies device lifecycle operations across Web and Electron runtimes, including `connect`, `disconnect`, `init`, `list`, and `select`.

#### Scenario: Electron gateway lifecycle operation
- **WHEN** the runtime is Electron and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Electron serial implementation without exposing Electron-specific APIs to upper layers

#### Scenario: Web gateway lifecycle operation
- **WHEN** the runtime is Web and caller invokes gateway lifecycle methods
- **THEN** the gateway executes the requested lifecycle operation through Web Serial implementation without exposing Web Serial API details to upper layers

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
