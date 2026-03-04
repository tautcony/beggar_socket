## ADDED Requirements

### Requirement: Protocol module boundary ownership
The system SHALL treat `src/protocol` as the canonical boundary for protocol command construction, packet parsing, and protocol-level flow composition, and SHALL keep runtime transport implementation details outside this boundary.

#### Scenario: Protocol module defines command and parsing behavior
- **WHEN** protocol communication behavior is implemented or updated
- **THEN** command encoding, payload parsing, and protocol response interpretation are defined under `src/protocol` modules

#### Scenario: Runtime-specific transport concern appears in protocol module
- **WHEN** protocol module code introduces runtime-specific serial implementation logic
- **THEN** architecture validation fails and requires the logic to be routed through transport abstractions

### Requirement: Canonical packet-read path for protocol communication
The system SHALL provide one canonical packet-read implementation for protocol communication paths and SHALL reuse it across protocol operations to preserve timeout and error semantics.

#### Scenario: Protocol command performs packet read
- **WHEN** any protocol operation requires a packet read
- **THEN** the call path uses the canonical packet-read implementation instead of duplicated per-operation read logic

#### Scenario: Packet-read timeout or transport error
- **WHEN** packet read fails due to timeout or transport/runtime error
- **THEN** protocol modules emit normalized failure semantics consistent across all operations

### Requirement: Stable protocol entrypoint for application consumers
The system SHALL expose a stable protocol entrypoint for application-layer consumers so use cases do not import protocol-internal utility modules directly.

#### Scenario: Burner use case invokes protocol operation
- **WHEN** Burner application orchestration executes protocol behavior
- **THEN** it imports from the protocol public entrypoint and not from protocol-internal implementation files

#### Scenario: Protocol internal refactor
- **WHEN** protocol internal file organization changes
- **THEN** application-layer call sites remain stable through unchanged public entrypoint contracts
