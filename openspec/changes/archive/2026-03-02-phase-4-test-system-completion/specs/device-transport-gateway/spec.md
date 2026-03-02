## ADDED Requirements

### Requirement: Device gateway integration contract coverage
The system SHALL provide integration tests for `DeviceGateway` lifecycle behavior using runtime-appropriate mocks so connect, disconnect, init, list, and select behaviors are verifiable for both success and failure outcomes.

#### Scenario: Gateway lifecycle success path is covered
- **WHEN** gateway integration tests run for runtime-specific implementations
- **THEN** the suite verifies `connect`, `init`, `list`, `select`, and `disconnect` complete with contract-compliant result semantics

#### Scenario: Gateway lifecycle failure path is covered
- **WHEN** gateway integration tests inject connection or initialization failures
- **THEN** the suite verifies failure semantics are deterministic and upper layers receive normalized error outcomes

### Requirement: Transport error and timeout contract regression coverage
The system SHALL provide regression tests for `Transport` send/read/setSignals behavior so timeout and error semantics remain consistent across runtime implementations.

#### Scenario: Transport read timeout semantics are covered
- **WHEN** transport read operations exceed configured timeout in tests
- **THEN** the suite verifies timeout error behavior matches the shared transport contract

#### Scenario: Transport send and signal behavior is covered
- **WHEN** transport tests execute send and signal-control operations
- **THEN** the suite verifies success/error propagation semantics remain consistent for protocol-layer callers

### Requirement: Runtime parity verification for gateway and transport behavior
The system SHALL verify that Web and Electron gateway/transport implementations preserve equivalent upper-layer behavior for burner protocol workflows.

#### Scenario: Runtime parity for protocol-facing behavior
- **WHEN** equivalent gateway/transport test scenarios are executed against Web and Electron implementations
- **THEN** observed success, failure, timeout, and signal-control semantics remain functionally equivalent for upper layers
