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

#### Scenario: Disconnect cleanup survives close failure
- **WHEN** runtime-specific `transport.close()` throws during `disconnect`
- **THEN** the gateway still clears the in-memory device handle references needed to prevent stale connected state and allow a subsequent reconnect attempt

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

#### Scenario: Send timeout leaves transport reusable
- **WHEN** a transport `send()` call times out or aborts midway
- **THEN** the transport resets any writer or lock state needed so the next send or close attempt fails predictably or succeeds without inheriting stale write state

#### Scenario: Synchronization primitive release is idempotent
- **WHEN** a transport-internal release callback is invoked more than once
- **THEN** only the first invocation changes lock state and queued waiters are not skipped or reordered

## ADDED Requirements

### Requirement: Transport lifecycle recovery regression coverage
The system SHALL provide regression coverage for transport lifecycle recovery paths that previously left runtime-specific serial implementations in stale or unrecoverable states.

#### Scenario: Web transport recovers after send timeout
- **WHEN** Web transport tests force a timed-out write followed by another send or close
- **THEN** the suite verifies the transport does not keep a stale writer lock and the follow-up operation completes or fails deterministically

#### Scenario: Disconnect cleanup is covered across runtimes
- **WHEN** gateway tests inject `close()` failures in Web and Tauri disconnect flows
- **THEN** the suite verifies caller-visible cleanup semantics remain aligned and reconnect remains possible
