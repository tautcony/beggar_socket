## Purpose

Define a unified device and transport gateway contract so protocol and application layers can remain independent from Web/Tauri serial implementation details.

## Requirements

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

### Requirement: Transport error and timeout contract regression coverage
The system SHALL provide regression tests for `Transport` send/read/setSignals behavior so timeout and error semantics remain consistent across runtime implementations.

#### Scenario: Transport read timeout semantics are covered
- **WHEN** transport read operations exceed configured timeout in tests
- **THEN** the suite verifies timeout error behavior matches the shared transport contract

#### Scenario: Transport send and signal behavior is covered
- **WHEN** transport tests execute send and signal-control operations
- **THEN** the suite verifies success/error propagation semantics remain consistent for protocol-layer callers

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

### Requirement: Transport lifecycle recovery regression coverage
The system SHALL provide regression coverage for transport lifecycle recovery paths that previously left runtime-specific serial implementations in stale or unrecoverable states.

#### Scenario: Web transport recovers after send timeout
- **WHEN** Web transport tests force a timed-out write followed by another send or close
- **THEN** the suite verifies the transport does not keep a stale writer lock and the follow-up operation completes or fails deterministically

#### Scenario: Disconnect cleanup is covered across runtimes
- **WHEN** gateway tests inject `close()` failures in Web and Tauri disconnect flows
- **THEN** the suite verifies caller-visible cleanup semantics remain aligned and reconnect remains possible

### Requirement: Atomic post-ACK flush and debug request serialization
The `Transport` contract SHALL ensure that protocol operations requiring post-ACK input flushing (`sendAndExpectAck`) and debug command send-then-receive sequences execute within the transport's exclusive critical section without releasing the lock between send, read, and buffer cleanup.

#### Scenario: Post-ACK flush cannot interleave with concurrent requests
- **WHEN** a command invokes `sendAndExpectAck` across Web, Tauri, or simulated transport
- **THEN** the send, ACK read, and post-ACK input flush complete inside a single exclusive transport lock acquisition so a subsequent request cannot start before the flush finishes

#### Scenario: Debug command uses serialized send-and-receive
- **WHEN** `executeDebugCommand` sends a debug frame and reads its response
- **THEN** it executes through the transport's serialized request-response path rather than uncoordinated separate `sendPackage` and `getPackage` calls

#### Scenario: Nested transport locking is avoided
- **WHEN** a transport executes an atomic multi-step sequence inside its mutex
- **THEN** internal steps invoke non-reentrant primitives so the transport never deadlocks on its own lock

#### Scenario: Runtime parity across Web, Tauri, and simulated transports
- **WHEN** atomic post-ACK flush and debug request tests run against Web, Tauri, and simulated transport implementations
- **THEN** all three implementations enforce equivalent mutual exclusion and buffer cleanup semantics
