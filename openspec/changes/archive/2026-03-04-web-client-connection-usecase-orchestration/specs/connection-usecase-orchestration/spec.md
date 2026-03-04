## ADDED Requirements

### Requirement: Application-layer connection use case orchestration
The system SHALL provide a connection orchestration use case that centralizes `list`, `select`, `connect`, `init`, and `disconnect` lifecycle steps for Burner-facing workflows.

#### Scenario: UI requests connection preparation
- **WHEN** Burner UI requests connection setup
- **THEN** the orchestration use case executes required lifecycle steps in dependency-safe order and returns a normalized result

#### Scenario: UI requests disconnect
- **WHEN** Burner UI requests disconnect through orchestration
- **THEN** the use case releases connection context and returns deterministic disconnected-state output for subsequent operations

### Requirement: Connection state machine contract
The system SHALL expose connection orchestration state transitions using a consistent state machine that includes `idle`, `selecting`, `connecting`, `connected`, `disconnecting`, and `failed`.

#### Scenario: Successful connect transition sequence
- **WHEN** device selection, connect, and init all succeed
- **THEN** state transitions proceed from `idle`/`selecting` to `connecting` and finally `connected` without leaving stale intermediate state

#### Scenario: Failed initialization transition sequence
- **WHEN** `init` fails after a successful transport connection
- **THEN** state transitions to `failed` with normalized failure metadata and prevents false `connected` state exposure

### Requirement: Connection error normalization and recovery semantics
The system SHALL normalize connection and initialization failures into stable error outcomes and SHALL support immediate retry/reconnect without requiring page reload.

#### Scenario: Connect failure normalization
- **WHEN** runtime connection fails due to permission, transport, or device errors
- **THEN** orchestration returns a normalized failure result with stage-aware error classification

#### Scenario: Recovery after failure
- **WHEN** user retries after a failed connection attempt
- **THEN** orchestration starts from a clean connection context and can reach `connected` state without stale failure residue

### Requirement: Connection orchestration integration coverage
The system SHALL provide integration tests for connection orchestration covering success, failure, cancellation/interrupt, and reconnect behavior.

#### Scenario: Success and failure paths are covered
- **WHEN** connection orchestration integration tests run
- **THEN** the suite verifies deterministic outputs and state transitions for both successful lifecycle and failure branches

#### Scenario: Reconnect behavior is covered
- **WHEN** integration tests perform disconnect and reconnect cycles
- **THEN** the suite verifies lifecycle consistency and contract-compliant state recovery across repeated attempts
