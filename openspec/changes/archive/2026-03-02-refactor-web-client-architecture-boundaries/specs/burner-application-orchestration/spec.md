## ADDED Requirements

### Requirement: Burner orchestration entrypoint
The system SHALL provide a single application-layer orchestration entrypoint for Burner operations, and UI components SHALL invoke Burner flows only through this entrypoint.

#### Scenario: UI triggers ROM write
- **WHEN** a user starts ROM write from Burner UI
- **THEN** the UI calls the application-layer orchestration API instead of directly invoking adapter or protocol methods

#### Scenario: Unsupported direct protocol import in Burner UI
- **WHEN** Burner UI code attempts to depend on protocol-level command or transport utilities
- **THEN** the implementation is rejected by architecture guardrails and the flow remains routed through application-layer orchestration

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

### Requirement: Incremental migration compatibility
The system SHALL support incremental migration from component-owned Burner logic to application orchestration without changing user-visible Burner behavior.

#### Scenario: Migrated flow parity
- **WHEN** a flow is migrated from component logic to application orchestration
- **THEN** user-visible behavior (UI trigger, result notification, and progress semantics) remains functionally equivalent

#### Scenario: Mixed migration phase
- **WHEN** only a subset of Burner flows has been migrated
- **THEN** migrated and non-migrated flows can coexist without conflicting session state behavior or breaking core Burner operations
