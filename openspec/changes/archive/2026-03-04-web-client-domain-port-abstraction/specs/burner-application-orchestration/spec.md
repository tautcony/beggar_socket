## MODIFIED Requirements

### Requirement: Burner orchestration entrypoint
The system SHALL provide a single application-layer orchestration entrypoint for Burner operations, and UI components SHALL invoke Burner flows only through this entrypoint.

#### Scenario: UI triggers ROM write
- **WHEN** a user starts ROM write from Burner UI
- **THEN** the UI calls the application-layer orchestration API instead of directly invoking adapter or protocol methods

#### Scenario: Unsupported direct protocol import in Burner UI
- **WHEN** Burner UI code attempts to depend on protocol-level command or transport utilities
- **THEN** the implementation is rejected by architecture guardrails and the flow remains routed through application-layer orchestration

#### Scenario: Use case orchestration consumes domain ports
- **WHEN** Burner orchestration executes connection or protocol steps
- **THEN** orchestration depends on domain port contracts and not on concrete gateway/service implementation classes

### Requirement: Standardized Burner flow contract
The system SHALL standardize Burner flow contracts for read, erase, write, verify, and scan operations so each flow exposes consistent success/error/progress behavior.

#### Scenario: Flow success contract
- **WHEN** any Burner flow succeeds
- **THEN** the orchestration returns a success result with consistent structure and optional payload where applicable

#### Scenario: Flow failure contract
- **WHEN** any Burner flow fails due to runtime or device error
- **THEN** the orchestration returns a failure result with normalized error message and does not leave session state inconsistent

#### Scenario: Progress reporting contract
- **WHEN** a long-running Burner flow emits progress
- **THEN** progress events follow a shared structure consumable by existing Burner progress UI without flow-specific parsing branches

#### Scenario: Domain port result normalization
- **WHEN** multiple ports participate in one Burner flow
- **THEN** orchestration combines their outputs through one standardized result model without per-port ad hoc mapping branches
