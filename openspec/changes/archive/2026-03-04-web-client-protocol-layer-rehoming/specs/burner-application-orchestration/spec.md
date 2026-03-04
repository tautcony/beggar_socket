## MODIFIED Requirements

### Requirement: Burner orchestration entrypoint
The system SHALL provide a single application-layer orchestration entrypoint for Burner operations, and UI components SHALL invoke Burner flows only through this entrypoint.

#### Scenario: UI triggers ROM write
- **WHEN** a user starts ROM write from Burner UI
- **THEN** the UI calls the application-layer orchestration API instead of directly invoking adapter or protocol methods

#### Scenario: Unsupported direct protocol import in Burner UI
- **WHEN** Burner UI code attempts to depend on protocol-level command or transport utilities
- **THEN** the implementation is rejected by architecture guardrails and the flow remains routed through application-layer orchestration

#### Scenario: Burner use case imports protocol via stable entrypoint
- **WHEN** burner orchestration integrates protocol behavior
- **THEN** use cases depend on protocol public entrypoint contracts and do not import protocol-internal helper modules directly

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
