## Purpose

Define enforceable dependency boundaries for the web-client architecture and provide a repeatable guardrail workflow that blocks newly introduced layer violations.

## Requirements

### Requirement: Dependency boundary enforcement for UI layer
The system SHALL enforce architecture rules that prevent `components` and `views` from directly depending on `protocol` modules.

#### Scenario: New UI file imports protocol module
- **WHEN** a new or modified file under `src/components` or `src/views` imports from `src/protocol`
- **THEN** static checks fail and the change is blocked until dependency routing is corrected

#### Scenario: Existing compliant UI file
- **WHEN** a UI file depends on application/service facade instead of protocol modules
- **THEN** static checks pass for dependency-boundary validation

### Requirement: Dependency boundary enforcement for foundation layer
The system SHALL enforce architecture rules that prevent `types` and `utils` from directly depending on `services` modules.

#### Scenario: Utility file imports service module
- **WHEN** a file under `src/utils` introduces direct import from `src/services`
- **THEN** static checks fail and indicate a foundation-to-service dependency violation

#### Scenario: Type file imports service module
- **WHEN** a file under `src/types` introduces direct import from `src/services`
- **THEN** static checks fail and indicate required type extraction or dependency inversion

### Requirement: Baseline-aware violation detection
The system SHALL provide a dependency checking mechanism that distinguishes historical baseline exceptions from newly introduced violations during migration.

#### Scenario: Historical allowlisted violation
- **WHEN** dependency checks encounter a known baseline exception
- **THEN** the check output records architecture matrix information without failing solely due to that exception

#### Scenario: Newly introduced non-allowlisted violation
- **WHEN** dependency checks detect a new violation outside the baseline allowlist
- **THEN** the check exits with failure and reports source file, import path, and violation reason

### Requirement: Guardrail execution in developer workflow
The system SHALL expose architecture dependency checks through a documented and executable project command.

#### Scenario: Developer runs dependency guardrail command
- **WHEN** `check:deps` is executed in the web-client project
- **THEN** the command prints dependency edge summary and enforces failure on non-allowlisted violations

#### Scenario: Team follows guardrail documentation
- **WHEN** contributors consult architecture guardrail documentation
- **THEN** they can identify enforced boundaries, baseline exceptions, and expected integration points (local and CI)
