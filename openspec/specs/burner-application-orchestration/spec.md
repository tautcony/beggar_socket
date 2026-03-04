## Purpose

Define the application-layer orchestration contract for Burner operations so UI does not directly depend on protocol or adapter internals and flow behavior remains consistent and testable.
## Requirements
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

#### Scenario: Domain port result normalization
- **WHEN** multiple ports participate in one Burner flow
- **THEN** orchestration combines their outputs through one standardized result model without per-port ad hoc mapping branches

### Requirement: Incremental migration compatibility
The system SHALL support incremental migration from component-owned Burner logic to application orchestration without changing user-visible Burner behavior.

#### Scenario: Migrated flow parity
- **WHEN** a flow is migrated from component logic to application orchestration
- **THEN** user-visible behavior (UI trigger, result notification, and progress semantics) remains functionally equivalent

#### Scenario: Mixed migration phase
- **WHEN** only a subset of Burner flows has been migrated
- **THEN** migrated and non-migrated flows can coexist without conflicting session state behavior or breaking core Burner operations

### Requirement: Burner orchestration uses transport abstraction
The Burner orchestration layer SHALL execute protocol communication through the `Transport` interface provided by device gateway context, and SHALL NOT depend on `SerialService` or runtime-specific connection types.

#### Scenario: Burner flow invokes protocol adapter
- **WHEN** any burner use case triggers protocol send/read logic
- **THEN** the call path passes a `Transport` abstraction into protocol integration and does not import `SerialService`

#### Scenario: Runtime swap does not change orchestration contract
- **WHEN** burner orchestration runs in Web versus Electron runtime
- **THEN** the orchestration API and flow behavior remain unchanged because runtime differences are contained behind gateway/transport implementations

### Requirement: Migration compatibility for burner flows during gateway transition
The system SHALL preserve user-visible burner flow behavior while migrating from concrete serial-service dependencies to gateway/transport abstractions.

#### Scenario: Existing burner operation after migration step
- **WHEN** a previously working burner operation is migrated to gateway/transport based integration
- **THEN** busy state, cancellation handling, result shape, and progress semantics remain functionally equivalent

### Requirement: Single-source MBC detection in burner flows
The system SHALL use parser-layer MBC detection as the single rule source for Burner ROM-related flows, and SHALL NOT keep a separate MBC detection implementation in `CartBurner.vue`.

#### Scenario: Burner flow needs MBC type for operation planning
- **WHEN** a Burner read/write/verify flow requires MBC type detection
- **THEN** the flow uses parser-provided detection and does not execute component-local MBC detection logic

#### Scenario: Component code path after migration
- **WHEN** `CartBurner.vue` triggers a flow that depends on MBC type
- **THEN** the component consumes orchestration/parser results and does not contain an internal `detectMbcType` implementation

### Requirement: Single packet-read implementation for burner protocol path
The system SHALL provide one canonical packet-read implementation for Burner protocol communication, and all Burner protocol call paths SHALL reuse it to keep timeout/error behavior consistent.

#### Scenario: Burner adapter issues packet read
- **WHEN** any Burner operation performs packet read through protocol integration
- **THEN** the call path routes to the canonical packet-read implementation rather than a duplicated alternative implementation

#### Scenario: Error handling consistency across flows
- **WHEN** packet read fails due to timeout or transport/runtime error
- **THEN** Burner flows receive normalized error semantics consistent across read, write, erase, and verify operations

#### Scenario: Refactored protocol layer preserves packet-read semantics
- **WHEN** protocol-layer rehoming changes module boundaries or call paths
- **THEN** burner flow timeout and read-error semantics remain consistent with canonical packet-read behavior

### Requirement: Shared flow template for session concerns
The Burner application layer SHALL execute operation flows through a shared template that standardizes log emission, progress propagation, cancellation handling, and failure recovery.

#### Scenario: Flow starts and completes successfully
- **WHEN** a Burner operation runs through the shared template
- **THEN** busy state, log lifecycle, and progress finalization follow one consistent sequence for all templated flows

#### Scenario: Flow is cancelled or fails
- **WHEN** cancellation is requested or an error is thrown during a templated Burner flow
- **THEN** the template applies unified cancellation/error handling and restores session state without flow-specific divergence

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

