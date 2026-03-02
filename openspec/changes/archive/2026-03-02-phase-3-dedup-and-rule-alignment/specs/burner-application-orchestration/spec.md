## ADDED Requirements

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

### Requirement: Shared flow template for session concerns
The Burner application layer SHALL execute operation flows through a shared template that standardizes log emission, progress propagation, cancellation handling, and failure recovery.

#### Scenario: Flow starts and completes successfully
- **WHEN** a Burner operation runs through the shared template
- **THEN** busy state, log lifecycle, and progress finalization follow one consistent sequence for all templated flows

#### Scenario: Flow is cancelled or fails
- **WHEN** cancellation is requested or an error is thrown during a templated Burner flow
- **THEN** the template applies unified cancellation/error handling and restores session state without flow-specific divergence
