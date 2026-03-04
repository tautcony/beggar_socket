## MODIFIED Requirements

### Requirement: Burner orchestration entrypoint
The system SHALL provide a single application-layer orchestration entrypoint for Burner operations, and UI components SHALL invoke Burner flows only through this entrypoint.

#### Scenario: UI triggers ROM write
- **WHEN** a user starts ROM write from Burner UI
- **THEN** the UI calls the application-layer orchestration API instead of directly invoking adapter or protocol methods

#### Scenario: Unsupported direct protocol import in Burner UI
- **WHEN** Burner UI code attempts to depend on protocol-level command or transport utilities
- **THEN** the implementation is rejected by architecture guardrails and the flow remains routed through application-layer orchestration

#### Scenario: CartBurner container delegates orchestration
- **WHEN** `CartBurner` is refactored into container and presentation components
- **THEN** only the container boundary invokes burner orchestration APIs and presentation components communicate through props/events contracts

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

#### Scenario: Containerized UI consumes unified session state
- **WHEN** chip, ROM, and RAM panels are rendered under CartBurner containerization
- **THEN** they consume one shared session-derived state model and do not maintain divergent operation lifecycle state machines

## ADDED Requirements

### Requirement: Burner orchestration contract compatibility for containerization
The system SHALL preserve Burner orchestration API contract compatibility while migrating `CartBurner.vue` to a containerized composition model.

#### Scenario: Existing burner flow call signatures remain valid
- **WHEN** containerization migration is applied
- **THEN** read/write/erase/verify orchestration call signatures and success/failure result structures remain backward-compatible for current UI integrations

#### Scenario: Containerization does not change user-visible flow semantics
- **WHEN** users execute burner operations after containerization
- **THEN** operation progress cadence, cancellation behavior, and final result semantics remain functionally equivalent to pre-containerization behavior
