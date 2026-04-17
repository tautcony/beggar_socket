## MODIFIED Requirements

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

#### Scenario: Progress reporting includes recovery stage
- **WHEN** a ROM write flow enters sector recovery because a chunk write or sector erase failed and retry handling has started
- **THEN** the shared progress payload still uses the normal burner progress contract while exposing recovery-specific sector state and detail text that UI can render without ad hoc adapter-specific parsing

#### Scenario: Domain port result normalization
- **WHEN** multiple ports participate in one Burner flow
- **THEN** orchestration combines their outputs through one standardized result model without per-port ad hoc mapping branches
