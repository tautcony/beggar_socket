## ADDED Requirements

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

### Requirement: Burner flow contract regression safety
The system SHALL maintain regression assertions for burner flow contracts so refactors do not change user-visible semantics for result messages, progress reporting, and session state transitions.

#### Scenario: Result contract remains stable across refactors
- **WHEN** burner orchestration tests compare flow outputs before and after refactor changes
- **THEN** the suite verifies success/failure result shape and message semantics remain functionally equivalent

#### Scenario: Progress and session lifecycle contract remains stable
- **WHEN** long-running burner flows emit progress and complete/cancel/fail in tests
- **THEN** the suite verifies progress payload structure and busy/abort/log lifecycle transitions remain consistent with existing UI consumption expectations
