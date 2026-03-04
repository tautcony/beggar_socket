## MODIFIED Requirements

### Requirement: Burner session lifecycle management
The system SHALL manage Burner runtime state through a session model that unifies busy state, cancellation token, progress state, and operation logs for all Burner flows.

#### Scenario: Start operation lifecycle
- **WHEN** an operation starts via Burner orchestration
- **THEN** the session is set to busy, initializes cancellation state, and prepares progress/log channels

#### Scenario: Complete operation lifecycle
- **WHEN** an operation completes successfully
- **THEN** the session clears busy state, finalizes progress state, and preserves operation logs for UI consumption

#### Scenario: Cancel operation lifecycle
- **WHEN** a user requests cancellation during an active operation
- **THEN** the session aborts the operation, records cancellation outcome, and clears busy state consistently

#### Scenario: Connection precondition is orchestrated by use case
- **WHEN** a Burner operation requiring active device connection is requested
- **THEN** Burner orchestration verifies or prepares connection state through connection use case orchestration before executing protocol flow steps

### Requirement: Burner orchestration integration coverage
The system SHALL provide application-layer integration tests for burner orchestration flows using mocked transport/adapter dependencies, covering connection success/failure, read/write flow execution, cancellation, timeout, and error recovery.

#### Scenario: Connection lifecycle outcomes are covered
- **WHEN** burner orchestration tests run for connection setup
- **THEN** the suite verifies both successful connection preparation and failure-path behavior with normalized failure results

#### Scenario: Core read/write orchestration path is covered
- **WHEN** burner orchestration tests run for ROM/RAM read and write flows
- **THEN** the suite verifies success-path result structure, progress semantics, and command-buffer cleanup behavior

#### Scenario: Cancellation and timeout behavior is covered
- **WHEN** a burner flow is cancelled or reaches timeout in integration tests
- **THEN** the suite verifies operation cancellation/timeout outcome and session lifecycle convergence (busy cleared, cancellation/error state normalized)

#### Scenario: Runtime error recovery is covered
- **WHEN** adapter or transport errors are injected during burner integration tests
- **THEN** the suite verifies normalized error semantics and confirms subsequent orchestration operations can continue without stale session state

#### Scenario: Connection orchestration recovery path is covered
- **WHEN** burner integration tests execute failed connection attempts followed by reconnect and operation retry
- **THEN** the suite verifies orchestration reaches a stable connected session and executes subsequent burner flows without stale connection state
