## Purpose

Define protocol-layer ownership and boundary rules so command construction, packet parsing, and protocol flow composition remain in `src/protocol` and runtime transport details stay outside the protocol boundary.
## Requirements
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

### Requirement: Atomic protocol request-response sequencing
The system SHALL execute each protocol request/response exchange through one atomic transport round-trip so concurrent or future parallel protocol entrypoints cannot misassociate responses.

#### Scenario: Protocol command uses atomic send-and-receive
- **WHEN** a protocol operation sends one command and expects an acknowledgement or payload response
- **THEN** the implementation routes that exchange through the transport or adapter `sendAndReceive()` path instead of issuing separate public `sendPackage()` and `getResult()` or payload-read calls

#### Scenario: Concurrent protocol operations remain serialized
- **WHEN** two protocol operations are triggered close together against the same transport
- **THEN** their request/response pairs remain serialized and one command cannot consume the other command's response bytes

### Requirement: Structured protocol failure classification
The system SHALL classify protocol read failures with stable machine-readable metadata rather than depending exclusively on free-form error message substrings.

#### Scenario: Packet read timeout classification
- **WHEN** canonical packet-read logic fails because the expected packet does not arrive before the timeout
- **THEN** the protocol layer emits a timeout-classified failure through a stable code or error type that upper layers can inspect without parsing the rendered message

#### Scenario: Packet read length mismatch classification
- **WHEN** packet-read logic receives fewer bytes than the expected packet size
- **THEN** the protocol layer emits a length-mismatch-classified failure through a stable code or error type while preserving a human-readable diagnostic message

